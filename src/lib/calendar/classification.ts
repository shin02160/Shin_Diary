export const calendarTypeLabels = {
 exercise: '운동', appointment: '약속', concert: '공연', travel: '여행', work: '업무', other: '기타', unknown: '일정',
} as const;
export type CalendarType = keyof typeof calendarTypeLabels;

const rules = {
 exercise: /필라테스|요가|헬스|운동|수영|러닝|테니스|\b(?:pilates|yoga|workout|gym)\b/i,
 appointment: /친구|약속|모임|회식|데이트|\b(?:appointment|meetup)\b/i,
 concert: /공연|콘서트|뮤지컬|팬미팅|페스티벌|&con\d|\b(?:concert|musical|gig)\b/i,
 travel: /여행|항공편|공항|체크인|체크아웃|숙소|\b(?:travel|flight|airport|hotel)\b/i,
 work: /업무|출근|출장|회의|면접|마감|\b(?:work|business|deadline)\b/i,
 other: /기타 일정|^기타$|^other$/i,
} satisfies Record<Exclude<CalendarType, 'unknown'>, RegExp>;

function match(text: string) {
 const found = (Object.keys(rules) as (keyof typeof rules)[]).filter(type => rules[type].test(text));
 return found.length === 1 ? found[0] : found.length ? 'unknown' : undefined;
}

export function calendarType({ sourceName, title, description }: { sourceName?: string; title: string; description?: string }): CalendarType {
 return match(title.trim()) ?? match(sourceName?.trim() ?? '') ?? match(description?.trim() ?? '') ?? 'unknown';
}

const verifiedPilates = new Set(['2026-10-07', '2026-10-12', '2026-10-15', '2026-10-22', '2026-10-27']);

export function confirmedLesson(event: { title: string; wallStart: string; status: string }, today: string) {
 const day = event.wallStart.slice(0, 10);
 return event.status !== 'cancelled' && day <= today && verifiedPilates.has(day) &&
  /^(?:필라테스|pilates)(?:\s*(?:레슨|수업))?$/i.test(event.title.trim());
}
