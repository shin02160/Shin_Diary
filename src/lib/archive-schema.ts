import { validPhoto, validTravelReferences } from './entry-extras.ts';
import { validSourceLinks } from './source-links.ts';
import { isCalendarEntryLink } from './calendar/entry-link.ts';
import type { Activity, Entry, ExperienceDate } from './types.ts';
export interface Archive { version: 1; revision: number; activities: Activity[]; entries: Entry[] }
const categories = ['Travel', 'Concert', 'Projects', 'Daily'];
const states = ['interested', 'active', 'parked', 'satisfied'];
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (v: unknown) => typeof v === 'string';
const optionalText = (v: unknown) => v === undefined || text(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const validDate = (v: unknown) => text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string) && !Number.isNaN(Date.parse(v as string)) && new Date(v as string).toISOString().slice(0, 10) === v;
function validSync(item: Record<string,unknown>) {
 const n = item.notion;
 return (item.syncPending === undefined || typeof item.syncPending === 'boolean') && (n === undefined || (record(n) && typeof n.pageId === 'string' && /^[a-f0-9-]{32,36}$/i.test(n.pageId) && typeof n.hash === 'string' && /^[a-f0-9]{64}$/.test(n.hash)));
}
function experience(v: unknown): v is ExperienceDate {
 if (!record(v)) return false;
 if (v.kind === 'date') return validDate(v.date);
 if (v.kind === 'floating') return text(v.local) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v.local as string) && !Number.isNaN(Date.parse(v.local as string));
 if (v.kind !== 'zoned' || !text(v.instant) || Number.isNaN(Date.parse(v.instant as string)) || !text(v.timezone)) return false;
 try { new Intl.DateTimeFormat('ko', { timeZone: v.timezone as string }); return true; } catch { return false; }
}
export function decode(raw: string): Archive {
 const value: unknown = JSON.parse(raw);
 if (!record(value) || value.version !== 1 || !Number.isInteger(value.revision) || (value.revision as number) < 0 || !Array.isArray(value.activities) || !Array.isArray(value.entries)) throw new Error('저장 형식이 올바르지 않습니다.');
 const ids = new Set<string>();
 for (const a of value.activities) {
   if (!record(a) || !validSync(a) || !text(a.id) || !a.id || ids.has(a.id as string) || !text(a.name) || !(a.name as string).trim() || !categories.includes(a.category as string) || !states.includes(a.lifecycleStatus as string) || typeof a.isArchived !== 'boolean' || !text(a.summary) || !strings(a.tags) || ![a.lastProgress, a.nextStep, a.resumeNotes, a.satisfactionNote, a.updatedAt].every(optionalText) || (a.parkedAt !== undefined && !validDate(a.parkedAt)) || (a.references !== undefined && (!strings(a.references) || !a.references.every(safeUrl))) || (a.isSample !== undefined && typeof a.isSample !== 'boolean')) throw new Error('활동 데이터를 읽을 수 없습니다.');
   ids.add(a.id as string);
 }
 const entryIds = new Set<string>();
 for (const e of value.entries) {
   if (!record(e) || !validSync(e) || !text(e.id) || !e.id || entryIds.has(e.id as string) || !text(e.content) || (!(e.content as string).trim() && !(Array.isArray(e.sourceLinks) && e.sourceLinks.length) && !e.photo) || (e.photo !== undefined && !validPhoto(e.photo)) || (e.travelReferences !== undefined && !validTravelReferences(e.travelReferences)) || (e.sourceLinks !== undefined && !validSourceLinks(e.sourceLinks)) || !experience(e.occurredAt) || (e.calendarEvent !== undefined && !isCalendarEntryLink(e.calendarEvent)) || !text(e.createdAt) || Number.isNaN(Date.parse(e.createdAt as string)) || !categories.includes(e.category as string) || !strings(e.tags) || ![e.title, e.mood, e.place].every(optionalText) || (e.activityId !== undefined && (!text(e.activityId) || !ids.has(e.activityId as string))) || (e.isSample !== undefined && typeof e.isSample !== 'boolean')) throw new Error('기록 데이터를 읽을 수 없습니다.');
   entryIds.add(e.id as string);
 }
 return value as unknown as Archive;
}
export function safeUrl(value: string): boolean { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } }

export type RecordKind = 'activity' | 'entry';
export type ArchiveRecord = Activity | Entry;
export interface RemoteRecord { kind: RecordKind; record: ArchiveRecord }
export function contentOf(record: ArchiveRecord): string {
 const ignored = new Set(['isSample', 'notion', 'syncPending', 'updatedAt']);
 const clean = Object.fromEntries(Object.entries(record).filter(([key, value]) => !ignored.has(key) && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)));
 if ('createdAt' in clean && typeof clean.createdAt === 'string') clean.createdAt = new Date(clean.createdAt).toISOString();
 if ('occurredAt' in clean) { const at = clean.occurredAt as ExperienceDate; if (at.kind === 'zoned') clean.occurredAt = { ...at, instant:new Date(at.instant).toISOString() }; if (at.kind === 'floating') clean.occurredAt = { ...at, local:at.local.length === 16 ? at.local + ':00' : at.local.slice(0,19) }; }
 if (Array.isArray(clean.tags)) clean.tags = [...clean.tags].sort();
 const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,stable(v)])) : value;
 return JSON.stringify(stable(clean));
}
export function pending(record: ArchiveRecord) { return !record.isSample && (!record.notion || record.syncPending === true); }

export function validateRecord(kind: RecordKind, value: unknown): ArchiveRecord {
 if (!value || typeof value !== 'object') throw new Error('저장할 기록을 확인해 주세요.');
 const item = value as ArchiveRecord;
 if (!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || item.isSample === true) throw new Error('샘플 또는 올바르지 않은 기록은 업로드할 수 없습니다.');
 const stub: Activity[] = kind === 'entry' && 'activityId' in item && item.activityId ? [{id:item.activityId, name:'validation',category:'Daily',lifecycleStatus:'active',isArchived:false,summary:'',tags:[]}] : [];
 decode(JSON.stringify({version:1,revision:0,activities:kind === 'activity' ? [item] : stub,entries:kind === 'entry' ? [item] : []}));
 if (item.notion && (!/^[a-f0-9]{64}$/.test(item.notion.hash) || !/^[a-f0-9-]{32,36}$/i.test(item.notion.pageId))) throw new Error('Notion 연결 정보를 확인해 주세요.');
 if (('name' in item && item.name.length>150) || ('title' in item && item.title && item.title.length>150)) throw new Error('제목은 150자 이내로 입력해 주세요.');
 if (item.tags.length > 50 || item.tags.some(t=>t.length>100) || Object.entries(item).some(([key,v])=>!(kind === 'entry' && key === 'photo') && typeof v === 'string' && v.length>20000)) throw new Error('텍스트나 태그가 저장 한도를 초과했습니다.');
 return item;
}
