'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { dayLabel } from '@/lib/dates';
import { timelineDay, timelineRows, timelineYearCounts, timelineCalendarMatches } from '@/lib/activity-timeline';
import { buildCatalog, catalogLabels, type CatalogItem, type CatalogKind } from '@/lib/universe-catalog';
import { deduplicateActivities, parseActivityDate, type ActivityStatus } from '@/lib/activity-view';
import { archiveCalendarEndDay, archiveCalendarHref, type ArchiveCalendarEvent } from '@/lib/calendar/archive';
import type { Entry } from '@/lib/types';
import { today } from '@/lib/local-store';
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
  detailHref: archiveCalendarHref(event),
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

function TimelineItem({ item, day, end, calendar }: { item: CatalogItem; day?: string; end?: string; calendar?: CatalogItem }) {
 return <li className={'universe-tone-' + item.category}>
  <div><span className="universe-kind">{item.type === '일정' || item.type === '타임라인 이벤트' ? item.type : catalogLabels[item.category]}</span> <span className="universe-meta">{labels[item.status]}</span></div>
  <h3>{item.detailHref ? <Link href={item.detailHref}>{item.title}</Link> : item.title}</h3>
  {day && <p className="universe-meta"><time dateTime={day}>{dayLabel(day)}</time>
   {end && end !== day && <> ~ <time dateTime={end}>{dayLabel(end)}</time></>}</p>}
  {item.detail && item.sourceType === 'timeline' && <p className="universe-meta">원본 관련 관심사 · {item.detail}</p>}
  {item.location && <p className="universe-meta">{item.location}</p>}
  {calendar?.detailHref && <p><Link href={calendar.detailHref}>연결된 캘린더 일정 보기</Link></p>}
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
   api<{ entries: Entry[] }>('wiki-entries'),
  ]).then(([calendar, history, wiki]) => {
   if (!active) return;
   setSources({
    items: [
     ...(wiki.status === 'fulfilled' ? buildCatalog({ entries: wiki.value.entries, activities: [] }).map(item => ({
      ...item, detailHref: '/wiki?entry=' + encodeURIComponent(item.entry!.id),
     })) : []),
     ...(calendar.status === 'fulfilled' ? calendar.value.events.map(calendarItem) : []),
     ...(history.status === 'fulfilled' ? history.value.events.map(sourceItem) : []),
    ],
    errors: [
     ...(wiki.status === 'rejected' ? ['Notion 기록을 불러오지 못했어요.'] : []),
     ...(calendar.status === 'rejected' ? ['Notion 일정을 불러오지 못했어요.'] : []),
     ...(history.status === 'rejected' ? ['Notion 타임라인 이벤트를 불러오지 못했어요.']
      : history.value.configured ? [] : ['연결된 Notion 타임라인 데이터 소스가 없어요.']),
    ],
   });
  });
  return () => { active = false; };
 }, []);
 const items = deduplicateActivities([...(sources?.items ?? []), ...catalog]);
 const loading = catalogLoading || !sources;
 const failed = catalogFailed || Boolean(sources?.errors.length);
 const [year, setYear] = useState('');
 const [month, setMonth] = useState('');
 const [from, setFrom] = useState('');
 const [to, setTo] = useState('');
 const [category, setCategory] = useState<CatalogKind | ''>('');
 const [status, setStatus] = useState<ActivityStatus | ''>('');
 const [limit, setLimit] = useState(24);
 const [openedMonth, setOpenedMonth] = useState('');
 const [comparisonYear, setComparisonYear] = useState('');
 const [startYearOnly, setStartYearOnly] = useState(false);
 const years = [...new Set(items.flatMap(item => {
  const start = timelineDay(item.startAt);
  const end = timelineDay(item.endAt);
  if (!start) return [];
  const first = Number(start.slice(0, 4));
  const last = Math.max(first, Number((end ?? start).slice(0, 4)));
  return Array.from({ length: last - first + 1 }, (_, index) => String(first + index).padStart(4, '0'));
 }))].sort().reverse();
 const calendarMatches = timelineCalendarMatches(items);
 const annual = timelineYearCounts(items, today(), calendarMatches);
 const recordedYears = [...annual.keys()].sort().reverse();
 const newestYear = recordedYears[0];
 const earlierYear = recordedYears.includes(comparisonYear) && comparisonYear !== newestYear ? comparisonYear : recordedYears[1];
 const period = year && month ? year + '-' + month : year;
 const lastDay = year && month ? new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate() : 31;
 const periodStart = period ? period + (month ? '-01' : '-01-01') : '';
 const periodEnd = period ? period + (month ? '-' + lastDay : '-12-31') : '';
 const low = [from, periodStart].sort().at(-1) ?? '';
 const high = [to, periodEnd].filter(Boolean).sort()[0] ?? '';
 const invalid = Boolean(from && to && from > to);
 const disjoint = Boolean(low && high && low > high);
 const filtered = items.filter(item => (!startYearOnly || timelineDay(item.startAt)?.slice(0, 4) === year) && (!category || item.category === category) && (!status || item.status === status));
 const { dated, undated } = timelineRows(filtered, low, high);
 const matches = disjoint ? [] : dated;
 const groups = new Map<string, typeof matches>();
 for (const row of matches) {
  const group = groups.get(row.month);
  if (group) group.push(row);
  else groups.set(row.month, [row]);
 }
 const activeMonth = groups.has(openedMonth) ? openedMonth : '';
 const monthRows = groups.get(activeMonth) ?? [];
 const dateFiltered = Boolean(year || from || to);
 const hasFilters = dateFiltered || Boolean(category || status);
 function reset() {
  setStartYearOnly(false); setYear(''); setMonth(''); setFrom(''); setTo(''); setCategory(''); setStatus(''); setOpenedMonth(''); setLimit(24);
 }

 return <div className="activity-timeline">
  <div className="universe-heading"><h1>취향 연대기</h1><Link href="/explore">전체 탐색</Link></div>
  {!loading && <details className="resume-panel">
   <summary>연도별 기록 비교</summary>
   {failed && <p role="status">일부 자료를 불러오지 못해 조회된 기록만 집계했어요.</p>}
   {earlierYear ? <>
    <p>시작일이 있는 원본 기록을 분야별로 비교합니다. 완료 수는 종료일이 지난 기록 중 완료 상태인 건수입니다.</p>
    <label>비교 연도 <select value={earlierYear} onChange={event => setComparisonYear(event.target.value)}>
     {recordedYears.slice(1).map(value => <option key={value}>{value}</option>)}
    </select></label>
    <ul>{[earlierYear, newestYear].map(value => {
     const totals = [...(annual.get(value)?.values() ?? [])];
     const records = totals.reduce((sum, counts) => sum + counts.records, 0);
     const copies = totals.reduce((sum, counts) => sum + counts.linkedCopies, 0);
     return <li key={value}>{value}년 원본 {records}개 · 일정 연결 중복 {copies}개 · 연결 반영 후 {records - copies}개</li>;
    })}</ul>
    <div className="timeline-comparison">
     <table>
      <caption>분야별 원본 기록 수와 완료 수</caption>
      <thead><tr><th scope="col">분야</th><th scope="col">{earlierYear}년</th><th scope="col">{newestYear}년</th></tr></thead>
      <tbody>{Object.entries(catalogLabels).map(([key, label]) => {
       const kind = key as CatalogKind;
       return <tr key={kind}><th scope="row">{label}</th>{[earlierYear, newestYear].map(value => {
        const counts = annual.get(value)?.get(kind);
        return <td key={value}>{counts ? <button type="button" className="text-link"
         aria-label={value + '년 ' + label + ' 기록 ' + counts.records + '개 보기'}
         onClick={() => {
          reset(); setYear(value); setCategory(kind); setStartYearOnly(true);
          document.getElementById('timeline-results')?.focus();
         }}>{counts.records}개 / 완료 {counts.completed}</button> : '0개'}</td>;
       })}</tr>;
      })}</tbody>
     </table>
    </div>
   </> : <p>시작일이 있는 기록이 두 해 이상 쌓이면 비교할 수 있어요.</p>}
  </details>}
  <div className="universe-filter-row timeline-filters" role="group" aria-label="연대기 필터" onChange={() => { setOpenedMonth(''); setLimit(24); }}>
   <label>연도 <select value={year} onChange={event => { setStartYearOnly(false); setYear(event.target.value); setMonth(''); }}>
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
  <div id="timeline-results" tabIndex={-1}>
  {invalid ? <p role="alert">종료일은 시작일 이후여야 합니다.</p> : <>
   {!loading && <p className="universe-muted" role="status">{startYearOnly ? '선택한 해에 시작한 기록' : '날짜 확인'} {matches.length}개{!dateFiltered && ' · 날짜 미상 ' + undated.length + '개'}</p>}
   {!loading && !matches.length && <p>{failed ? '일부 기록을 불러오지 못했어요.' : hasFilters ? '조건에 맞는 날짜 기록이 없어요.' : '날짜가 기록된 활동이 없어요.'}</p>}
   {Array.from(groups, ([key, rows]) => {
    const expanded = key === activeMonth;
    const monthLabel = key.slice(0, 4) + '년 ' + Number(key.slice(5)) + '월';
    const completed = rows.filter(({ item }) => item.status === 'done').length;
    return <section key={key} className="resume-panel">
     <h2>{monthLabel}</h2>
     <p className="universe-meta">원본 기록 {rows.length}개 · 완료로 표시된 기록 {completed}개</p>
     {!expanded && <ul>{rows.slice(0, 2).map(({ item }) => <li key={item.key}>{item.title}</li>)}</ul>}
     <button className="button" type="button" aria-expanded={expanded} aria-controls={'timeline-month-' + key}
      onClick={() => { setOpenedMonth(expanded ? '' : key); setLimit(24); }}>
      {monthLabel} {expanded ? '접기' : '상세 보기'}
     </button>
     <div id={'timeline-month-' + key} hidden={!expanded}>
      {expanded && <>
       <ol className="timeline-list">{monthRows.slice(0, limit).map(({ item, day, end }) =>
        <TimelineItem key={item.key} item={item} day={day} end={end} calendar={calendarMatches.get(item.key)}/>)}</ol>
       {monthRows.length > limit && <button className="button" type="button" onClick={() => setLimit(value => value + 24)}>날짜 기록 더 보기</button>}
      </>}
     </div>
    </section>;
   })}
   {!dateFiltered && undated.length > 0 && <section>
    <h2>날짜 미상</h2><ul className="timeline-list">{undated.map(item => <TimelineItem key={item.key} item={item}/>)}</ul>
   </section>}
  </>}
  </div>
 </div>;
}
