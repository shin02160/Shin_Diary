import type { Interest } from './interests.ts';
import type { CatalogItem } from './universe-catalog.ts';

export function interestHistory(interest: Interest, rows: { item: CatalogItem; day: string }[], year: string) {
 const related = new Set(interest.relatedPageIds);
 const months = new Map<string, number>();
 for (const { item, day } of rows) {
  if (!item.interestIds.includes(interest.id) &&
   !(item.originalUrl && related.has(item.sourcePageId.replaceAll('-', '').toLowerCase()))) continue;
  const month = day.slice(0, 7);
  months.set(month, (months.get(month) ?? 0) + 1);
 }
 const activeYears = [...new Set([...months.keys()].map(month => month.slice(0, 4)))].sort();
 const index = activeYears.indexOf(year);
 if (index < 0) return;
 const label = index === 0 ? '조회 범위에서 처음 확인' :
  Number(year) - Number(activeYears[index - 1]) > 1 ? '기록이 다시 나타남' : '이어진 기록';
 return { label, months: [...months].filter(([month]) => month.startsWith(year + '-')).sort(([a], [b]) => a.localeCompare(b)) };
}
