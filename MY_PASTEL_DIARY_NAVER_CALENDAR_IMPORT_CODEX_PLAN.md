# My Pastel Diary — 네이버 캘린더 기존 일정 가져오기 설계 및 Codex 구현 계획

작성 기준: 2026-11-10 · 대상: 신규 My Pastel Diary (Next.js/TypeScript + Notion 연동 예정) · 목적: **네이버 캘린더 기존 일정을 다이어리에서 확인**

## 0. 공식 지원 여부 및 구현 원칙

| 경로 | 공식 근거 | My Pastel Diary 적용 가능성 |
|---|---|---|
| PC 네이버 캘린더 → `.ics` 내보내기 → 앱에서 파일 가져오기 | 네이버 캘린더 고객센터에서 `.ics` 내보내기를 공식 안내 | **추천 P0/P1**: 사용자가 수동 내보낸 파일을 앱에서 파싱·미리보기·보관. 자동 갱신은 아님 |
| CalDAV | 네이버 고객센터에서 iOS 기본 캘린더 등에 대한 CalDAV 연결을 공식 안내 | **P3 조사 과제**: 데스크톱/웹앱 서버의 임의 CalDAV 클라이언트 연동까지 공식 지원·호환이 보장되는 것은 아님. 안전한 독립 PoC만 허용 |
| 네이버 로그인 기반 캘린더 Open API | 공식 개발자 문서는 `POST /calendar/createSchedule.json` 일정 추가만 안내 | **기존 일정 조회에 사용하지 않음**: 조회 API 확인되지 않음. OAuth 로그인만으로 캘린더 읽기를 가정하지 말 것 |
| 공개 캘린더 URL/HTML | 네이버는 공개 캘린더 URL 및 HTML 공유를 안내 | 개인 일정의 비공개 접근 경로로 사용하지 않음. 공개 노출을 유도하지 않음 |

**공식 근거**
- ICS 내보내기: https://help.naver.com/service/5620/contents/18401?osType=PC
- CalDAV: https://help.naver.com/service/5620/contents/2426?lang=ko&osType=COMMONOS
- Naver 공개 API 종류: https://developers.naver.com/docs/common/openapiguide/apilist.md
- 일정 추가 API: https://developers.naver.com/docs/login/calendar-api/calendar-api.md
- 애플리케이션 비밀번호: https://help.naver.com/service/5640/contents/8584?lang=ko&osType=COMMONOS
- Notion rate limits: https://developers.notion.com/reference/request-limits
- iCalendar 파서(후보) https://github.com/kewisch/ical.js

**확정 정책**
- 이번 기능의 목표는 **네이버에서 가져온 일정의 읽기 전용 열람**이다. 네이버 일정 수정/삭제는 하지 않는다.
- Notion은 My Pastel Diary의 원본 기록 저장소다. 네이버에서 가져온 일정은 `Calendar Events` 별도 DB에 보관해 `Diary Entries`, `Moments`와 구분한다.
- 가져온 일정은 **가져온 시점의 스냅샷**이다. '실시간 동기화'라는 UI 문구를 사용하지 않는다.
- `.ics`에는 첨부파일·범주 색상이 포함되지 않을 수 있다(네이버 공식 안내).
- 기존 My Travel Hub DB나 예약·지출 정보는 접근·변경하지 않는다.

## 1. 사용자 흐름 (P0/P1)

1. **네이버 PC 웹 캘린더** 접속 및 로그인.
2. 좌측 **내 캘린더** 목록에서 캘린더명 우측 화살표 → **가져오기/내보내기(백업)** → 기간 설정 → **내보내기** → `.ics` 저장.
3. My Pastel Diary → **달력 > 외부 일정 가져오기** → **네이버 캘린더 (.ics)** 선택.
4. 파일 선택 후 브라우저에서 파일 형식/크기 검사, 서버에서 실제 ICS 파싱·정규화.
5. 미리보기: 가져올 전체 건수, 신규, 기존과 일치, 변경, 경고, 선택 기간, 캘린더 출처 표시.
6. 사용자 **[가져오기 확정]** 시에만 Notion `Calendar Events`에 반영(P1). P0에서는 저장하지 않는 미리보기만 구현.
7. 달력에서 **내 일기**와 **네이버에서 가져온 일정**을 유형별 라벨로 구분하여 표시.
8. 일정 선택 시 읽기 전용 상세보기(제목/일시/장소/설명/출처/가져온 날짜) 제공.
9. **[이 일정으로 일기 작성]** 버튼을 선택하면, 선택한 일정에 연결된 *새* 일기를 작성(P2). 기존 네이버 원본은 그대로 둠.
10. 사용자가 새 `.ics` 파일을 내보내 다시 업로드하면 **[재가져오기]**로 변경 내용 반영. 자동 동기화 아님.

