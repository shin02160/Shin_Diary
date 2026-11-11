# Notion 연결 설정 — 3단계

이 앱은 1인 전용입니다. 현재 실제 Notion 토큰·대상 데이터 소스가 설정되어 있지 않습니다. 연결하지 않아도 기존 브라우저 기록은 유지됩니다.

## 1. 전용 데이터베이스 준비

Notion에 앱 전용 Activities와 Entries 데이터베이스를 준비하고 통합에 읽기·삽입·수정 권한을 부여하세요. 기존 My Travel Hub, 여행별 DB, Calendar Events는 대상이 아닙니다. 앱은 데이터베이스나 속성을 자동 생성·수정하지 않습니다.

각 데이터베이스의 **데이터 소스 ID**를 확인하세요. DB URL의 데이터베이스 ID와 다를 수 있습니다. 공식 API의 데이터베이스 조회 응답에 있는 `data_sources[].id`를 사용합니다.

이름과 속성 타입은 아래와 정확히 일치해야 합니다. Category와 Lifecycle Status의 선택지 값은 화면 라벨과 달리 아래 영문 키입니다.

### Activities

| 속성 | 타입 | 값 / 역할 |
|---|---|---|
| Name | Title | 활동명 |
| App ID | Rich text | 앱 고유 키. 앱이 자동 기록하며 수동 변경 금지 |
| Category | Select | Travel, Concert, Projects, Daily |
| Lifecycle Status | Select | interested, active, parked, satisfied |
| Archived | Checkbox | 앱 보관함. Notion 페이지 휴지통과 별개 |
| Summary | Rich text | 활동 소개 |
| Last Progress | Rich text | 마지막 진행 |
| Next Step | Rich text | 다음 행동 |
| Resume Notes | Rich text | 재개 맥락 |
| Satisfaction Note | Rich text | 만족 메모 |
| References | Rich text | http/https 링크를 한 줄에 하나 |
| Parked At | Date | 최근 중단 날짜 |
| Tags | Multi-select | 관심사 태그 |

### Entries

| 속성 | 타입 | 값 / 역할 |
|---|---|---|
| Name | Title | 명시적 제목 또는 본문에서 자동 생성한 표시 제목 |
| App ID | Rich text | 앱 고유 키. 수동 변경 금지 |
| Content | Rich text | 본문. 20,000자 이내, 요청 시 분할 저장 |
| Title Provided | Checkbox | 직접 입력한 제목이 있으면 체크. 없으면 자동 표시 제목 |
| Occurred At | Date | 경험 날짜 / 시각 |
| Date Kind | Select | date, zoned, floating |
| Time Zone | Rich text | zoned이면 Asia/Seoul 등 IANA 시간대 |
| Created At | Date | 최초 작성 시각 |
| Category | Select | Travel, Concert, Projects, Daily |
| Mood | Rich text | 감정 |
| Place | Rich text | 장소 |
| Tags | Multi-select | 태그 |
| Activity | Relation | 위 Activities 데이터 소스로 연결, 기록당 최대 하나 |

Title Provided가 꺼져 있으면 Name은 자동 표시 제목이며 독립적인 사용자 제목으로 가져오지 않습니다. Notion에서 제목을 직접 지정하려면 Name을 입력하고 Title Provided를 체크하세요. 본문은 Content 속성에서 편집합니다. 페이지 본문 블록은 이 단계에서 읽거나 수정하지 않습니다.

App ID가 없는 수동 작성 페이지는 읽기 대상에서 제외됩니다. 앱에서 생성한 페이지를 Notion에서 편집하는 흐름을 지원합니다. App ID가 중복되거나 날짜·관계·스키마가 잘못된 경우 덮어쓰지 않고 오류를 표시합니다.

## 2. 서버 환경변수

`.env.example`을 `.env.local`로 복사해 아래 값을 로컬 편집기로 입력하고 서버를 재시작하세요. 토큰과 비밀키를 채팅·Git·브라우저 환경변수에 넣지 마세요.

