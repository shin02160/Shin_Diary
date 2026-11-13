"use client";
import { Icon } from '@/components/icon';
import Link from 'next/link';
import { sourceLinkHost } from '@/lib/source-links';
import { useEffect, useState } from 'react';
import { calendarEvents } from '@/lib/sample-data';
import { today, useArchive } from '@/lib/local-store';
import { calendarType, calendarTypeLabels, confirmedLesson } from '@/lib/calendar/classification';
import type { Entry } from '@/lib/types';
import { dateKey, dateLabel } from '@/lib/dates';
import { overlaps, eventPeriod, wallLabel } from '@/lib/calendar/event-utils';
import { useIcsPreview } from '@/lib/calendar/preview-store';
import { archiveCalendarEndDay, archiveCalendarOverlaps, archiveCalendarDisplayStatus, type ArchiveCalendarEvent } from '@/lib/calendar/archive';
import { api } from '@/lib/notion-sync';
import type { ImportedEvent, SavedEvent } from '@/lib/calendar/types';
import { IcsImport } from './ics-import';
import { EventCaptureButton } from './event-capture-button';
import { CalendarNotion } from './calendar-notion';
const categoryFilters: Partial<Record<string, string>> = { travel: 'Travel', concert: 'Concert', daily: 'Daily' };
const filters=[['all','전체'],['entry','기록'],['event','외부 일정'],['travel','여행'],['concert','공연'],['daily','일상'],['exercise','운동'],['appointment','약속'],['work','업무'],['other','기타']] as const;
export function Calendar({ date, eventId, remote }: { date?: string; eventId?: string; remote?: boolean }){const {ready}=useArchive();return ready?<ReadyCalendar key={date + '/' + eventId} date={date} eventId={eventId} remote={remote}/>:<p role="status">달력을 불러오는 중…</p>;}
function EventDetails({event}:{event:ImportedEvent}){return <><p>{eventPeriod(event)}</p><details className="event-details"><summary>일정 상세 보기</summary><dl><div><dt>출처</dt><dd>{event.sourceName} · 네이버 ICS 스냅샷</dd></div>{event.location&&<div><dt>장소</dt><dd>{event.location}</dd></div>}{event.description&&<div><dt>설명</dt><dd className="preserve-lines">{event.description}</dd></div>}<div><dt>파일을 읽은 시각</dt><dd>{new Date(event.importedAt).toLocaleString('ko-KR')}</dd></div><div><dt>상태</dt><dd>{{confirmed:'확정',tentative:'미확정',cancelled:'취소됨',unknown:'원본에 표시 없음'}[event.status]}</dd></div></dl><p className="muted">읽기 전용 일정입니다.</p><EventCaptureButton event={event}/></details></>;}
function ArchivedEventDetails({ event, expanded, relationOnly = false }: { event: ArchiveCalendarEvent; expanded: boolean; relationOnly?: boolean }) {
 const end = event.allDay ? archiveCalendarEndDay(event) : event.wallEnd;
 return <>
  {!relationOnly && <><p>{wallLabel(event.wallStart)}{end !== event.wallStart && ' ~ ' + wallLabel(end)}{event.allDay ? ' · 종일' : event.originalTimezone ? ' · ' + event.originalTimezone : ' · 현지 시각'}</p>
  <p>표시 상태 · {archiveCalendarDisplayStatus(event, today())}{event.location && ' · ' + event.location}</p>
  </>}
  <details open={expanded || undefined}><summary>{relationOnly ? '연결된 기록' : '일정 상세 보기'}</summary>
   {event.interestIds?.map((id, index) => <p key={id}><Link href={'/explore/interests?id=' + id}>연결된 관심사 {index + 1}</Link></p>)}
   {event.activityIds?.map((id, index) => <p key={id}><Link href={'/explore/linked-activity/' + id}>연결된 활동 {index + 1}</Link></p>)}
   {!event.interestIds?.length && !event.activityIds?.length && <p>연결된 관심사나 활동이 없어요.</p>}
   <p>출처 · {event.sourceName}</p>
   {event.description && <p className="preserve-lines">{event.description}</p>}
   <a className="text-link" href={'https://www.notion.so/' + event.pageId} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a>
  </details>
 </>;
}
function ReadyCalendar({ date, eventId, remote }: { date?: string; eventId?: string; remote?: boolean }){
 const { entries: localEntries } = useArchive();
 const [remoteArchive, setRemoteArchive] = useState<{ entries: Entry[]; failed?: boolean }>();
 useEffect(() => {
  if (!remote) return;
  let active = true;
  void api<{ entries: Entry[] }>('wiki-entries').then(result => { if (active) setRemoteArchive(result); })
   .catch(() => { if (active) setRemoteArchive({ entries: [], failed: true }); });
  return () => { active = false; };
 }, [remote]);
 const entries = remote ? [...new Map([...localEntries.filter(entry => !entry.isSample), ...(remoteArchive?.entries ?? [])]
  .map(entry => [entry.id, entry])).values()] : localEntries;
 const preview=useIcsPreview();
 const [saved,setSaved]=useState<SavedEvent[]>([]);
 const savedById = new Map(saved.map(item => [item.event.id,item.event]));
 const external = new Map(savedById);
 for (const event of preview.events) external.set(event.id,event);
 const [month,setMonth]=useState(date ? Number(date.slice(5,7))-1 : new Date().getMonth());const [year,setYear]=useState(date ? Number(date.slice(0,4)) : new Date().getFullYear());
 const [sourceFilter, setSourceFilter] = useState('');
 const [filter,setFilter]=useState<(typeof filters)[number][0]>('all');const [selected,setSelected]=useState<string|null>(date ?? null);const [view,setView]=useState<'month'|'list'>('month');const [visible,setVisible]=useState(50);
 const shift=(delta:number)=>{const date=new Date(Date.UTC(year,month+delta,1));setMonth(date.getUTCMonth());setYear(date.getUTCFullYear());setSelected(null);setVisible(50);};
 const first=new Date(Date.UTC(year,month,1)).getUTCDay();const days=new Date(Date.UTC(year,month+1,0)).getUTCDate();const monthKey=`${year}-${String(month+1).padStart(2,'0')}`;const from=monthKey+'-01';const to=monthKey+'-'+days;
 const [notion, setNotion] = useState<{ month: string; events: ArchiveCalendarEvent[]; skipped?: number; error?: string }>();
 useEffect(() => {
  let active = true;
  void api<{ events: ArchiveCalendarEvent[]; skipped: number }>('life-calendar?from=' + from + '&to=' + to)
   .then(result => { if (active) setNotion({ month: monthKey, ...result }); })
   .catch(error => { if (active) setNotion({ month: monthKey, events: [], error: error instanceof Error ? error.message : 'Notion 일정을 불러오지 못했어요.' }); });
  return () => { active = false; };
 }, [from, to, monthKey]);
 const currentNotion = notion?.month === monthKey ? notion : undefined;
 const storedById = new Map((currentNotion?.events ?? []).map(event => [event.id, event]));
 const notionById = new Map((currentNotion?.events ?? []).filter(event => !external.has(event.id)).map(event => [event.id, event]));
 const sources = new Map([...external.values()].map(event => [event.sourceCalendarId, event.sourceName]));
 for (const event of notionById.values()) sources.set('archive:' + event.sourceName, event.sourceName);
 const selectedSource = sources.has(sourceFilter) ? sourceFilter : '';
 const linkedCategories = new Map<string, Set<string>>();
 for (const entry of entries) {
  if (!entry.calendarEvent) continue;
  const group = linkedCategories.get(entry.calendarEvent.id) ?? new Set<string>();
  group.add(entry.category);
  linkedCategories.set(entry.calendarEvent.id, group);
 }
 const selectedCategory = categoryFilters[filter];
 const entryTypes = new Map(entries.map(entry => [entry.id, entry.category === 'Travel' ? 'travel' as const : entry.category === 'Concert' ? 'concert' as const :
  calendarType({ title: entry.title ?? '', description: entry.content })]));
 const externalTypes = new Map([...external.values(), ...notionById.values()].map(event => [event.id, calendarType(event)]));
 const currentDay = today();
 const items=[...entries.map(e=>({id:e.id,title:e.title||e.content||sourceLinkHost(e.sourceLinks?.[0] ?? '')||(e.photo ? '사진 기록' : '링크 기록'),at:e.occurredAt,day:dateKey(e.occurredAt),kind:'entry' as const,detail:e.content,isSample:e.isSample,category:e.category,event:undefined})),...calendarEvents.filter(() => !remote && !currentNotion?.events.length && !external.size).map(e=>({id:e.id,title:e.title,at:e.start,day:dateKey(e.start),kind:'event' as const,isSample:true,detail:'실제 가져온 일정이 아닌 화면 확인용 샘플입니다.',category:undefined,event:undefined})),...[...external.values()].map(e=>({id:e.id,title:e.title,at:e.start,day:e.wallStart.slice(0,10),kind:'event' as const,isSample:false,detail:'',category:undefined,event:e})), ...[...notionById.values()].map(e=>({id:e.id,title:e.title,at:undefined,day:e.wallStart.slice(0,10),kind:'event' as const,isSample:false,detail:'',category:undefined,event:undefined}))].filter(item => {
  const stored = item.kind === 'event' ? notionById.get(item.id) : undefined;
  if (selectedSource && (stored ? 'archive:' + stored.sourceName : item.event?.sourceCalendarId) !== selectedSource) return false;
  if (filter === 'all' || filter === item.kind) return true;
  const type = (item.kind === 'entry' ? entryTypes : externalTypes).get(item.id);
  const linked = linkedCategories.get(item.id);
  if (selectedCategory && (item.category === selectedCategory || linked?.has(selectedCategory))) return true;
  if (filter === 'daily') return item.kind === 'event' && (type === 'exercise' || type === 'appointment' ||
   /^(일상|개인|daily|personal)$/i.test((stored ?? item.event)?.sourceName.trim() ?? ''));
  return type === filter;
 });
 const monthItems=items.filter(e=>e.event?overlaps(e.event,from,to):e.kind === 'event' && notionById.has(e.id) ? archiveCalendarOverlaps(notionById.get(e.id)!,from,to) : e.day.startsWith(monthKey)).sort((a,b)=>a.day.localeCompare(b.day)||(a.event?.wallStart||a.day).localeCompare(b.event?.wallStart||b.day)||a.title.localeCompare(b.title));
 const onDate=(e:(typeof monthItems)[number],date:string)=>e.event?overlaps(e.event,date,date):e.kind === 'event' && notionById.has(e.id) ? archiveCalendarOverlaps(notionById.get(e.id)!,date,date) : e.day===date;
 const shown=selected?monthItems.filter(e=>onDate(e,selected)):monthItems;
 const targetIndex = shown.findIndex(item => item.kind === 'event' && storedById.get(item.id)?.pageId === eventId && Boolean(eventId));
 const ordered = targetIndex > 0 ? [shown[targetIndex], ...shown.filter((_, index) => index !== targetIndex)] : shown;
 return <><IcsImport from={from} to={to} onApply={date=>{const [y,m]=date.split('-').map(Number);setYear(y);setMonth(m-1);setSelected(null);setFilter('all');setSourceFilter('');setVisible(50);}}/><CalendarNotion preview={preview.latest} onRead={setSaved} onSave={item=>setSaved(current=>[...current.filter(old=>old.event.id!==item.event.id),item])}/>{remoteArchive?.failed && <p role="alert">Notion 기록을 불러오지 못했어요.</p>}{!currentNotion && <p role="status">Notion 일정을 불러오는 중…</p>}{currentNotion?.error && <p role="alert">{currentNotion.error}</p>}{!!currentNotion?.skipped && <p>날짜 형식을 확인할 수 없는 Notion 일정이 있어요.</p>}<div className="calendar-toolbar"><div className="month-control"><button aria-label="이전 달" onClick={()=>shift(-1)}><Icon name="previous"/></button><h2>{year}년 {month+1}월</h2><button aria-label="다음 달" onClick={()=>shift(1)}><Icon name="next"/></button></div><div className="calendar-actions"><div className="chips" role="group" aria-label="달력 보기 방식"><button aria-pressed={view==='month'} onClick={()=>setView('month')}>월</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}>목록</button></div><Link className="button" href="/capture"><Icon name="add"/> 기록</Link></div></div><div className="chips calendar-filters" role="group" aria-label="달력 표시 유형">{filters.map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key);setVisible(50);}}>{label}</button>)}</div>{sources.size > 0 && <label>외부 일정 출처{' '}<select value={selectedSource} onChange={event => { setSourceFilter(event.target.value); setVisible(50); }}>
 <option value="">모든 출처</option>{[...sources].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
 </select></label>}{view==='month'&&<div className="calendar-grid"><div className="weekdays">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div><div className="days">{Array.from({length:first},(_,i)=><div className="day blank" key={`blank-${i}`}/>)}{Array.from({length:days},(_,i)=>{const day=i+1;const key=`${monthKey}-${String(day).padStart(2,'0')}`;const daily=monthItems.filter(e=>onDate(e,key));return <button className={`day ${selected===key?'selected':''}`} key={key} aria-pressed={selected===key} aria-label={`${year}년 ${month+1}월 ${day}일, ${daily.length}건`} onClick={()=>{setSelected(selected===key?null:key);setVisible(50);}}><span className="day-number">{day}</span>{daily.slice(0,2).map(e=><span key={e.kind + ':' + e.id} className={`calendar-marker ${e.kind} calendar-type-${(e.kind === 'entry' ? entryTypes : externalTypes).get(e.id) ?? 'unknown'}`}><Icon name={e.kind === 'entry' ? 'file' : 'calendar'} size="small"/> {e.kind==='entry'?'기록':calendarTypeLabels[externalTypes.get(e.id) ?? 'unknown']}<span className="calendar-title"> · {e.title}</span></span>)}{daily.length>2&&<span className="calendar-more">+{daily.length-2}</span>}</button>;})}</div></div>}<section className="calendar-list"><div className="section-heading"><h2>{selected?`${selected}의 이야기`:'이번 달의 이야기'}</h2>{selected&&<button className="text-button" onClick={()=>{setSelected(null);setVisible(50);}}>월 전체 보기</button>}</div>{shown.length?ordered.slice(0,visible).map(e=><article key={e.kind + ':' + e.id} id={e.kind === 'event' && storedById.has(e.id) ? 'event-' + storedById.get(e.id)!.pageId : undefined} className="calendar-list-item"><span className={`event-label ${e.kind} calendar-type-${(e.kind === 'entry' ? entryTypes : externalTypes).get(e.id) ?? 'unknown'}`}>{e.kind==='entry'?(e.isSample?'기록 · 샘플':'내 기록'):e.isSample?'네이버 일정 · 샘플' : calendarTypeLabels[externalTypes.get(e.id) ?? 'unknown']}</span>{e.kind === 'event' && (e.event ?? storedById.get(e.id)) && confirmedLesson((e.event ?? storedById.get(e.id))!, currentDay) && <span className="event-label calendar-completed">레슨 완료</span>}<h3 className={(e.event?.status ?? notionById.get(e.id)?.status)==='cancelled'?'cancelled-event':undefined}>{e.title}</h3>{e.event?<><EventDetails event={e.event}/>{storedById.has(e.id) && <ArchivedEventDetails event={storedById.get(e.id)!} expanded={storedById.get(e.id)?.pageId === eventId} relationOnly/>}</>:e.kind === 'event' && notionById.has(e.id) ? <ArchivedEventDetails event={notionById.get(e.id)!} expanded={notionById.get(e.id)?.pageId === eventId}/> : <><p>{e.at && dateLabel(e.at)}</p><p className="preserve-lines">{e.detail}</p></>}</article>):<div className="empty"><h3>표시할 일정이나 기록이 없어요</h3><p>다른 날짜를 선택하거나 ICS 파일을 열어보세요.</p></div>}{shown.length>visible&&<button type="button" className="button" onClick={()=>setVisible(v=>v+50)}>50개 더 보기</button>}</section></>;
}
