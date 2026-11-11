"""One-off, read-only CalDAV probe for a NAVER test account."""
import argparse
import base64
from datetime import date
from getpass import getpass, GetPassWarning
import re
import sys
import warnings
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET

ORIGIN = "https://caldav.calendar.naver.com"
DAV = "{DAV:}"
CAL = "{urn:ietf:params:xml:ns:caldav}"
MAX_RESPONSE = 2 * 1024 * 1024


class ProbeError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def endpoint(href, base=ORIGIN + "/"):
    if not href or any(ord(char) < 32 for char in href) or chr(92) in href:
        raise ProbeError("CalDAV 경로 형식을 확인할 수 없습니다.")
    try:
        url = urljoin(base, href)
        parts = urlsplit(url)
        if (parts.scheme != "https" or parts.hostname != "caldav.calendar.naver.com"
                or parts.port not in (None, 443) or parts.username is not None
                or parts.password is not None or parts.fragment):
            raise ValueError()
    except ValueError:
        raise ProbeError("공식 CalDAV 서버와 다른 주소가 반환되었습니다.") from None
    return url


def parse_multistatus(data):
    if re.search(br"<!\s*(?:DOCTYPE|ENTITY)", data, re.IGNORECASE) or bytes(1) in data:
        raise ProbeError("지원하지 않는 XML 형식입니다.")
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        raise ProbeError("CalDAV XML 응답을 읽을 수 없습니다.") from None
    if root.tag != DAV + "multistatus":
        raise ProbeError("CalDAV multistatus 응답이 필요합니다.")
    return root.findall(DAV + "response")


def successful_properties(response):
    result = {}
    for item in response.findall(DAV + "propstat"):
        status = item.findtext(DAV + "status", "").split()
        properties = item.find(DAV + "prop")
        if len(status) > 1 and status[1] == "200" and properties is not None:
            result.update({prop.tag: prop for prop in properties})
    return result


def propfind(*properties):
    return ('<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
            '<d:prop>' + ''.join('<' + prop + '/>' for prop in properties) + '</d:prop></d:propfind>')


class Probe:
    def __init__(self, username, password, opener=None):
        self.authorization = "Basic " + base64.b64encode((username + ":" + password).encode()).decode()
        self.opener = opener or build_opener(NoRedirect())

    def request(self, method, url, depth, body):
        if method not in {"PROPFIND", "REPORT"}:
            raise ProbeError("조회 메서드만 사용할 수 있습니다.")
        for _ in range(4):
            url = endpoint(url)
            request = Request(url, method=method, data=body.encode(), headers={
                "Authorization": self.authorization, "Depth": str(depth),
                "Content-Type": "application/xml; charset=utf-8",
            })
            try:
                with self.opener.open(request, timeout=15) as response:
                    if response.status != 207:
                        raise ProbeError("서버에서 CalDAV 207 응답을 받지 못했습니다.")
                    data = response.read(MAX_RESPONSE + 1)
                    if len(data) > MAX_RESPONSE:
                        raise ProbeError("응답이 너무 큽니다. 더 짧은 기간을 선택하세요.")
                    return url, parse_multistatus(data)
            except HTTPError as error:
                with error:
                    if error.code in {301, 302, 303, 307, 308}:
                        url = endpoint(error.headers.get("Location"), url)
                        continue
                    if error.code in {401, 403}:
                        raise ProbeError(f"CalDAV 인증 또는 권한을 확인하세요. HTTP {error.code}") from None
                    raise ProbeError(f"CalDAV 조회가 실패했습니다. HTTP {error.code}", error.code) from None
            except (URLError, TimeoutError, OSError):
                raise ProbeError("CalDAV 연결 또는 TLS 검증에 실패했습니다.") from None
        raise ProbeError("CalDAV 주소 이동 횟수가 초과됐습니다.")

    def property_href(self, url, namespace, name, wire_name):
        base, responses = self.request("PROPFIND", url, 0, propfind(wire_name))
        for response in responses:
            prop = successful_properties(response).get(namespace + name)
            if prop is not None and prop.findtext(DAV + "href"):
                return endpoint(prop.findtext(DAV + "href"), base)
        raise ProbeError(f"CalDAV 검색 응답에 {name} 속성이 없습니다.")

    def calendars(self):
        try:
            principal = self.property_href(
                ORIGIN + "/.well-known/caldav", DAV, "current-user-principal", "d:current-user-principal"
            )
        except ProbeError as error:
            if error.status not in {404, 405, 501}:
                raise
            principal = self.property_href(ORIGIN + "/", DAV, "current-user-principal", "d:current-user-principal")
        home = self.property_href(principal, CAL, "calendar-home-set", "c:calendar-home-set")
        base, responses = self.request("PROPFIND", home, 1, propfind("d:resourcetype", "c:supported-calendar-component-set"))
        urls = []
        for response in responses:
            props = successful_properties(response)
            kind = props.get(DAV + "resourcetype")
            if kind is None or kind.find(CAL + "calendar") is None:
                continue
            supported = props.get(CAL + "supported-calendar-component-set")
            if supported is not None and not any(comp.get("name") == "VEVENT" for comp in supported):
                continue
            url = endpoint(response.findtext(DAV + "href"), base)
            if url not in urls:
                urls.append(url)
        return urls

    def events(self, url, start, end):
        if not 1 <= (end - start).days <= 31:
            raise ProbeError("조회 기간은 1~31일이어야 합니다.")
        utc = lambda day: day.strftime("%Y%m%d") + "T000000Z"
        body = (
            '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
            '<d:prop><d:getetag/></d:prop><c:filter><c:comp-filter name="VCALENDAR">'
            '<c:comp-filter name="VEVENT"><c:time-range start="' + utc(start) + '" end="' + utc(end) +
            '"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>'
        )
        base, responses = self.request("REPORT", url, 1, body)
        results = {}
        for response in responses:
            etag = successful_properties(response).get(DAV + "getetag")
            if etag is None or not etag.text:
                raise ProbeError("일정 응답에 ETag가 없어 변경 검증을 할 수 없습니다.")
            key = endpoint(response.findtext(DAV + "href"), base)
            if key in results:
                raise ProbeError("같은 일정 리소스가 중복 반환되었습니다.")
            results[key] = etag.text
        return results


