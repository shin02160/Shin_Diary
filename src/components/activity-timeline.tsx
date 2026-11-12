'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { dayLabel } from '@/lib/dates';
import { timelineDay, timelineRows } from '@/lib/activity-timeline';
import { catalogLabels, type CatalogItem, type CatalogKind } from '@/lib/universe-catalog';
import { deduplicateActivities, parseActivityDate, type ActivityStatus } from '@/lib/activity-view';
import { archiveCalendarEndDay, type ArchiveCalendarEvent } from '@/lib/calendar/archive';
import { api } from '@/lib/notion-sync';

interface TimelineEvent {
 id: string; title: string; start?: string; end?: string; timezone?: string;
 category?: string; description?: string; interestLabel?: string;
}

function timelineCategory(value?: string): CatalogKind {
 const text = value?.trim().toLowerCase();
 if (text === '여행' || text === 'travel') return 'travel';
 if (text === '공연' || text === '음악/공연' || text === 'concert') return 'concert';
 if (text === '일상' || text === 'daily') return 'daily';
 if (text === '프로젝트' || text === '기술/프로젝트' || text === 'projects') return 'project';
 return 'uncategorized';
}

function calendarItem(event: ArchiveCalendarEvent): CatalogItem {
 const status = event.status === 'tentative' ? 'planned' : event.status;
 return {
  key: event.id, sourceType: 'calendar', sourcePageId: event.pageId, title: event.title, type: '일정',
  category: 'uncategorized', kind: 'uncategorized', interestIds: [], status,
  startAt: parseActivityDate(event.wallStart), endAt: parseActivityDate(archiveCalendarEndDay(event)),
  location: event.location, originalUrl: 'https://www.notion.so/' + event.pageId, tags: [],
  detailHref: '/calendar?date=' + event.wallStart.slice(0, 10),
 };
}

function sourceItem(event: TimelineEvent): CatalogItem {
 const category = timelineCategory(event.category);
 return {
  key: 'timeline:' + event.id, sourceType: 'timeline', sourcePageId: event.id, title: event.title, type: '타임라인 이벤트',
  category, kind: category, interestIds: [], status: 'unknown',
  startAt: parseActivityDate(event.start, event.timezone), endAt: parseActivityDate(event.end ?? undefined, event.timezone),
  summary: event.description, detail: event.interestLabel, originalUrl: 'https://www.notion.so/' + event.id, tags: [],
 };
}

const labels: Record<ActivityStatus, string> = { planned: '예정', confirmed: '확정', done: '완료', cancelled: '취소', unknown: '상태 미확인' };

function TimelineItem({ item, day, end }: { item: CatalogItem; day?: string; end?: string }) {
 return <li className={'universe-tone-' + item.category}>
  <div><span className="universe-kind">{item.type === '일정' || item.type === '타임라인 이벤트' ? item.type : catalogLabels[item.category]}</span> <span className="universe-meta">{labels[item.status]}</span></div>
  <h3>{item.detailHref ? <Link href={item.detailHref}>{item.title}</Link> : item.title}</h3>
  {day && <p className="universe-meta"><time dateTime={day}>{dayLabel(day)}</time>
   {end && end !== day && <> ~ <time dateTime={end}>{dayLabel(end)}</time></>}</p>}
  {item.detail && item.sourceType === 'timeline' && <p className="universe-meta">원본 관련 관심사 · {item.detail}</p>}
  {item.location && <p className="universe-meta">{item.location}</p>}
  {item.originalUrl && <a className="text-link" href={item.originalUrl} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a>}
 </li>;
}

