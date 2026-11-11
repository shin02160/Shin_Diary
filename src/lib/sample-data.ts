import type { Activity, CalendarEvent, Category, Entry, LifecycleStatus } from './types';
export const categoryLabels: Record<Category, string> = { Travel: '여행', Concert: '공연', Projects: '프로젝트', Daily: '일상' };
export const statusLabels: Record<LifecycleStatus, string> = { interested: '관심 있음', active: '경험 중', parked: '잠시 보관', satisfied: '만족 완료' };
export const activities: Activity[] = [
  { id: 'a-kyoto', name: '교토에서 느리게 걷기', category: 'Travel', lifecycleStatus: 'satisfied', isArchived: false, summary: '유명한 곳보다 동네의 작은 순간을 모은 여행.', tags: ['산책', '동네'] },
  { id: 'a-diary', name: '나만의 작은 우주 만들기', category: 'Projects', lifecycleStatus: 'active', isArchived: false, summary: '기억을 쌓고, 멈춘 곳에서 다시 시작하는 공간.', lastProgress: '어떤 경험을 남기고 싶은지 정리했다.', nextStep: '마음에 드는 화면을 살펴보고 기록 흐름을 생각하기.', tags: ['디자인', '코딩'] },
  { id: 'a-photo', name: '필름 사진 산책', category: 'Daily', lifecycleStatus: 'parked', isArchived: false, summary: '일상의 빛과 계절을 천천히 담기.', lastProgress: '가을 산책 사진 중 마음에 드는 세 장을 골랐다.', nextStep: '지난 사진 한 장을 골라 짧은 감상을 남기기.', parkedAt: '2026-11-05', tags: ['사진', '산책'] },
  { id: 'a-concert', name: '가을밤의 라이브', category: 'Concert', lifecycleStatus: 'satisfied', isArchived: false, summary: '좋아하는 노래를 함께 부른 저녁.', tags: ['라이브', '음악'] },
];
export const entries: Entry[] = [
  { id: 'e-1', title: '작은 시작도 기록이 되니까', content: '완벽하게 정리하지 않아도 괜찮다. 오늘은 나만의 공간에 첫 문장을 남기는 상상을 했다.', occurredAt: { kind: 'date', date: '2026-11-11' }, createdAt: '2026-11-11T00:00:00Z', activityId: 'a-diary', category: 'Projects', mood: '설렘', tags: ['작은 시작'] },
  { id: 'e-2', title: '돌아가는 길의 따뜻한 빛', content: '조금 돌아서 걸었더니 조용한 골목을 만났다. 노란 창문과 차가운 저녁 공기가 오래 기억날 것 같다.', occurredAt: { kind: 'date', date: '2026-11-09' }, createdAt: '2026-11-09T11:00:00Z', category: 'Daily', mood: '평온', place: '동네 골목', tags: ['산책', '가을'] },
  { id: 'e-3', title: '마지막 곡이 끝나고', content: '앵콜을 기다리며 모두가 같은 멜로디를 흥얼거렸다. 오늘은 그 순간 하나면 충분했다.', occurredAt: { kind: 'zoned', instant: '2026-11-07T12:00:00Z', timezone: 'Asia/Seoul' }, createdAt: '2026-11-07T13:00:00Z', activityId: 'a-concert', category: 'Concert', mood: '벅참', place: '라이브홀', tags: ['음악', '라이브'] },
  { id: 'e-4', title: '이름 모를 작은 찻집', content: '걷다가 들어간 찻집. 창가에 앉아 아무 계획 없이 오후를 보냈다.', occurredAt: { kind: 'zoned', instant: '2026-10-24T05:00:00Z', timezone: 'Asia/Tokyo' }, createdAt: '2026-10-24T09:00:00Z', activityId: 'a-kyoto', category: 'Travel', mood: '느긋함', place: '교토', tags: ['찻집', '동네'] },
];
export const calendarEvents: CalendarEvent[] = [
  { id: 'c-1', source: 'NAVER_ICS', sourceCalendarId: 'sample-calendar', uid: 'sample-walk', title: '주말 동네 산책', start: { kind: 'date', date: '2026-11-14' }, end: { kind: 'date', date: '2026-11-15' }, endExclusive: true, isSample: true },
  { id: 'c-2', source: 'NAVER_ICS', sourceCalendarId: 'sample-calendar', uid: 'sample-concert', title: '저녁 공연', start: { kind: 'zoned', instant: '2026-11-21T10:00:00Z', timezone: 'Asia/Seoul' }, endExclusive: false, location: '라이브홀', isSample: true },
];
