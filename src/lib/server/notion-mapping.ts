import { photoProperty, travelProperty, validTravelReferences } from '../entry-extras.ts';
import { sourceLinkHost, sourceLinksProperty } from '../source-links.ts';
import { calendarEntryProperty, isCalendarEntryLink } from '../calendar/entry-link.ts';
import { createHash } from 'node:crypto';
import type { Activity, Entry, ExperienceDate } from '../types.ts';
import { contentOf, type ArchiveRecord, type RecordKind } from '../archive-schema.ts';
import { dateKey } from '../dates.ts';
import { AppError } from './config.ts';
export const schemas = {
 activity: { Name:'title', 'App ID':'rich_text', Category:'select', 'Lifecycle Status':'select', Archived:'checkbox', Summary:'rich_text', 'Last Progress':'rich_text', 'Next Step':'rich_text', 'Resume Notes':'rich_text', 'Satisfaction Note':'rich_text', References:'rich_text', 'Parked At':'date', Tags:'multi_select' },
 entry: { Name:'title', 'App ID':'rich_text', Content:'rich_text', 'Title Provided':'checkbox', 'Occurred At':'date', 'Date Kind':'select', 'Time Zone':'rich_text', 'Created At':'date', Category:'select', Mood:'rich_text', Place:'rich_text', Tags:'multi_select', Activity:'relation' }
} as const;
export interface Property { id?: string; url?: string | null; files?: { file?: { url?: string }; external?: { url?: string } }[]; type?: string; title?: RichText[]; rich_text?: RichText[]; select?: { name: string } | null; status?: { name: string } | null; checkbox?: boolean; date?: { start: string; end?: string | null; time_zone?: string | null } | null; multi_select?: { name: string }[]; relation?: { id: string }[]; has_more?: boolean }
interface RichText { plain_text?: string; text?: { content: string } }
export interface NotionPage { id: string; created_time?: string; object?: string; archived?: boolean; in_trash?: boolean; properties: Record<string,Property> }
const rich = (value = '') => ({ rich_text: (value.match(/[\s\S]{1,900}/gu) ?? []).map(content => ({ type: 'text', text: { content } })) });
const title = (value: string) => ({title:[{type:'text',text:{content:value.slice(0,150)}}]});
export const readText = (property?: Property) => (property?.rich_text || property?.title || []).map(t => t.plain_text ?? t.text?.content ?? '').join('');
export function fingerprint(record: ArchiveRecord) { return createHash('sha256').update(contentOf(record)).digest('hex'); }
export function properties(kind: RecordKind, record: ArchiveRecord, activityPage?: string) {
 const common = { 'App ID':rich(record.id), Category:{select:{name:record.category}}, Tags:{multi_select:record.tags.map(name => ({name}))} };
 if (kind === 'activity') { const a = record as Activity; return { ...common, Name:title(a.name), 'Lifecycle Status':{select:{name:a.lifecycleStatus}}, Archived:{checkbox:a.isArchived}, Summary:rich(a.summary), 'Last Progress':rich(a.lastProgress), 'Next Step':rich(a.nextStep), 'Resume Notes':rich(a.resumeNotes), 'Satisfaction Note':rich(a.satisfactionNote), References:rich(a.references?.join('\n')), 'Parked At':{date:a.parkedAt ? {start:a.parkedAt} : null} }; }
 const e = record as Entry; const at = e.occurredAt;
 return { ...common, Name:title(e.title || e.content.slice(0,48) || sourceLinkHost(e.sourceLinks?.[0] ?? '') || (e.photo ? '사진 기록' : '링크 기록')), Content:rich(e.content),
  ...(e.photo ? { [photoProperty]: rich(e.photo) } : {}),
  ...(e.travelReferences ? { [travelProperty]: rich(JSON.stringify(e.travelReferences)) } : {}), ...(e.sourceLinks?.length ? {[sourceLinksProperty]:rich(e.sourceLinks.join('\n'))} : {}), ...(e.calendarEvent ? {[calendarEntryProperty]:rich(JSON.stringify(e.calendarEvent))} : {}), 'Title Provided':{checkbox:!!e.title}, 'Occurred At':{date:{start:at.kind === 'date' ? at.date : at.kind === 'zoned' ? at.instant : at.local}}, 'Date Kind':{select:{name:at.kind}}, 'Time Zone':rich(at.kind === 'zoned' ? at.timezone : ''), 'Created At':{date:{start:e.createdAt}}, Mood:rich(e.mood), Place:rich(e.place), Activity:{relation:activityPage ? [{id:activityPage}] : []} };
}
export function fromPage(kind: RecordKind, page: NotionPage, activityIds: Map<string,string>): ArchiveRecord {
 const p = page.properties; const id = readText(p['App ID']);
 if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new AppError(422,'Notion App ID가 올바르지 않습니다.');
 const common = { id, category:p.Category?.select?.name as Activity['category'], tags:p.Tags?.multi_select?.map(t=>t.name) || [], isSample:false };
 let record: ArchiveRecord;
 if (kind === 'activity') record = { ...common, name:readText(p.Name), lifecycleStatus:p['Lifecycle Status']?.select?.name as Activity['lifecycleStatus'], isArchived:p.Archived?.checkbox ?? false, summary:readText(p.Summary), lastProgress:readText(p['Last Progress']) || undefined, nextStep:readText(p['Next Step']) || undefined, resumeNotes:readText(p['Resume Notes']) || undefined, satisfactionNote:readText(p['Satisfaction Note']) || undefined, references:readText(p.References) ? readText(p.References).split('\n') : undefined, parkedAt:p['Parked At']?.date?.start as Activity['parkedAt'] };
 else {
  const start = p['Occurred At']?.date?.start; if (!start) throw new AppError(422,'Notion 기록에 경험 날짜가 없습니다.');
  const kind = p['Date Kind']?.select?.name;
  let occurredAt: ExperienceDate;
  if (kind === 'date') occurredAt = {kind:'date',date:start.slice(0,10) as `${number}-${number}-${number}`};
  else if (kind === 'floating') occurredAt = {kind:'floating',local:start.slice(0,19)};
  else if (kind === 'zoned' && !Number.isNaN(Date.parse(start))) occurredAt = {kind:'zoned',instant:new Date(start).toISOString(),timezone:readText(p['Time Zone'])};
  else throw new AppError(422,'Notion 날짜 유형을 확인해 주세요.');
  const relation = p.Activity?.relation || [];
  if (relation.length > 1 || p.Activity?.has_more) throw new AppError(422,'기록에는 활동을 하나만 연결할 수 있습니다.');
  const activityId = relation[0] ? activityIds.get(relation[0].id.replaceAll('-','')) : undefined;
  if (relation.length && !activityId) throw new AppError(422,'연결된 Notion 활동의 App ID나 권한을 확인해 주세요.');
  const content = readText(p.Content); const name = readText(p.Name);
  const snapshot = readText(p[calendarEntryProperty]);
  let calendarEvent: Entry['calendarEvent'];
  if (snapshot) {
    try {
      const parsed: unknown = JSON.parse(snapshot);
      if (!isCalendarEntryLink(parsed)) throw new Error();
      calendarEvent = parsed;
    } catch {
      throw new AppError(422, 'Notion 기록의 Calendar Event 연결 정보를 확인해 주세요.');
    }
  }
  const linkText = readText(p[sourceLinksProperty]);
  const travelText = readText(p[travelProperty]);
  let travelReferences: Entry['travelReferences'];
  if (travelText) {
   try {
    const value: unknown = JSON.parse(travelText);
    if (!validTravelReferences(value)) throw new Error();
    travelReferences = value;
   } catch {
    throw new AppError(422, 'Notion Travel References 내용을 확인해 주세요.');
   }
  }
  record = { ...common, content, calendarEvent, photo: readText(p[photoProperty]) || undefined, travelReferences, sourceLinks: linkText ? linkText.split('\n') : undefined, title:p['Title Provided']?.checkbox ? name : undefined, occurredAt, createdAt:p['Created At']?.date?.start || '', activityId, mood:readText(p.Mood) || undefined, place:readText(p.Place) || undefined };
 }
 return { ...record, notion:{pageId:page.id,hash:fingerprint(record)}, syncPending:false };
}
export function displayDate(record: ArchiveRecord) { return 'occurredAt' in record ? dateKey(record.occurredAt) : ''; }