export function ActivityTimeline({ items: catalog, loading: catalogLoading, failed: catalogFailed }: { items: CatalogItem[]; loading: boolean; failed: boolean }) {
 const [sources, setSources] = useState<{ items: CatalogItem[]; errors: string[] }>();
 useEffect(() => {
  let active = true;
  void Promise.allSettled([
   api<{ events: ArchiveCalendarEvent[] }>('life-calendar'),
   api<{ events: TimelineEvent[]; configured: boolean }>('timeline-events'),
  ]).then(([calendar, history]) => {
   if (!active) return;
   setSources({
    items: [
     ...(calendar.status === 'fulfilled' ? calendar.value.events.map(calendarItem) : []),
     ...(history.status === 'fulfilled' ? history.value.events.map(sourceItem) : []),
    ],
    errors: [
     ...(calendar.status === 'rejected' ? ['Notion 일정을 불러오지 못했어요.'] : []),
     ...(history.status === 'rejected' ? ['Notion 타임라인 이벤트를 불러오지 못했어요.']
      : history.value.configured ? [] : ['연결된 Notion 타임라인 데이터 소스가 없어요.']),
    ],
   });
  });
  return () => { active = false; };
 }, []);
 const items = deduplicateActivities([...catalog, ...(sources?.items ?? [])]);
 const loading = catalogLoading || !sources;
 const failed = catalogFailed || Boolean(sources?.errors.length);
 const [year, setYear] = useState('');
 const [month, setMonth] = useState('');
 const [from, setFrom] = useState('');
 const [to, setTo] = useState('');
 const [category, setCategory] = useState<CatalogKind | ''>('');
 const [status, setStatus] = useState<ActivityStatus | ''>('');
 const [limit, setLimit] = useState(24);
 const years = [...new Set(items.flatMap(item => {
  const start = timelineDay(item.startAt);
  const end = timelineDay(item.endAt);
  if (!start) return [];
  const first = Number(start.slice(0, 4));
  const last = Math.max(first, Number((end ?? start).slice(0, 4)));
  return Array.from({ length: last - first + 1 }, (_, index) => String(first + index).padStart(4, '0'));
 }))].sort().reverse();
 const period = year && month ? year + '-' + month : year;
 const lastDay = year && month ? new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate() : 31;
 const periodStart = period ? period + (month ? '-01' : '-01-01') : '';
 const periodEnd = period ? period + (month ? '-' + lastDay : '-12-31') : '';
 const low = [from, periodStart].sort().at(-1) ?? '';
 const high = [to, periodEnd].filter(Boolean).sort()[0] ?? '';
 const invalid = Boolean(from && to && from > to);
 const disjoint = Boolean(low && high && low > high);
 const filtered = items.filter(item => (!category || item.category === category) && (!status || item.status === status));
 const { dated, undated } = timelineRows(filtered, low, high);
 const matches = disjoint ? [] : dated;
 const groups = new Map<string, typeof matches>();
 for (const row of matches.slice(0, limit)) {
  const group = groups.get(row.month);
  if (group) group.push(row);
  else groups.set(row.month, [row]);
 }
 const dateFiltered = Boolean(year || from || to);
 const hasFilters = dateFiltered || Boolean(category || status);
 function reset() {
  setYear(''); setMonth(''); setFrom(''); setTo(''); setCategory(''); setStatus(''); setLimit(24);
 }

 return <div className="activity-timeline">
  <div className="universe-heading"><h1>취향 연대기</h1><Link href="/explore">전체 탐색</Link></div>
  <div className="universe-filter-row timeline-filters" role="group" aria-label="연대기 필터" onChange={() => setLimit(24)}>
   <label>연도 <select value={year} onChange={event => { setYear(event.target.value); setMonth(''); }}>
    <option value="">전체</option>{years.map(value => <option key={value}>{value}</option>)}
   </select></label>
   <label>월 <select disabled={!year} value={month} onChange={event => setMonth(event.target.value)}>
    <option value="">전체</option>{Array.from({ length: 12 }, (_, index) => {
     const value = String(index + 1).padStart(2, '0');
     return <option key={value} value={value}>{index + 1}월</option>;
    })}
   </select></label>
   <label>카테고리 <select value={category} onChange={event => setCategory(event.target.value as CatalogKind | '')}>
    <option value="">전체</option>{Object.entries(catalogLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
   </select></label>
   <label>상태 <select value={status} onChange={event => setStatus(event.target.value as ActivityStatus | '')}>
    <option value="">전체</option>{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
   </select></label>
   <label>시작일 <input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
   <label>종료일 <input type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
   {hasFilters && <button className="button" type="button" onClick={reset}>조건 초기화</button>}
  </div>
  {sources?.errors.map(message => <p role="status" key={message}>{message}</p>)}
  {invalid ? <p role="alert">종료일은 시작일 이후여야 합니다.</p> : <>
   {!loading && <p className="universe-muted" role="status">날짜 확인 {matches.length}개{!dateFiltered && ' · 날짜 미상 ' + undated.length + '개'}</p>}
   {!loading && !matches.length && <p>{failed ? '일부 기록을 불러오지 못했어요.' : hasFilters ? '조건에 맞는 날짜 기록이 없어요.' : '날짜가 기록된 활동이 없어요.'}</p>}
   {Array.from(groups, ([key, rows]) => <section key={key}>
    <h2>{key.slice(0, 4)}년 {Number(key.slice(5))}월</h2>
    <ol className="timeline-list">{rows.map(({ item, day, end }) => <TimelineItem key={item.key} item={item} day={day} end={end}/>)}</ol>
   </section>)}
   {matches.length > limit && <button className="button" type="button" onClick={() => setLimit(value => value + 24)}>날짜 기록 더 보기</button>}
   {!dateFiltered && undated.length > 0 && <section>
    <h2>날짜 미상</h2><ul className="timeline-list">{undated.map(item => <TimelineItem key={item.key} item={item}/>)}</ul>
   </section>}
  </>}
 </div>;
}
