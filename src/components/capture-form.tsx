"use client";
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TravelReferencePicker } from './travel-reference-picker';
import Image from 'next/image';
import { travelLabels, validPhoto, validTravelReferences, type TravelReferences } from '@/lib/entry-extras';
import { preparePhoto } from '@/lib/prepare-photo';
import { memoFields } from '@/lib/memo-fields';
import { parseSourceLinks, sourceLinksMaxLength } from '@/lib/source-links';
import { eventDraftKey, isCalendarEntryLink, type CalendarEntryLink } from '@/lib/calendar/entry-link';
import { dateKey } from '@/lib/dates';
import { categoryLabels } from '@/lib/sample-data';
import { saveEntry, today, updateEntry, useArchive } from '@/lib/local-store';
import type { Category, Entry, ExperienceDate, LocalDate } from '@/lib/types';
const DRAFT_KEY = 'mlu.capture.draft.v1';
interface Draft { content: string; title: string; date: string; activityId: string; category: Category; mood: string; place: string; tags: string; links: string; photo?: string; travelReferences?: TravelReferences }
function emptyDraft(): Draft { return { content: '', title: '', date: today(), activityId: '', category: 'Daily', mood: '', place: '', tags: '', links: '' }; }
function readCalendarEvent(token: string): CalendarEntryLink | undefined {
 if (!token) return;
 try {
   const value: unknown = JSON.parse(sessionStorage.getItem(eventDraftKey(token)) ?? 'null');
   if (isCalendarEntryLink(value)) return value;
 } catch { /* A missing snapshot is reported in the form. */ }
}

function travelDraft(value: unknown): TravelReferences | undefined {
 if (!value || typeof value !== 'object') return;
 return Object.fromEntries(Object.entries(value).filter(([kind, text]) =>
  Object.hasOwn(travelLabels, kind) && typeof text === 'string' && text.length <= 2000));
}
function initialDraft(requested: string, draftKey: string, calendarEvent?: CalendarEntryLink): Draft {
 const apply = (draft: Draft) => requested ? { ...draft, activityId: requested } : draft;
 try { const raw = sessionStorage.getItem(draftKey); if (raw) { const draft = JSON.parse(raw); if (draft && ['content','title','date','activityId','category','mood','place','tags'].every(k => typeof draft[k] === 'string') && draft.category in categoryLabels) return apply({ ...draft, links: typeof draft.links === 'string' ? draft.links : '', photo: validPhoto(draft.photo) ? draft.photo : undefined, travelReferences: travelDraft(draft.travelReferences) }); } } catch { /* The form remains usable if draft storage is blocked. */ }
 return apply(calendarEvent ? { ...emptyDraft(), date: calendarEvent.date, place: calendarEvent.location?.slice(0, 200) ?? '' } : emptyDraft());
}
function entryDraft(entry: Entry): Draft {
 return {
  content: entry.content, title: entry.title ?? '', date: dateKey(entry.occurredAt),
  activityId: entry.activityId ?? '', category: entry.category, mood: entry.mood ?? '',
  place: entry.place ?? '', photo: entry.photo, travelReferences: entry.travelReferences, tags: entry.tags.join(', '), links: entry.sourceLinks?.join('\n') ?? '',
 };
}

async function editedDate(date: LocalDate, previous?: ExperienceDate): Promise<ExperienceDate> {
 if (!previous || previous.kind === 'date') return { kind: 'date', date };
 if (dateKey(previous) === date) return previous;
 if (previous.kind === 'floating') return { ...previous, local: date + previous.local.slice(10) };
 const { Temporal } = await import('@js-temporal/polyfill');
 const local = Temporal.Instant.from(previous.instant).toZonedDateTimeISO(previous.timezone).toPlainDateTime();
 const moved = Temporal.PlainDate.from(date).toPlainDateTime(local.toPlainTime()).toZonedDateTime(previous.timezone);
 return { ...previous, instant: moved.toInstant().toString() };
}

export function CaptureForm({ activityId = '', eventToken = '', entryId }: { activityId?: string; eventToken?: string; entryId?: string }) {
 const store = useArchive();
 if (!store.ready) return <p role="status">기록을 불러오는 중…</p>;
 const existing = entryId ? store.entries.find(item => item.id === entryId && !item.isSample) : undefined;
 if (entryId && !existing) return <div className="empty"><h2>편집할 기록을 찾지 못했어요</h2><Link className="button" href="/memories">추억으로 돌아가기</Link></div>;
 return <ReadyCapture key={entryId ?? activityId + ':' + eventToken} activityId={activityId} eventToken={eventToken} existing={existing}/>;
}

