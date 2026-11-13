import { timelineDay } from './activity-timeline.ts';
import { interestTerms, matchesTerms } from './interest-links.ts';
import type { Interest } from './interests.ts';
import type { CatalogItem } from './universe-catalog.ts';
import { gptReviewId, reviewMonth } from './wiki-review.ts';

export interface EraSubject { key: string; name: string; interestId?: string; days: number; firstSeen: boolean; records: CatalogItem[] }
export interface TasteEra {
 from: string; to: string;
 subjects: EraSubject[];
 places: [name: string, count: number][];
 cities: [name: string, count: number][];
 keywords: [name: string, count: number][];
 records: number;
}

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const ranked = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
const bump = (counts: Map<string, number>, name?: string) => { if (name?.trim()) counts.set(name.trim(), (counts.get(name.trim()) ?? 0) + 1); };

// What the records of each period are about: who appears in them, where they took place and how they were tagged.
// Consecutive years led by the same subject form one era. Counts are days with a record, not a measure of affection.
export function tasteEras(items: CatalogItem[], interests: Interest[], today: string): TasteEra[] {
 const subjects = new Map<string, { name: string; interestId?: string; terms: string[] }>();
 for (const interest of interests) subjects.set(normalize(interest.name), { name: interest.name, interestId: interest.id, terms: interestTerms(interest.name, interest.aliases) });
 const aliases = new Map([...subjects].flatMap(([key, subject]) => subject.terms.map(term => [normalize(term), key] as const)));
 const subjectKey = (artist: string) => {
  const key = normalize(artist);
  if (!key) return;
  const known = subjects.has(key) ? key : aliases.get(key);
  if (known) return known;
  // Very short names would match unrelated titles, so they count only where the artist field names them.
  subjects.set(key, { name: artist.trim(), terms: key.length >= 3 ? [artist.trim().toLowerCase()] : [] });
  return key;
 };
 const artists = (item: CatalogItem) => item.sourceType === 'performances' ? (item.detail ?? '').split(',').flatMap(name => subjectKey(name) ?? []) : [];
 const past = items.flatMap(item => {
  const day = timelineDay(item.startAt);
  return day && day <= today && item.sourceType !== 'calendar' && item.status !== 'planned' && item.status !== 'cancelled' &&
   !(item.entry && (reviewMonth(item.entry) || item.entry.id === gptReviewId(day.slice(0, 7)))) ? [{ item, day, named: artists(item) }] : [];
 }).sort((a, b) => a.day.localeCompare(b.day));

 const years = new Map<string, {
  subjects: Map<string, { days: Set<string>; records: CatalogItem[] }>;
  places: Map<string, number>; cities: Map<string, number>; keywords: Map<string, number>; records: number;
 }>();
 for (const { item, day, named } of past) {
  const year = years.get(day.slice(0, 4)) ?? { subjects: new Map(), places: new Map(), cities: new Map(), keywords: new Map(), records: 0 };
  years.set(day.slice(0, 4), year);
  year.records++;
  const hits = item.sourceType === 'performances' ? named : [...subjects].flatMap(([key, subject]) =>
   [item.title, item.detail, ...item.tags].some(text => matchesTerms(subject.terms, text)) ? [key] : []);
  for (const key of new Set(hits)) {
   const row = year.subjects.get(key) ?? { days: new Set<string>(), records: [] };
   row.days.add(day);
   row.records.push(item);
   year.subjects.set(key, row);
  }
  if (item.sourceType === 'trips') for (const place of (item.location ?? '').split('·')) bump(year.places, place);
  else if (item.sourceType === 'performances') bump(year.cities, item.location?.split('·')[0]);
  else if (item.kind === 'travel') bump(year.places, item.location?.split('·')[0]);
  for (const tag of item.tags) bump(year.keywords, tag);
 }

 const eras: TasteEra[] = [];
 const leads = new Map<TasteEra, string | undefined>();
 const seen = new Set<string>();
 for (const [year, data] of [...years].sort(([a], [b]) => a.localeCompare(b))) {
  const order = [...data.subjects].sort((a, b) => b[1].days.size - a[1].days.size || subjects.get(a[0])!.name.localeCompare(subjects.get(b[0])!.name, 'ko'));
  const lead = order[0]?.[0];
  const previous = eras.at(-1);
  const era = previous && lead && leads.get(previous) === lead && Number(year) - Number(previous.to) === 1 ? previous :
   eras[eras.push({ from: year, to: year, subjects: [], places: [], cities: [], keywords: [], records: 0 }) - 1];
  leads.set(era, lead);
  era.to = year;
  era.records += data.records;
  for (const [key, row] of order) {
   const subject = subjects.get(key)!;
   const current = era.subjects.find(item => item.key === key);
   if (current) { current.days += row.days.size; current.records.push(...row.records); }
   else era.subjects.push({ key, name: subject.name, interestId: subject.interestId, days: row.days.size, firstSeen: !seen.has(key), records: [...row.records] });
  }
  for (const key of data.subjects.keys()) seen.add(key);
  const merge = (list: [string, number][], counts: Map<string, number>) => {
   const total = new Map(list);
   for (const [name, count] of counts) total.set(name, (total.get(name) ?? 0) + count);
   return ranked(total);
  };
  era.places = merge(era.places, data.places);
  era.cities = merge(era.cities, data.cities);
  era.keywords = merge(era.keywords, data.keywords);
  era.subjects.sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, 'ko'));
 }
 return eras;
}
