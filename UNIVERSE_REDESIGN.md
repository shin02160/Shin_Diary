# Youngshin’s Universe 모바일 개편

## 화면 및 변경 파일

| 범위 | 파일 |
|---|---|
| 브랜드와 모바일 하단 탭 | src/app/layout.tsx, src/components/navigation.tsx, src/components/icon.tsx, src/app/globals.css, public/favicon.ico, public/youngshin-universe.png |
| 홈, 탐색, 전체 메뉴, 위키 진입 | src/app/page.tsx, src/app/explore/page.tsx, src/app/more/page.tsx, src/app/wiki/page.tsx, src/components/local-home.tsx, src/components/notion-archive-home.tsx |
| Notion 카드와 데이터 매핑 | src/components/notion-collections.tsx, src/lib/universe-catalog.ts, src/lib/notion-collections.ts, src/lib/server/notion-collections.ts |
| 저장 상태와 오류 표시 | src/components/archive-notice.tsx |
| 검증 | tests/notion/universe-catalog.test.ts, scripts/verify-universe-ui.js |
| 개편 보고 | UNIVERSE_REDESIGN.md |

## 데이터 매핑

| 원본 | 카드 분류 | 표시 정보 |
|---|---|---|
| Notion 여행 마스터 | 여행 | 여행명, 여행기간 |
| Notion 공연 | 공연 | 공연명, 날짜, 도시·장소, 아티스트, 비고, 페이지 커버 |
| Entries 또는 브라우저 기록 | 해당 카테고리의 기록 | 제목, 경험 날짜, 본문 요약, 장소, 감정, 태그, 첨부 사진 |
| Activities 또는 브라우저 활동 | 해당 카테고리의 활동 | 활동명, 설명, 태그, 재개 메모 |

2026-11-13 제품 감사 명세를 반영해 최근 기록은 경험 시작일 내림차순으로 표시합니다. 수정 시각은 경험 날짜와 시각이 같을 때만 사용합니다. Notion은 원본 저장소이며 앱은 기록을 감상하고 분석하는 화면입니다. 검색 대상은 제목, 장소, 태그 및 카드의 표시 속성입니다. 지정된 Notion 위키 페이지는 기존 페이지 탐색 화면에서 엽니다. 시작 페이지를 비워 두면 통합 보관함이 열립니다.

## 검증

- 동일한 테스트 응답으로 개편 전후 홈을 390px와 1440px에서 캡처했습니다. 캡처 파일은 artifacts/wiki-before-390.png, artifacts/wiki-after-390.png, artifacts/wiki-before-1440.png, artifacts/wiki-after-1440.png입니다.
- 320, 375, 390, 430, 768, 1024, 1440px에서 주요 경로 7개를 확인했습니다. 활성 탭과 본문 여백, 가로 넘침, 검색 초점, 필터 및 키보드 목록 전환을 검증했습니다.
- 실제 Notion 여행 2건, 여행 일정 12건, 공연 68건을 조회했습니다. 해당 응답의 페이지 커버는 0건입니다.
- lint, typecheck, 자동 테스트 44개, 프로덕션 빌드가 통과했습니다.

## 이번 구현 범위

리본과 별 로고는 간단한 임시 자산입니다. 본문에는 설치된 시스템 글꼴을 사용합니다. 여행·공연 카드의 링크는 Notion 원본을 열며, 앱 내 상세 화면, 즐겨찾기와 최근 열람은 후속 범위입니다.
