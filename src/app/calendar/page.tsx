import { Calendar } from '@/components/calendar';
import { PageHeading } from '@/components/cards';
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string | string[]; event?: string | string[] }> }) {
 const { date: requested, event } = await searchParams;
 const date = typeof requested === 'string' && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(requested)
   && Number.isFinite(Date.parse(requested)) && new Date(requested).toISOString().slice(0, 10) === requested ? requested : undefined;
 return <><PageHeading eyebrow="CALENDAR" title="날짜 사이에 담긴 이야기">경험한 순간과 앞으로의 일정을 함께 살펴봐요.</PageHeading><Calendar remote={process.env.DIARY_NOTION_READ_ONLY === 'true'} date={date} eventId={typeof event === 'string' && /^[a-f0-9]{32}$/i.test(event) ? event.toLowerCase() : undefined}/></>; }