- NOTION_TOKEN: Notion 통합 토큰
- NOTION_ACTIVITIES_DATA_SOURCE_ID / NOTION_ENTRIES_DATA_SOURCE_ID: 서로 다른 두 데이터 소스 ID
- DIARY_PASSWORD: 앱 로그인 비밀번호, 최소 16자
- DIARY_SESSION_SECRET: 무작위 세션 서명 비밀키, 최소 32자
- DIARY_APP_ORIGIN: 정확한 앱 주소. 개발 기본값은 http://localhost:3000이며 마지막 `/`는 제외
- DIARY_STATE_FILE: `.data/` 안의 SQLite 저널 파일명. 기본 notion.sqlite

Node.js 24 이상과 쓰기 가능한 영속 `.data/` 디렉터리가 필요합니다. 비밀값은 모두 서버에서만 사용합니다. 앱 주소는 HTTPS 또는 localhost/127.0.0.1이어야 합니다. 다중 사용자 분리는 지원하지 않으며 하나의 비밀번호와 두 DB가 한 소유자의 저장 공간입니다.

## 3. 실제 사용

1. 설정 → Notion → 앱 비밀번호로 로그인합니다. 8시간 쿠키는 HttpOnly·SameSite=Strict이며 HTTPS에서 Secure를 설정합니다.
2. **브라우저 기록 Notion에 저장**을 누르면 미반영 활동부터 저장하고 연결된 기록을 저장합니다. 샘플 기록 자체는 보내지 않습니다. 사용자 기록에 연결된 샘플 활동은 의존 관계 보존을 위해 함께 저장됩니다.
3. 다른 브라우저에서는 같은 서버에 로그인한 후 **Notion에서 불러오기**를 누릅니다. 이후 홈·추억·활동 상세·달력에 반영됩니다.
4. 양쪽에서 같은 기록을 바꿨다면 로컬 입력을 유지하고 두 버전을 보여줍니다. **Notion 내용 사용** 또는 **내 내용으로 Notion에 반영**을 선택합니다.
5. 반영 대기 항목이 0개이고 카드에 Notion 반영됨이 표시되어야 해당 버전의 저장이 확인된 상태입니다. 이후 Notion에서 변경된 내용은 다시 불러와야 보입니다.

자동 백그라운드 동기화가 아닙니다. Notion을 장기 원본으로 사용하고 브라우저는 입력 대기·조회용 사본을 유지합니다. 브라우저에 저장만 한 미반영 기록은 기기 간 공유되지 않습니다.

## 실패와 복구

- 부분 실패: 앞서 성공한 항목은 반영 상태로 남고 실패 항목은 미반영으로 유지됩니다. 대기 후 같은 버튼으로 재시도합니다.
- 429 / 529: Retry-After 동안 요청을 보류하고 재시도 안내를 표시합니다. 서버는 짧은 요청 큐로 호출 간격을 제한합니다.
- 인증 만료: 다시 로그인합니다. 입력·브라우저 데이터는 삭제하지 않습니다.
- 새 페이지 생성 응답 유실: 먼저 App ID로 조회해 이미 만들어진 페이지를 찾습니다. 여전히 확인되지 않으면 중복 방지를 위해 재생성을 차단합니다. 실제로 생성되지 않은 경우 운영자가 Notion을 확인하고 저널을 복구해야 하며, 자동 강제 재생성 버튼은 제공하지 않습니다.
- `.data/notion.sqlite`와 WAL 파일은 중복 방지·요청 경합을 위한 운영 데이터입니다. 삭제하거나 서버리스 임시 디스크로 운영하지 마세요. 앱 중지 후 `.data/`를 백업합니다. 사용자 기록 본문과 Notion 토큰은 저널에 저장하지 않습니다.
- Notion에서 페이지 삭제·App ID 변경·다른 DB 이동: 자동 삭제나 재생성으로 추정하지 않습니다. 원본을 확인하세요.
- Notion 직접 편집과 API 수정 사이에는 원격 원자적 CAS를 제공하지 않으므로, 업로드 중 같은 페이지를 Notion UI에서 동시에 편집하는 것은 피하세요. 앱의 다중 요청은 영속 저널 잠금과 콘텐츠 해시로 충돌을 검사합니다.

로그인 실패는 10분에 10회로 제한됩니다. 토큰·DB 권한 오류는 성공으로 처리하지 않습니다. 서버 응답에 토큰이나 원문 Notion 오류를 노출하지 않습니다.

## 검증 및 공식 참고

```powershell
npm test
npm run lint
npm run build
npm run typecheck
```

