# v2 구현 계획 및 격차

기준 브랜치는 codex/diary, 시작 커밋은 2258469다. README 및 이전 재설계 명세와 현재 API·화면·테스트를 확인했다. 현재 코드는 경험일 비교, 전체 Notion 블록 리더, 관심사 확정/추천 및 활동 화면 구분을 이미 제공한다. 캘린더의 시간 정렬, 데이터 실패 재시도, 시계열 연결 근거와 전문 독서 이동은 보완 대상이다.

| 단계 | 변경 대상 | 범위 |
| --- | --- | --- |
| Stage 0 | docs/*_V2.md | 기준과 정책, 구현 격차, 검증 기록 |
| P0 | activity-view, universe-catalog, notion-archive-home | 캘린더 시각 및 Import Key, 실제 참여 플래그 |
| P1 | activity-timeline, interests-view, wiki-archive, globals.css | 관심사 필터, 활동 리포트 역할, 같은 분류의 이전·다음, 재시도 |
| P2 | interest-history, activity-timeline, v2-archive.test | 증거 목록 및 지속·재등장·유형 확장 표시 |

의존 관계는 P0 공통 모델 → P1 표시 → P2 증거 집계다. 화면과 순수 조회 로직을 이전 버전으로 되돌릴 수 있으며 Notion 마이그레이션은 없다. 남은 작업은 QA 보고서에서 추적한다.