## 2. 정보구조/UI

- 달력 헤더: `◀ 2026년 12월 ▶` / 보기 `월·목록` / `+ 기록` / `외부 일정 가져오기`
- 필터 칩: `전체 | 일기 | 네이버 일정 | 여행 | 공연`
- 달력 셀: 일기(감정 아이콘), 네이버 일정(작은 라벤더 점+시간), 여행(민트), 공연(핑크). 색상 외 라벨도 사용.
- 일정 상세: 읽기 전용 헤더 `네이버에서 가져온 일정`; 수정 불가 안내; `[이 일정으로 일기 작성]`.
- 가져오기 화면: `.ics` 업로드 영역 → 파싱 → 경고/중복 미리보기 → 확정/취소 → 결과.
- 설정 > 캘린더 연결 상태: `수동 ICS 가져오기`, `마지막 가져오기: 날짜`, `실시간 동기화 아님`, `재가져오기`.
- 모바일: 360px 이상에서 가로 본문 스크롤 금지. 터치 44px 이상. 모달·업로드 취소·로딩·실패·재시도.
- 스타일: 기존 My Pastel Diary 파스텔 디자인(라벤더·블러시 핑크·민트·크림), 기존 내비게이션 재사용.

## 3. 데이터 모델 — `Calendar Events` (신규 Notion DB 제안)

이 표의 속성명은 **신규 DB에 대한 제안**이며 실제 생성·수정은 사용자의 승인 후 진행한다. 기존 Diary/Moments DB는 무단 수정하지 않는다.

| 속성명 | Notion 속성 타입 | 설명 |
|---|---|---|
| 일정명 | Title | 원본 SUMMARY |
| 출처 | Select | NAVER_ICS |
| 출처 캘린더 ID | Rich text | 앱이 캘린더별로 부여한 안정 ID |
| 원본 UID | Rich text | iCalendar UID |
| 반복 인스턴스 ID | Rich text | RECURRENCE-ID 또는 원본 occurrence key |
| 가져오기 식별키 | Rich text | `hash(sourceCalendarId + UID + instanceId)` |
| 시작 | Date | 일시+타임존 또는 종일 날짜 |
| 종료 | Date | 원본 DTEND (종일은 배타적 종료일 규칙 보존) |
| 종일 | Checkbox | 전체 날짜 이벤트 여부 |
| 타임존 | Rich text | 원본 TZID 또는 정의된 기준 |
| 장소 | Rich text | 원본 LOCATION |
| 설명 | Rich text | 원본 DESCRIPTION (서식 이스케이프, 길이 제한) |
| 상태 | Select | confirmed / tentative / cancelled 등 확인 가능한 소스 값 |
| 가져오기 일시 | Date | 마지막 업데이트 시점 |
| 가져오기 배치 | Rich text | 파일/범위를 식별하는 배치 ID |
| 원본 누락 추정 | Checkbox | 전체 범위 스냅샷 비교 시 확인 후 표시(자동 삭제 금지) |

추가 설계:
- `Diary Entries` → `Calendar Events` 선택적 Relation은 **P2에서 사용자의 승인 후** 추가. P0/P1에서는 URL 또는 외부 키 기반 연결만 검토할 수 있음.
- `Calendar Events`는 네이버 달력 자체가 아님. 앱이 마지막 `.ics` 업로드를 통해 보관한 사본임을 UI에서 분명히 알림.
- 일정은 일기와 별도 엔터티여야 한다. 네이버에서 가져온 모든 일정을 자동으로 일기 페이지로 생성하지 않는다.
- Notion은 고유 키 제약을 제공하는 일반 SQL DB처럼 취급하지 않으므로, 서버에서 동일 키 검색/직렬화/재시도/멱등성 정책을 구현하고 동시 가져오기 경합을 방어한다.

### 정규화 타입 (예시)

