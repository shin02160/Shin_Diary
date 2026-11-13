import { timelineDay } from './activity-timeline.ts';
import { archiveCalendarEndDay, type ArchiveCalendarEvent } from './calendar/archive.ts';
import { confirmedLesson } from './calendar/classification.ts';
import type { CatalogItem } from './universe-catalog.ts';

export function interestMonths(activities: CatalogItem[], events: ArchiveCalendarEvent[], today: string) {
 const months = new Map<string, { month: string; activities: number; schedules: number; completed: number }>();
 const seen = new Set<string>();
 const completed = new Set<string>();
 function monthOf(day: string) {
  const month = day.slice(0, 7);
  const row = months.get(month) ?? { month, activities: 0, schedules: 0, completed: 0 };
  months.set(month, row);
  return row;
 }
 for (const activity of activities) {
  const day = timelineDay(activity.startAt);
  const id = 'activity:' + activity.sourcePageId.replaceAll('-', '').toLowerCase();
  if (!day || seen.has(id)) continue;
  seen.add(id);
  const row = monthOf(day);
  row.activities++;
  if (activity.status === 'done' && day <= today && (timelineDay(activity.endAt) ?? day) <= today) {
   completed.add(id + ':' + day);
   row.completed++;
  }
 }
 for (const event of events) {
  const day = event.wallStart.slice(0, 10);
  const id = 'schedule:' + event.importKey;
  if (seen.has(id)) continue;
  seen.add(id);
  const row = monthOf(day);
  row.schedules++;
  if (!confirmedLesson(event, today) || archiveCalendarEndDay(event) > today) continue;
  const lesson = 'lesson:' + day;
  if (completed.has(lesson)) continue;
  completed.add(lesson);
  if (event.activityIds?.some(id => completed.has('activity:' + id.replaceAll('-', '').toLowerCase() + ':' + day))) continue;
  row.completed++;
 }
 return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}
