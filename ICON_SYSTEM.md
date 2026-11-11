# Shin_Diary 아이콘 시스템

기능 아이콘은 Lucide React를 사용합니다. 별, 달, 궤도와 브랜드 장식은 기존 파스텔 우주 테마를 유지합니다.

## 아이콘 매핑

| 구분 | 사용 위치 | Lucide |
|---|---|---|
| 메뉴 | 홈 · 추억 · WIKI | House · BookHeart · BookOpen |
| 메뉴 | 캘린더 · 컬렉션 · 이어서 하기 · 설정 | CalendarDays · Bookmark · CirclePlay · SlidersHorizontal |
| 탐색 | 검색 · 필터 · 이전 달 · 다음 달 | Search · Filter · ChevronLeft · ChevronRight |
| 탐색 | 뒤로 · 다음 단계 · 자세히 보기 · 더 보기 | ArrowLeft · ArrowRight · ArrowUpRight · ChevronDown |
| 카테고리 | 여행 · 공연 · 프로젝트 · 일상 | Plane · Music2 · BriefcaseBusiness · Coffee |
| 활동 상태 | 관심 있음 · 경험 중 · 잠시 보관 · 만족 완료 | Heart · CirclePlay · CirclePause · CircleCheck |
| 위키 상태 | 완료 · 미완료 | SquareCheck · Square |
| 상태 안내 | 보관 · 빈 화면 · 오류 | Archive · Inbox · CircleAlert |
| 기록 작업 | 추가 · 편집 · 장소 · 사진 첨부 | Plus · Pencil · MapPin · ImagePlus |
| 기록 자료 | 기록 · 관련 링크 · Notion 원본 열기 | FileText · Link2 · ArrowUpRight |
| 백업 및 파일 | 백업 · 다운로드 · 업로드 · 복원/새로 불러오기 | ArrowDownToLine · Download · Upload · RotateCcw |
| Notion | 불러오기 · 반영 · 로그인 · 로그아웃 | CloudDownload · CloudUpload · LogIn · LogOut |
| 접속 | 잠금 · 비밀번호 보기 · 숨기기 · 설정 바로가기 | LockKeyhole · Eye · EyeOff · UserRound |

기본 아이콘은 20px이며 강조 아이콘은 24px입니다. 작은 아이콘은 텍스트와 상태 표시에서 사용합니다. 선 굵기는 1.75입니다. 메뉴의 라운드 배경은 데스크톱에서 42px, 모바일에서 40px입니다. 활성 메뉴는 아이콘 외에도 글자 색과 굵기, 배경, aria-current 속성으로 구분합니다. 장식 SVG는 접근성 트리에서 숨기고, 이전·다음 달과 비밀번호 토글의 동작 이름은 버튼에 지정합니다.

## 변경 파일

| 범위 | 파일 |
|---|---|
| 의존성 | package.json, package-lock.json |
| 공통 아이콘과 화면 틀 | src/components/icon.tsx, src/components/navigation.tsx, src/app/globals.css, src/app/layout.tsx, src/app/not-found.tsx |
| 홈 및 Notion 보관함 | src/components/local-home.tsx, src/components/notion-archive-home.tsx, src/components/notion-collections.tsx, src/components/record-reminder.tsx |
| 추억과 기록 | src/app/memories/rediscover/page.tsx, src/app/memories/review/page.tsx, src/components/cards.tsx, src/components/capture-form.tsx, src/components/explorer.tsx, src/components/monthly-review.tsx, src/components/source-link-preview.tsx |
| 활동과 이어서 하기 | src/components/activity-detail.tsx, src/components/activity-review.tsx, src/components/resume-card.tsx |
| 캘린더 | src/components/calendar.tsx, src/components/calendar-notion.tsx, src/components/ics-import.tsx |
| 설정과 잠금 | src/components/archive-notice.tsx, src/components/local-settings.tsx, src/components/notion-settings.tsx, src/components/site-unlock.tsx |
| 위키 표시 | src/components/notion-wiki.tsx, src/lib/wiki.ts, src/lib/server/notion-wiki.ts |
| 작업 보고 | ICON_SYSTEM.md |

위키 체크 상태는 읽기 응답의 불리언 값으로 전달합니다. Notion의 속성이나 저장 데이터를 변경하지 않습니다.

## 검증

- Playwright에서 320, 360, 390, 768, 1024, 1440px로 주요 메뉴 7개 화면을 확인했습니다.
- 메뉴의 활성 상태, 가로 넘침, 아이콘 크기와 선 굵기, 장식 SVG의 접근성 속성을 확인했습니다.
- Tab과 Enter를 사용한 메뉴 이동, Enter와 Space를 사용한 캘린더 월 이동과 비밀번호 토글, 위키의 완료·미완료 표시를 확인했습니다.
- lint, typecheck, 자동 테스트 43개, 프로덕션 빌드가 통과했습니다.