def main():
    parser = argparse.ArgumentParser(description="테스트 계정의 네이버 CalDAV 읽기 검증")
    parser.add_argument("--from", dest="start", type=date.fromisoformat, required=True)
    parser.add_argument("--to", dest="end", type=date.fromisoformat, required=True,
                        help="UTC 기준 배타 종료일")
    parser.add_argument("--calendar-index", type=int, default=1)
    parser.add_argument("--compare", action="store_true", help="Enter 입력 후 같은 범위를 다시 조회")
    args = parser.parse_args()
    if not 1 <= (args.end - args.start).days <= 31 or args.calendar_index < 1:
        parser.error("1~31일의 기간과 1 이상의 캘린더 번호를 지정하세요.")
    if not sys.stdin.isatty():
        parser.error("자격증명을 숨겨 입력할 수 있는 대화형 터미널에서 실행하세요.")
    try:
        username = input("네이버 테스트 계정 ID: ").strip()
        with warnings.catch_warnings():
            warnings.simplefilter("error", GetPassWarning)
            try:
                password = getpass("테스트 계정의 애플리케이션 비밀번호: ")
            except GetPassWarning:
                raise ProbeError("비밀번호를 숨겨 입력할 수 있는 터미널이 필요합니다.") from None
        if not username or not password or ":" in username:
            raise ProbeError("테스트 계정 ID와 비밀번호를 입력하세요.")
        probe = Probe(username, password)
        del password
        calendars = probe.calendars()
        print(f"검색된 일정 캘린더 {len(calendars)}개")
        if args.calendar_index > len(calendars):
            raise ProbeError("조회할 캘린더 번호가 검색 결과에 없습니다.")
        url = calendars[args.calendar_index - 1]
        first = probe.events(url, args.start, args.end)
        print(f"선택한 기간의 일정 리소스 {len(first)}개")
        if args.compare:
            input("테스트 캘린더의 변경을 준비한 뒤 Enter를 누르세요. ")
            second = probe.events(url, args.start, args.end)
            changed = sum(first[key] != second[key] for key in first.keys() & second.keys())
            print(f"추가 {len(second.keys() - first.keys())}개, 변경 {changed}개, 범위에서 사라짐 {len(first.keys() - second.keys())}개")
        return 0
    except ProbeError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (KeyboardInterrupt, EOFError):
        return 130


if __name__ == "__main__":
    sys.exit(main())