```ts
type ImportedCalendarEvent = {
  source: 'NAVER_ICS';
  sourceCalendarId: string;
  uid: string;
  instanceId?: string | null;
  stableKey: string;
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  timezone?: string | null;
  location?: string | null;
  description?: string | null;
  status?: 'confirmed' | 'tentative' | 'cancelled' | 'unknown';
  importBatchId: string;
};
```

## 4. ICS 파싱 규칙

- RFC 5545 대응 라이브러리 `ical.js` 또는 동등한 유지보수 라이브러리를 비교 후 결정.
- 허용 확장자 `.ics`; MIME/실제 텍스트 내용을 함께 검증. 서버 수신 제한(예: 5MB, 설정 가능), 파싱 시간·반복 확장 건수 상한 적용.
- 다중 `VEVENT` 파싱; 필드 `UID`, `SUMMARY`, `DTSTART`, `DTEND`, `LOCATION`, `DESCRIPTION`, `STATUS`, `RRULE`, `EXDATE`, `RDATE`, `RECURRENCE-ID`, `TZID` 처리.
- 타임존 있는 일정의 현지 날짜/시각 보존, UTC/Z 처리, 전체일정의 배타적 `DTEND`, DST, 한국/중국/일본 시차 구분.
- 반복 일정: 선택된 조회 기간 내에서만 확장; 예외일 및 수정된 인스턴스 적용. 무한 반복 일정은 상한 초과 시 경고, 저장 전 확인.
- 동일 원본 재가져오기: 같은 캘린더/UID/반복 인스턴스의 중복 생성 방지; 변경된 시간·제목·장소 등은 미리보기에서 차이 표시 후 upsert.
- 파일에 없는 일정은 잘못된 기간/부분 내보내기 때문일 수 있으므로 **자동으로 삭제하지 않음**. 전체 범위·동일 캘린더가 확정된 경우에만 누락 후보 표시 후 사용자가 처리 선택.
- 네이버에서 내보낸 `.ics`에는 첨부파일·범주 색상이 포함되지 않으므로 해당 정보 복원 불가 안내.
- ICS 콘텐츠는 신뢰하지 않는 외부 데이터: HTML/스크립트 실행 금지, 렌더 시 안전한 텍스트 처리, 외부 링크 검증, XSS·자원 고갈 방지.
- 파싱 오류는 파일 전체 실패/부분 성공을 구분하고 어떤 이벤트가 누락됐는지 비민감 정보 중심의 요약 제공.

## 5. 권장 코드 구조 (실제 저장소 분석 후 조정)

```text
src/
  app/
    (app)/calendar/page.tsx
    (app)/settings/calendar/page.tsx
    api/calendar/import/preview/route.ts
    api/calendar/import/commit/route.ts
  components/calendar/
    CalendarView.tsx
    CalendarFilters.tsx
    ImportedEventDetails.tsx
    IcsImportDialog.tsx
    IcsImportPreview.tsx
  lib/calendar/
    ics-parser.ts
    normalize-events.ts
    recurrence.ts
    event-identity.ts
    import-diff.ts
  lib/notion/
    notion-client.ts
    calendar-events-repository.ts
  tests/calendar/
    ics-parser.test.ts
    normalize-events.test.ts
    import-diff.test.ts
    import.integration.test.ts
    calendar.spec.ts
```

- `preview`: 인증·권한 검증 후 파일 파싱, 경고, 임시 미리보기; 서버에 원본 파일을 영구 보관하지 않음.
- `commit`: 미리보기 세션에 바인딩된 결과와 idempotency key를 검증해 쓰기; 임의 요청으로 변경 내용 주입 불가. Notion 429/529 및 Retry-After 대응.
- Notion 토큰은 **서버 환경변수에만** 저장. 클라이언트 번들/VITE_/NEXT_PUBLIC_/리포지토리/디버그 로그 노출 금지.
- 실제 저장소가 Next.js가 아니면 기존 구조를 우선하고 새 프레임워크로 무단 이관하지 않는다.

## 6. 단계별 Codex 실행 계획

### P0 — ICS 업로드 & 읽기 전용 달력 (운영 DB 미변경)
- 현재 코드와 UI 분석, 기능 범위 확인, 별도 브랜치 생성.
- 파일 업로드/파싱/미리보기/달력 렌더링/가져온 일정 상세 구현.
- fixture 데이터·mock 이벤트만 사용. Notion 쓰기 없음. 사용자 제공 ICS를 테스트 로그에 영구 저장하지 않음.
- 결과: `.ics` 업로드 시 1회 미리보기 및 달력 확인 가능. 브라우저 새로고침 후 저장을 보장하지 않음.

