export interface CalendarEntryLink {
  id: string;
  title: string;
  date: string;
  period: string;
  sourceName: string;
  location?: string;
}

export const calendarEntryProperty = 'Calendar Event';
export const eventDraftKey = (token: string) => 'mlu.capture.event.' + token;

export function isCalendarEntryLink(value: unknown): value is CalendarEntryLink {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const text = (key: string, limit: number) =>
    typeof item[key] === 'string' && item[key].trim().length > 0 && item[key].length <= limit;
  return Object.keys(item).every(key => ['id', 'title', 'date', 'period', 'sourceName', 'location'].includes(key))
    && text('id', 7500) && text('title', 500) && text('period', 300) && text('sourceName', 80)
    && typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && Number.isFinite(Date.parse(item.date)) && new Date(item.date).toISOString().slice(0, 10) === item.date
    && (item.location === undefined || (typeof item.location === 'string' && item.location.length <= 2000));
}
