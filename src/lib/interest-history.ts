import { timelineDay } from './activity-timeline.ts';
import { interestLinks } from './interest-links.ts';
import { gptReviewId } from './wiki-review.ts';
import type { Interest } from './interests.ts';
import { catalogLabels, type CatalogItem } from './universe-catalog.ts';

// Dated records that show the interest, oldest first. Schedules, plans and generated reviews are not evidence of taste.
export function tasteEvidence(interest: Interest, items: CatalogItem[], today: string, approved: string[] = [], dismissed: string[] = []) {
 const hidden = new Set(dismissed);
 const eligible = items.filter(item => {
  const day = timelineDay(item.startAt);
  return day && day <= today && item.sourceType !== 'calendar' && item.status !== 'cancelled' && item.status !== 'planned' &&
   item.entry?.id !== gptReviewId(day.slice(0, 7));
 });
 return interestLinks(interest, eligible, approved)
  .filter(row => row.confirmed || !hidden.has(row.item.key))
  .map(row => ({ ...row, day: timelineDay(row.item.startAt)! }))
  .sort((a, b) => a.day.localeCompare(b.day));
}

// Describes only what the records show: first sighting, gaps between years and new record types.
export function tasteClues(rows: { item: CatalogItem; day: string }[]) {
 const labels = new Map<string, string[]>();
 const years: string[] = [];
 const kinds: CatalogItem['kind'][] = [];
 const gaps: [from: string, to: string][] = [];
 rows.forEach((row, index) => {
  const year = row.day.slice(0, 4);
  const previous = years.at(-1);
  const found: string[] = [];
  const typed = row.item.kind !== 'uncategorized';
  if (!index) found.push('기록에서 처음 확인됨');
  else {
   if (previous && Number(year) - Number(previous) > 1) {
    gaps.push([String(Number(previous) + 1), String(Number(year) - 1)]);
    found.push(previous + '년 이후 관련 기록이 없다가 다시 나타남');
   }
   if (typed && !kinds.includes(row.item.kind)) found.push(catalogLabels[row.item.kind] + ' 기록으로 처음 나타남');
  }
  if (previous !== year) years.push(year);
  if (typed && !kinds.includes(row.item.kind)) kinds.push(row.item.kind);
  if (found.length) labels.set(row.item.key, found);
 });
 return { labels, years, kinds, gaps, firstDay: rows[0]?.day };
}