function ReadyCapture({ activityId, eventToken, existing }: { activityId: string; eventToken: string; existing?: Entry }) {
 const { activities, error: storageError } = useArchive(); const router = useRouter();
 const draftKey = eventToken ? DRAFT_KEY + '.' + eventToken : DRAFT_KEY;
 const [original] = useState(existing);
 const [calendarEvent] = useState(() => original?.calendarEvent ?? readCalendarEvent(eventToken));
 const [draft, setDraft] = useState<Draft>(() => original ? entryDraft(original) : initialDraft(activityId, draftKey, calendarEvent)); const [error, setError] = useState(''); const [draftWarning, setDraftWarning] = useState(''); const [saving, setSaving] = useState(false);
 const busy = useRef(false); const id = useRef<string | null>(null);
 const [photoBusy, setPhotoBusy] = useState(false);
 const [photoError, setPhotoError] = useState('');
 const latestDraft = useRef(draft);
 const [memoStatus, setMemoStatus] = useState('');
 const [showDetails, setShowDetails] = useState(!!original);
 function updateDraft(next: Draft) {
  latestDraft.current = next;
  setDraft(next);
  if (original) return;
  try {
   sessionStorage.setItem(draftKey, JSON.stringify(next));
   setDraftWarning('');
  } catch {
   setDraftWarning('임시 초안을 보관하지 못했습니다. 이 화면을 나가기 전에 내용을 복사해 주세요.');
  }
 }
 function update<K extends keyof Draft>(key: K, value: Draft[K]) {
  updateDraft({ ...draft, [key]: value });
  if (key === 'content' || key === 'links' || key === 'tags') setMemoStatus('');
 }
 function fillMemoFields() {
  const extracted = memoFields(draft.content);
  let existingLinks: string[];
  try {
   existingLinks = parseSourceLinks(draft.links);
  } catch {
   setMemoStatus('관련 링크 칸의 주소를 먼저 확인해 주세요.');
   return;
  }
  const existingTags = draft.tags.split(',').map(tag => tag.trim()).filter(Boolean);
  const addedLinks = extracted.links.filter(link => !existingLinks.includes(link));
  const addedTags = extracted.tags.filter(tag => !existingTags.includes(tag));
  if (!addedLinks.length && !addedTags.length) {
   setMemoStatus('추가할 링크나 해시태그가 없어요.');
   return;
  }
  const links = addedLinks.length ? [...existingLinks, ...addedLinks].join('\n') : draft.links;
  const tags = addedTags.length ? [...existingTags, ...addedTags].join(', ') : draft.tags;
  if (existingLinks.length + addedLinks.length > 10 || links.length > sourceLinksMaxLength || tags.length > 500) {
   setMemoStatus('링크나 태그가 입력 한도를 넘어요. 필요한 항목을 직접 골라 입력해 주세요.');
   return;
  }
  updateDraft({ ...draft, links, tags });
  if (addedTags.length) setShowDetails(true);
  setMemoStatus('관련 링크 ' + addedLinks.length + '개, 태그 ' + addedTags.length + '개를 추가했어요. 저장 전에 확인해 주세요.');
 }
 async function attachPhoto(file: File) {
  setPhotoBusy(true);
  setPhotoError('');
  try {
   const photo = await preparePhoto(file);
   updateDraft({ ...latestDraft.current, photo });
  } catch (failure) {
   setPhotoError(failure instanceof Error ? failure.message : '사진을 읽지 못했습니다.');
  } finally {
   setPhotoBusy(false);
  }
 }
 async function submit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (busy.current || photoBusy) return; setError('');
  let links: string[];
  try {
   links = parseSourceLinks(draft.links);
  } catch (error) {
   setError((error as Error).message);
   return;
  }
  const travelReferences = Object.fromEntries(Object.entries(draft.travelReferences ?? {}).map(([kind,url]) => [kind,url.trim()]).filter(([,url]) => url));
  if (!validTravelReferences(travelReferences)) {
   setError('여행 자료에 올바른 HTTP 또는 HTTPS 주소를 입력해 주세요.');
   return;
  }
  if (!draft.content.trim() && links.length === 0 && !draft.photo) {
   setError('본문, 사진, 관련 링크 중 하나를 남겨 주세요.');
   return;
  }
  if (draft.activityId && !activities.some(a => a.id === draft.activityId)) { setError('연결할 활동을 다시 선택해 주세요.'); return; }
  busy.current = true; setSaving(true); id.current ??= crypto.randomUUID();
  try {
   const entry: Entry = {
    ...original, id: original?.id ?? id.current, content: draft.content.trim(), calendarEvent,
    photo: draft.photo, travelReferences: Object.keys(travelReferences).length ? travelReferences : undefined,
    sourceLinks: links.length ? links : undefined, title: draft.title.trim() || undefined,
    occurredAt: await editedDate(draft.date as LocalDate, original?.occurredAt),
    createdAt: original?.createdAt ?? new Date().toISOString(), category: draft.category,
    activityId: draft.activityId || undefined, mood: draft.mood.trim() || undefined,
    place: draft.place.trim() || undefined, tags: [...new Set(draft.tags.split(',').map(t => t.trim()).filter(Boolean))],
   };
   if (original) {
    await updateEntry(entry, original);
   } else {
    await saveEntry(entry);
    try { sessionStorage.removeItem(draftKey); } catch { /* The committed record is already safe. */ }
   }
   router.push('/memories?saved=1');
  } catch (failure) {
   setError(failure instanceof Error ? failure.message : '저장하지 못했습니다. 다시 시도해 주세요.');
   busy.current = false;
   setSaving(false);
  }
 }
 if (eventToken && !calendarEvent) {
  return <div className="resume-panel"><p>이 탭에서 연결할 일정을 찾지 못했습니다.</p><Link href="/calendar" className="button">달력으로 돌아가기</Link></div>;
 }
 return <form className="editor-form resume-panel" onSubmit={submit}>{calendarEvent && <div className="connection-empty"><strong>{calendarEvent.title}</strong><p>{calendarEvent.period} · {calendarEvent.sourceName}</p></div>}<label>오늘의 기록<textarea maxLength={20000} rows={6} placeholder="오늘 마음에 남은 순간은 무엇인가요?" value={draft.content} onChange={e => update('content', e.target.value)}/></label><button className="button" type="button" disabled={saving || !draft.content.trim()} onClick={fillMemoFields}>본문에서 링크·태그 채우기</button><p role="status" className="muted">{memoStatus}</p>
 {draft.content.trim() && !draft.title && <button type="button" className="button" onClick={() => {
  const firstLine = draft.content.trim().split(/\r?\n/, 1)[0].trim();
  update('title', firstLine.slice(0, 100));
  setShowDetails(true);
 }}>본문 첫 줄을 제목에 넣기</button>}<div>
 <label>사진 첨부<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy || saving} onChange={event => {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = '';
  if (file) void attachPhoto(file);
 }}/></label>
 {photoBusy && <p role="status">사진을 준비하는 중…</p>}
 {photoError && <p role="alert" className="form-error">{photoError}</p>}
 {draft.photo && <><Image className="entry-photo" unoptimized width={400} height={280} src={draft.photo} alt="첨부 사진 미리보기"/><button type="button" className="button" disabled={photoBusy || saving} onClick={() => { update('photo', undefined); setPhotoError(''); }}>사진 제거</button></>}
 </div><label>관련 링크 (한 줄에 하나)<textarea rows={2} maxLength={sourceLinksMaxLength} placeholder="https://…" value={draft.links} onChange={e => update('links', e.target.value)}/></label><div className="form-grid"><label>경험한 날짜<input required type="date" value={draft.date} onChange={e => update('date', e.target.value)}/></label><label>연결할 활동<select value={draft.activityId} onChange={e => update('activityId', e.target.value)}><option value="">독립 기록으로 남기기</option>{activities.map(a => <option key={a.id} value={a.id}>{a.name}{a.isSample ? ' · 샘플' : ''}{a.isArchived ? ' · 아카이브' : ''}</option>)}</select></label></div><details open={showDetails} onToggle={event => setShowDetails(event.currentTarget.open)}><summary>제목·분류·감정 등 더 남기기 (선택)</summary><div className="form-grid"><label>제목<input maxLength={150} value={draft.title} onChange={e => update('title', e.target.value)}/></label><label>카테고리<select value={draft.category} onChange={e => update('category', e.target.value as Category)}>{Object.entries(categoryLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>감정<input maxLength={100} value={draft.mood} onChange={e => update('mood', e.target.value)}/></label><label>장소<input maxLength={200} value={draft.place} onChange={e => update('place', e.target.value)}/></label><label>태그 (쉼표로 구분)<input maxLength={500} value={draft.tags} onChange={e => update('tags', e.target.value)}/></label></div></details><details><summary>여행 자료 연결 (선택)</summary>
 <TravelReferencePicker onChoose={(kind, url) => update('travelReferences', { ...draft.travelReferences, [kind]: url })}/>
 {Object.entries(travelLabels).map(([kind, label]) => {
  const key = kind as keyof TravelReferences;
  return <label key={key}>{label} 링크<input inputMode="url" maxLength={2000} value={draft.travelReferences?.[key] ?? ''} onChange={event => update('travelReferences', { ...draft.travelReferences, [key]: event.target.value })}/></label>;
 })}
 </details><p className="muted">{original ? '변경 내용을 저장하면 추억 화면으로 돌아갑니다.' : '분류를 선택하지 않으면 일상으로 저장돼요. 작성 중인 초안은 현재 탭에 임시 보관됩니다.'}</p>{draftWarning && <p role="status">{draftWarning}</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button primary" disabled={saving || photoBusy || !!storageError} type="submit">{saving ? '저장 중…' : original ? '변경 저장' : '기록 저장'}</button><Link className="button" href={!original && calendarEvent ? '/calendar?date=' + calendarEvent.date : '/memories'}>{original ? '편집 취소' : '초안 남겨두고 나가기'}</Link></div></form>;
}
