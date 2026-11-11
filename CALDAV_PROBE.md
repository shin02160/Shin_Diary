# 네이버 CalDAV 읽기 검증

네이버는 iPhone·iPad의 캘린더 클라이언트에 HTTPS 서버와 로그인 설정을 안내합니다. Mac은 일정 열람을 지원합니다. 이 안내에서 자체 웹 백엔드의 호환성이나 서비스 운영 지원 범위까지 확인할 수는 없습니다. [네이버 CalDAV 설정](https://help.naver.com/service/5620/contents/2426?lang=ko&osType=COMMONOS)

별도 테스트 계정의 캘린더와 테스트 일정으로 검증합니다. 2단계 인증을 사용하는 개인 계정은 CalDAV용 앱 비밀번호를 터미널에 입력합니다. [네이버 앱 비밀번호 안내](https://help.naver.com/service/5640/contents/8584?lang=ko&osType=COMMONOS)

```powershell
python scripts/caldav_probe.py --from 2026-11-10 --to 2026-11-17 --compare
```

기간은 UTC 자정 기준이며 종료일은 포함하지 않습니다. 도구는 1~31일을 조회합니다. 여러 캘린더가 검색되면 `--calendar-index`로 응답 순서에 따른 번호를 선택할 수 있습니다. 비교 모드에서는 테스트 캘린더의 일정을 웹에서 수정한 뒤 Enter를 누르면 같은 범위를 다시 조회합니다.

도구는 PROPFIND로 캘린더를 찾고 REPORT로 일정 리소스의 ETag를 읽습니다. 결과에는 캘린더 수, 일정 리소스 수, 추가·변경·범위 이탈 수가 표시됩니다. 반복 일정 시리즈는 하나의 리소스로 집계될 수 있습니다. [CalDAV 표준](https://www.rfc-editor.org/rfc/rfc4791) · [서비스 검색 표준](https://www.rfc-editor.org/rfc/rfc6764)

테스트 자격증명과 응답은 실행 중 메모리에 유지됩니다. 인증 요청은 공식 HTTPS 호스트로 제한됩니다. 현재 검증은 모의 응답으로 수행했습니다. 운영 연동 여부를 판단하려면 별도 계정에서 캘린더 검색, 일정 조회, 변경 감지를 모두 확인하고 자체 서비스 연동의 지원 범위를 네이버에 확인해야 합니다.

```powershell
python -B -m unittest discover -s tests/caldav
```
