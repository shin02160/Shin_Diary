import { timelineDay } from './activity-timeline.ts';
import { interestLinks } from './interest-links.ts';
import type { Interest } from './interests.ts';
import type { CatalogItem } from './universe-catalog.ts';

export function interestHistory(interest: Interest, items: CatalogItem[], year: string, today: string) {
 const eligible = items.filter(item =>
  item.sourceType !== 'calendar' && item.status !== 'cancelled' && item.status !== 'planned');
 const evidence = interestLinks(interest, eligible, []).flatMap(row => {
  const day = timelineDay(row.item.startAt);
  return day && day <= today ? [{ ...row, day }] : [];
 });
 const moments = evidence.filter(row => row.day.startsWith(year + '-'));
 if (!moments.length) return;
 const years = [...new Set(evidence.map(row => row.day.slice(0, 4)))].sort();
 const index = years.indexOf(year);
 const earlierKinds = new Set(evidence.filter(row => row.day.slice(0, 4) < year).map(row => row.item.kind));
 const expanded = index > 0 && moments.some(row => !earlierKinds.has(row.item.kind));
 const label = index === 0 ? '조회 범위의 기록에서 처음 확인됨' :
  Number(year) - Number(years[index - 1]) > 1 ? '관련 기록이 없던 해를 지나 다시 나타남' : '여러 해에 걸쳐 관련 기록이 이어짐';
 return { label: expanded ? label + ' · 새 유형의 관련 기록이 나타남' : label, moments };
}