### P1 — 별도 Notion `Calendar Events` DB 저장
- 현재 Notion 연결 구조·권한 확인; 새 DB 스키마 초안 작성.
- **명시적 승인 후** 새 DB 생성/연결 및 페이지 권한 공유. 기존 DB는 변경하지 않음.
- 가져오기 확정, 중복 방지, Notion에서 조회, 마지막 가져오기 상태, 부분 실패 시 재시도/복구.
- 결과: 업로드해 확정한 이벤트를 Notion에 보관·여러 기기에서 조회 가능.

### P2 — 다이어리·모먼트 연결, 재가져오기
- 여행/공연/일상 필터 및 다이어리 연결, '이 일정으로 일기 작성'.
- 같은 범위 파일 재업로드 시 신규/변경/동일/누락 후보 검토, 사용자 확인 후 반영.
- 변경 내용 보존, 기존 일기 자동 삭제 금지. 연관 DB 스키마 변경은 승인 필요.

### P3 — CalDAV 연동 가능성 검증(선택)
- **조사/독립 PoC부터**, 운영 계정·운영 데이터에 직접 연결하거나 정기 자동 조회하지 않음.
- 네이버 고객센터에 공식 공개된 iOS/기타 클라이언트 CalDAV 지원 범위와, 자체 서버에서의 read-only 접속 허용·정책·호환성 검토.
- 테스트용 계정/캘린더로 목록/변경 조회 기능을 검증하고 보안성 및 운영 리스크를 보고.
- 2단계 인증 이용 시 앱 비밀번호가 필요할 수 있으며, 일반 네이버 로그인 OAuth 토큰만으로 CalDAV 조회가 가능하다고 가정하지 않음.
- 자격증명은 서버 비밀 저장소에서 암호화/교체/폐기 가능하게 설계. 브라우저에 전달하거나 평문 보관 금지.
- 검증 실패 시 ICS 수동 가져오기 방식을 정식 지원 경로로 유지. 승인 없이는 자동 동기화 구현 금지.

## 7. 필수 QA 수용 조건

| TC | 분류 | 시나리오 | 기대 결과 |
|---|---|---|---|
| CAL-01 | 정상 | 정상 ICS 1건 | 제목/일시/장소 정상 출력 |
| CAL-02 | 정상 | 여러 캘린더/다수 VEVENT | 출처 분리, 건수 일치 |
| CAL-03 | 종일 | DATE형 DTSTART/DTEND | 하루 밀림 없고 배타적 종료 처리 |
| CAL-04 | 시차 | TZID Asia/Seoul, Asia/Shanghai, Asia/Tokyo | 각각 올바른 현지 시간 표시 |
| CAL-05 | 반복 | RRULE, EXDATE, RECURRENCE-ID | 반복·예외·수정 인스턴스 정확 |
| CAL-06 | 중복 | 동일 파일 2회 | 중복 저장·표시 없음 |
| CAL-07 | 변경 | 동일 UID 제목/시간 수정 후 재가져오기 | 변경 사항을 미리보기 후 반영 |
| CAL-08 | 삭제 | 부분 기간 내보내기로 일부 이벤트 누락 | 기존 이벤트 자동 삭제 금지 |
| CAL-09 | 오류 | 손상/빈/잘못된 확장자 ICS | 안전한 오류·재시도 안내 |
| CAL-10 | 보안 | HTML/script 포함 SUMMARY/DESCRIPTION | XSS 발생하지 않음 |
| CAL-11 | 상한 | 큰 파일/무한 반복 | 자원 제한, 경고, 서비스 장애 없음 |
| CAL-12 | Notion | Notion 인증 실패, 429/529 | 실제 실패 표시, Retry-After 대응, 미저장 데이터 성공 처리 금지 |
| CAL-13 | 동작 | 달력 날짜 선택→이벤트 선택 | 읽기 전용 상세, 출처 라벨 명확 |
| CAL-14 | 격리 | 여행 A/B, 개인/공연 필터 | 다른 소스·다른 사용자의 기록 혼입 없음 |
| CAL-15 | UI | 360/375/390/430/768/1024/1440px | 레이아웃 손실·가로 오버플로 없음 |
| CAL-16 | 데이터 | 새로고침/기기 변경 | P0는 비영속 안내; P1은 Notion 영속 데이터 표시 |
| CAL-17 | 권한 | 미인증 import/Notion 쓰기 요청 | 서버 차단 |
| CAL-18 | 회귀 | 기존 Diary Entries/Moments 사용 | CRUD·연결·디자인 훼손 없음 |

