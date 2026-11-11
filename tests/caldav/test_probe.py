import io
import unittest
from datetime import date
from urllib.error import HTTPError

from scripts.caldav_probe import ORIGIN, Probe, ProbeError, parse_multistatus


def xml(*rows):
    return ('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
            + ''.join(rows) + '</d:multistatus>').encode()


def row(href, properties, status="200 OK"):
    return (f"<d:response><d:href>{href}</d:href><d:propstat><d:prop>{properties}</d:prop>"
            f"<d:status>HTTP/1.1 {status}</d:status></d:propstat></d:response>")


class Response(io.BytesIO):
    status = 207


class Fixture:
    def __init__(self, *responses):
        self.responses = iter(responses)
        self.requests = []

    def open(self, request, timeout):
        self.requests.append(request)
        response = next(self.responses)
        if isinstance(response, HTTPError):
            raise response
        return Response(response)


class ProbeTest(unittest.TestCase):
    def test_discovery_filter_and_period_query(self):
        fixture = Fixture(
            HTTPError(ORIGIN, 302, "", {"Location": "/dav/"}, io.BytesIO()),
            xml(row("/dav/", "<d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal>")),
            xml(row("/principal/", "<c:calendar-home-set><d:href>/home/</d:href></c:calendar-home-set>")),
            xml(row("/home/work/", "<d:resourcetype><c:calendar/></d:resourcetype>"),
                row("/home/tasks/", '<d:resourcetype><c:calendar/></d:resourcetype>'
                    '<c:supported-calendar-component-set><c:comp name="VTODO"/></c:supported-calendar-component-set>')),
            xml(row("/home/work/item.ics", "<d:getetag>v1</d:getetag>")),
            xml(row("/home/work/item.ics", "<d:getetag>v2</d:getetag>")),
        )
        probe = Probe("fixture", "fake", fixture)
        calendars = probe.calendars()
        self.assertEqual(calendars, [ORIGIN + "/home/work/"])
        start, end = date(2026, 11, 1), date(2026, 11, 3)
        first = probe.events(calendars[0], start, end)
        second = probe.events(calendars[0], start, end)
        self.assertEqual(first, {ORIGIN + "/home/work/item.ics": "v1"})
        self.assertEqual(second, {ORIGIN + "/home/work/item.ics": "v2"})
        self.assertIn(b'start="20261101T000000Z" end="20261103T000000Z"', fixture.requests[-1].data)
        self.assertEqual([r.method for r in fixture.requests], ["PROPFIND"] * 4 + ["REPORT"] * 2)

    def test_cross_origin_redirect_is_blocked_before_forwarding_credentials(self):
        fixture = Fixture(HTTPError(ORIGIN, 307, "", {"Location": "https://example.com/dav"}, io.BytesIO()))
        with self.assertRaises(ProbeError):
            Probe("fixture", "fake", fixture).calendars()
        self.assertEqual(len(fixture.requests), 1)

    def test_missing_etag_cannot_be_reported_as_an_empty_period(self):
        fixture = Fixture(xml(row("/item.ics", "<d:getetag/>", "403 Forbidden")))
        with self.assertRaisesRegex(ProbeError, "ETag"):
            Probe("fixture", "fake", fixture).events(ORIGIN, date(2026, 11, 1), date(2026, 11, 2))

    def test_write_methods_and_xml_entities_are_rejected(self):
        with self.assertRaises(ProbeError):
            Probe("fixture", "fake", Fixture()).request("PUT", ORIGIN, 0, "")
        with self.assertRaises(ProbeError):
            parse_multistatus(b'<!DOCTYPE x [<!ENTITY y "z">]><x>&y;</x>')


if __name__ == "__main__":
    unittest.main()
