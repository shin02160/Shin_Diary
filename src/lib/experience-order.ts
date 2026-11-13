import { Temporal } from '@js-temporal/polyfill';
import type { ExperienceDate } from './types.ts';

export function experienceKey(value?: ExperienceDate) {
 if (!value) return '';
 try {
  if (value.kind === 'date') return Temporal.PlainDate.from(value.date).toString();
  if (value.kind === 'floating') return Temporal.PlainDateTime.from(value.local).toString();
  return Temporal.Instant.from(value.instant).toZonedDateTimeISO(value.timezone).toPlainDateTime().toString();
 } catch { return ''; }
}

export function compareExperience(
 a: { startAt?: ExperienceDate; updatedAt?: string; sourceType: string; sourcePageId: string },
 b: { startAt?: ExperienceDate; updatedAt?: string; sourceType: string; sourcePageId: string },
) {
 const dateOrder = experienceKey(b.startAt).localeCompare(experienceKey(a.startAt));
 const updatedA = Date.parse(a.updatedAt ?? '');
 const updatedB = Date.parse(b.updatedAt ?? '');
 return dateOrder || (Number.isFinite(updatedB) ? updatedB : 0) - (Number.isFinite(updatedA) ? updatedA : 0) ||
  (a.sourceType + ':' + a.sourcePageId).localeCompare(b.sourceType + ':' + b.sourcePageId);
}