실제 자격증명이 없어 실서비스 읽기·쓰기 검증은 하지 않았습니다. 단위/통합 테스트는 모의 Notion API와 임시 SQLite로 진행하며, 운영 데이터는 사용하지 않습니다.

- [Notion API 버전](https://developers.notion.com/reference/versioning)
- [데이터 소스 조회](https://developers.notion.com/reference/query-a-data-source)
- [페이지 속성 읽기·쓰기](https://developers.notion.com/reference/page-property-values)
- [요청 제한](https://developers.notion.com/reference/request-limits)

검증 결과(2026-11-11): 서버 테스트 18개, 실제 HTTP 인증/요청 검증 13항목, Notion UI 모의 연동 24항목, 기존 로컬 기능 회귀 53항목 통과. 실제 Notion 서비스 연동 검증은 토큰과 대상 데이터 소스 설정 후 진행해야 합니다.

링크가 첨부된 기록을 반영하려면 Entries에 선택 속성 **Source Links**를 텍스트로 추가하세요. 각 주소는 한 줄에 하나씩 저장됩니다.

## 로컬 읽기 전용 위키

.env.local에서 DIARY_NOTION_READ_ONLY=true를 설정하고 localhost에서 실행하면 앱 비밀번호 없이 Notion 기록과 일정을 불러올 수 있습니다. 개인 위키 메뉴에서 기존 Notion 페이지를 읽으려면 NOTION_WIKI_PAGE_ID에 시작 페이지 ID를 입력하고 해당 페이지를 Notion 통합에 공유하세요.

## 외부 링크로 읽기 전용 위키 열기

Node.js 서버와 영속 SQLite 디렉터리를 제공하는 호스팅에 배포하고 아래 설정을 서버 환경변수에 넣습니다.

- DIARY_APP_ORIGIN에 실제 HTTPS 주소를 입력합니다.
- DIARY_NOTION_READ_ONLY=true와 DIARY_NOTION_REQUIRE_LOGIN=true를 설정합니다.
- DIARY_PASSWORD와 DIARY_SESSION_SECRET에 각각 16자 이상 비밀번호와 32자 이상 서명 키를 설정합니다.
- NOTION_TOKEN, 데이터 소스 ID, NOTION_WIKI_PAGE_ID를 서버에서 설정합니다.
- 배포 서버에서는 빌드 후 호스팅의 프록시를 통해 Next.js를 실행합니다. 호스팅이 컨테이너의 전체 인터페이스에서 수신하도록 요구하면 npx next start --hostname 0.0.0.0을 사용합니다.

방문자는 /wiki에서 설정 로그인으로 이동한 뒤 위키를 읽을 수 있습니다.

## 접속 시 사이트 잠금

Vercel의 서버 환경변수에 DIARY_SITE_LOCK=true, DIARY_NOTION_READ_ONLY=true, 실제 HTTPS 주소 DIARY_APP_ORIGIN, DIARY_PASSWORD, DIARY_SESSION_SECRET을 설정하고 다시 배포합니다. 읽기 전용 사이트 잠금에는 숫자 4자리 또는 16자 이상의 비밀번호를 사용할 수 있습니다. 4자리 비밀번호를 쓸 때 Vercel Firewall에서 /api/site/session 요청에 별도 속도 제한을 설정하세요. 앱 자체의 시도 횟수 제한은 실행 인스턴스별입니다.

읽기 전용 모드의 메인 화면은 Activities와 Entries를 Notion에서 불러와 표시합니다. 위키 시작 페이지 ID를 비워 두면 개인 위키 메뉴에서도 같은 화면을 볼 수 있습니다. 특정 Notion 문서를 열고 싶을 때만 NOTION_WIKI_PAGE_ID를 설정하세요.

## 메인 보관함에 여행·공연 표시

Diary Notion 통합에 여행 마스터와 공연 DB의 읽기 권한을 부여합니다. 서버에 각 데이터 소스 ID를 NOTION_TRAVEL_TRIPS_SOURCE_ID와 NOTION_PERFORMANCES_SOURCE_ID로 설정하면 읽기 전용 메인 화면에 표시됩니다. Vercel에서는 Production에 저장하고 다시 배포합니다. 여행·공연 원본의 항목은 Diary DB에 복사하지 않습니다.