## 8. Codex 전달용 마스터 프롬프트

```text
My Pastel Diary에 '기존 네이버 캘린더 일정 가져오기' 기능을 구현해 주세요.
첨부 MY_PASTEL_DIARY_NAVER_CALENDAR_IMPORT_CODEX_PLAN.md를 요구사항/QA 기준으로 사용하세요.

목표는 기존 네이버 일정을 앱의 캘린더 화면에서 읽기 전용으로 확인하는 것입니다.
네이버 공개 개발자 캘린더 API는 일정 추가 기능만 공식 문서화되어 있으므로,
OAuth 로그인만으로 기존 이벤트를 조회한다고 가정하거나 비공식 네이버 웹 API를 호출하지 마세요.

1) 현재 저장소 기술 스택, 인증 구조, 기존 Diary Entries/Moments 및 Notion 연결부를 조사해 주세요.
2) 공식적으로 지원되는 경로인 '네이버 PC 웹에서 ICS 내보내기 → My Pastel Diary에서 ICS 업로드'를 P0 구현 기준으로 하세요.
3) P0에서 ICS 업로드, 파싱, 기간 내 반복 전개, 타임존/종일 일정 처리, 중복 미리보기, 캘린더 읽기 전용 표시, 오류/빈 상태, 반응형 UI를 구현하세요.
4) `ical.js` 같은 유지보수 중인 RFC 5545 파서의 적합성을 확인하세요. 직접 작성한 간이 문자열 파서로 반복/시간대 처리를 대체하지 마세요.
5) 이번 P0에서는 Notion 원본 DB의 스키마와 데이터를 수정하지 말고, 실제 이벤트를 저장하지 마세요. 샘플 fixture로 자동화 테스트를 작성하세요.
6) P1에서 사용할 신규 Notion `Calendar Events` DB 속성/권한/데이터 매핑 설계안을 문서화해 주세요. DB 생성과 실제 데이터 쓰기는 별도 명시적 승인 후 진행하세요.
7) P2의 Diary Entries/Moments 연결 및 재가져오기, P3의 CalDAV 조사/PoC는 별도 PR로 나누세요.
8) CalDAV는 네이버 공식 안내가 iOS 등 클라이언트 사용을 설명할 뿐 자체 웹 백엔드의 호환성이나 읽기 권한이 보장된다는 의미가 아닙니다. 실제 운영 자동 동기화 가능하다고 보고하지 마세요.
9) 인증 실패 차단, 파일 검사/용량 제한, XSS 방어, 서버 비밀키 보호, 파싱 제한, 타 사용자 데이터 격리, Notion rate limit을 고려하세요.
10) lint, typecheck, unit test, Playwright 주요 시나리오, build를 실행하고 실제 실행 결과를 보고하세요.

먼저 수정 대상 파일 목록과 단계별 구현 계획을 보고한 다음 새 브랜치에서 P0만 구현하세요.
기존 Diary/Notion 데이터에 영향을 줄 수 있는 변경은 하지 마세요.
완료 보고서에는 공식 지원/비지원 범위, 테스트 증빙, 잔여 제약, 다음 단계 PR 제안을 포함하세요.
자동 병합·운영 배포는 하지 마세요.
```

## 9. 사용자에게 알려야 할 제약

- 파일 `.ics`를 매번 직접 내려받아 올려야 변경된 최신 일정이 반영됩니다.
- 네이버 캘린더에서 수정·삭제한 일정은 다시 가져오기 전에는 앱에 반영되지 않습니다.
- 내보낸 `.ics`에는 첨부파일과 범주 색상이 포함되지 않습니다.
- Notion으로 옮긴 사본은 네이버 앱에서 관리되는 원본과 다른 별개의 데이터입니다.
- CalDAV 실험은 별도 안전성 검토가 필요하며 처음부터 자동 양방향 연동으로 광고하지 않습니다.
