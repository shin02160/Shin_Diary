import { compareExperience } from './experience-order.ts';
import { timelineCalendarMatches, timelineSourceLinks } from './activity-timeline.ts';
import type { Interest } from './interests.ts';
import type { CatalogItem } from './universe-catalog.ts';

// The names a subject goes by in titles and tags, lower-cased: its own name, the same name without
// punctuation ("N.Flying" is also written "Nflying"), and the aliases recorded for it in Notion.
export function interestTerms(name: string, aliases: string[] = []) {
 const terms = [name, ...aliases].flatMap(value => {
  const text = value.normalize('NFKC').toLowerCase().trim();
  const compact = text.replace(/[^a-z0-9가-힣]/g, '');
  return [text, ...(compact.length >= 3 ? [compact] : [])];
 });
 return [...new Set(terms.filter(term => term.length >= 2))];
}

// Latin names must stand alone as a word; Korean names may sit inside a longer word.
export function matchesTerms(terms: string[], value?: string) {
 const text = value?.normalize('NFKC').toLowerCase() ?? '';
 return terms.some(term => {
  const escaped = term.replace(/[^a-z0-9가-힣 ]/gi, character => String.fromCharCode(92) + character);
  return /^[a-z]/.test(term) ? new RegExp('(?:^|[^a-z0-9])' + escaped + '(?:$|[^a-z0-9])').test(text) : text.includes(term);
 });
}

export function interestLinks(interest: Interest, items: CatalogItem[], approved: string[]) {
 const ids = new Set(interest.relatedPageIds);
 const pageId = (item: CatalogItem) => item.sourcePageId.replaceAll('-', '').toLowerCase();
 const pages = new Map(items.filter(item => item.originalUrl).map(item => [pageId(item), item]));
 const calendars = timelineCalendarMatches(items);
 const confirmed = new Set(approved);
 const terms = interestTerms(interest.name, interest.aliases);
 const matches = (value?: string) => matchesTerms(terms, value);
 const linked = items.flatMap(item => {
  const direct = item.interestIds.includes(interest.id) || (item.originalUrl && ids.has(pageId(item)));
  const evidence = direct ? 'Notion 관계' : confirmed.has(item.key) ? '직접 승인' :
   matches(item.title) ? '제목' : matches(item.detail) ? '아티스트 또는 상세 정보' :
   item.tags.some(matches) ? '태그' : matches(item.summary) ? '본문 또는 요약' : '';
  return evidence ? [{ item, evidence, confirmed: Boolean(direct || confirmed.has(item.key)), sources: [item] }] : [];
 });
 const found = new Set(linked.map(row => row.item.key));
 for (const item of items) {
  if (found.has(item.key)) continue;
  if (timelineSourceLinks(item, pages).some(target => found.has(target.key))) {
   linked.push({ item, evidence: '관련 기록의 Notion 링크', confirmed: false, sources: [item] });
  }
 }
 linked.sort((a,b) => compareExperience(a.item,b.item));
 // An explicit calendar occurrence link establishes identity. Other source links can be context.
 const groups = new Map<string, typeof linked>();
 for (const row of linked) {
  const key = calendars.get(row.item.key)?.key ?? row.item.key;
  const group = groups.get(key) ?? [];
  group.push(row);
  groups.set(key, group);
 }
 return [...groups.values()].map(group => {
  const best = group.find(row => row.evidence === 'Notion 관계') ?? group.find(row => row.confirmed) ?? group.find(row => row.item.entry) ?? group[0];
  return { ...best, sources: group.map(row => row.item) };
 }).sort((a,b) => compareExperience(a.item,b.item));
}
