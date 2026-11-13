import { Temporal } from '@js-temporal/polyfill';

export type ScheduleState = 'completed' | 'upcoming' | 'cancelled' | 'unknown';
export const scheduleLabels: Record<ScheduleState, string> = {
 completed: '완료', upcoming: '예정', cancelled: '취소', unknown: '상태 미확인',
};
export const scheduleActivityStatus = {
 completed: 'done', upcoming: 'planned', cancelled: 'cancelled', unknown: 'unknown',
} as const;

export interface ScheduleInput {
 rawStatus?: string; status?: string; sourceStatus?: string;
 wallStart: string; wallEnd?: string; allDay?: boolean; endExclusive?: boolean;
 originalTimezone?: string; endInstant?: string;
}

export function deriveScheduleState(event: ScheduleInput, now: number): ScheduleState {
 if ([event.rawStatus, event.sourceStatus, event.status].some(value =>
  /^(cancelled|canceled|취소|취소됨)$/i.test(value?.trim() ?? ''))) return 'cancelled';
 try {
  const end = event.wallEnd || event.wallStart;
  const zone = event.originalTimezone || 'Asia/Seoul';
  let boundary: number;
  if (event.allDay ?? /^\d{4}-\d{2}-\d{2}$/.test(event.wallStart)) {
   const date = Temporal.PlainDate.from(end);
   const exclusive = Boolean(event.wallEnd && end !== event.wallStart && event.endExclusive !== false);
   boundary = (exclusive ? date : date.add({ days: 1 })).toZonedDateTime(zone).epochMilliseconds;
   return boundary <= now ? 'completed' : 'upcoming';
  }
  const absolute = event.endInstant || (/(?:Z|[+-]\d{2}:\d{2})$/i.test(end) ? end : undefined);
  boundary = absolute ? Temporal.Instant.from(absolute).epochMilliseconds :
   Temporal.PlainDateTime.from(end).toZonedDateTime(zone, { disambiguation: 'reject' }).epochMilliseconds;
  return boundary < now ? 'completed' : 'upcoming';
 } catch { return 'unknown'; }
}
