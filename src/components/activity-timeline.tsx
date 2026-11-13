'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { dayLabel } from '@/lib/dates';
import { timelineDay, timelineRows, timelineYearCounts, timelineCalendarMatches } from '@/lib/activity-timeline';
import { calendarCatalogItem, catalogLabels, type CatalogItem, type CatalogKind } from '@/lib/universe-catalog';
import { deduplicateActivities, parseActivityDate, type ActivityStatus } from '@/lib/activity-view';
import { type ArchiveCalendarEvent } from '@/lib/calendar/archive';
import { reviewMonth, gptReviewId } from '@/lib/wiki-review';
import { scheduleLabels } from '@/lib/calendar/schedule-state';
import { calendarType, calendarTypeLabels, confirmedLesson, type CalendarType } from '@/lib/calendar/classification';
import { interestHistory } from '@/lib/interest-history';
import type { InterestResult } from '@/lib/interests';
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

type TimelineRecord = CatalogItem & { inferredCategory?: CalendarType; experienceVerified?: boolean };

function calendarItem(event: ArchiveCalendarEvent): TimelineRecord {
 const item = calendarCatalogItem(event, Date.now());
 const inferred = calendarType(event);
 return {
  ...item, inferredCategory: inferred,
  experienceVerified: item.scheduleState === 'completed' && confirmedLesson(event, today()),
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

function TimelineItem({ item, day, end, calendar, editCategory }: {
 item: TimelineRecord; day?: string; end?: string; calendar?: CatalogItem; editCategory?: boolean;
}) {
 return <li className={'universe-tone-' + item.category}>
  <div><span className="universe-kind">{item.type === '일정' || item.type === '타임라인 이벤트' ? item.type : catalogLabels[item.category]}</span> <span className="universe-meta">{item.scheduleState ? scheduleLabels[item.scheduleState] : labels[item.status]}</span></div>
  <h3>{item.detailHref ? <Link href={item.detailHref}>{item.title}</Link> : item.title}</h3>
  {day && <p className="universe-meta"><time dateTime={day}>{dayLabel(day)}</time>
   {end && end !== day && <> ~ <time dateTime={end}>{dayLabel(end)}</time></>}</p>}
  {item.detail && item.sourceType === 'timeline' && <p className="universe-meta">{item.sourceType === 'timeline' && '원본 관련 관심사 · '}{item.detail}</p>}
  {item.location && <p className="universe-meta">{item.location}</p>}
  {item.inferredCategory && (editCategory ? <CalendarCategory item={item} inferred={item.inferredCategory}/> :
   <p className="universe-meta">{inferenceLabel(item.inferredCategory)}</p>)}
  {calendar?.detailHref && <p><Link href={calendar.detailHref}>연결된 캘린더 일정 보기</Link></p>}
  {item.originalUrl && <a className="text-link" href={item.originalUrl} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a>}
 </li>;
}

function inferenceLabel(type: CalendarType) {
 return type === 'unknown' ? '유형 미확인' : '추정 유형 · ' + calendarTypeLabels[type];
}

function CalendarCategory({ item, inferred }: { item: TimelineRecord; inferred: CalendarType }) {
 const storageKey = 'mlu.timeline.calendar-type.' + item.sourcePageId;
 const [choice, setChoice] = useState<CalendarType | ''>(() => {
  try {
   const stored = localStorage.getItem(storageKey);
   if (stored && Object.hasOwn(calendarTypeLabels, stored)) return stored as CalendarType;
  } catch { /* Keep automatic classification when storage is unavailable. */ }
  return '';
 });
 const [error, setError] = useState(false);

 function change(value: string) {
  try {
   if (value) localStorage.setItem(storageKey, value);
   else localStorage.removeItem(storageKey);
   setChoice(value as CalendarType | '');
   setError(false);
  } catch { setError(true); }
 }

 return <div>
  <p className="universe-meta">{choice ? "선택한 유형 · " + calendarTypeLabels[choice] + " / " : ""}{inferenceLabel(inferred)}</p>
  <label>이 브라우저에서 표시할 유형{' '}
   <select aria-label={item.title + ' 일정 유형'} value={choice} onChange={event => change(event.target.value)}>
    <option value="">자동 분류 사용</option>
    {Object.entries(calendarTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
   </select>
  </label>
  {error && <p role="alert">이 브라우저에 유형을 저장하지 못했어요.</p>}
 </div>;
}

export function ActivityTimeline({ items: catalog, loading: catalogLoading, failed: catalogFailed }: { items: CatalogItem[]; loading: boolean; failed: boolean }) {
 const [sources, setSources] = useState<{ items: TimelineRecord[]; errors: string[]; interests?: InterestResult }>();
 useEffect(() => {
  let active = true;
  void Promise.allSettled([
   api<{ events: ArchiveCalendarEvent[] }>('life-calendar'),
   api<{ events: TimelineEvent[]; configured: boolean }>('timeline-events'),
   api<InterestResult>('interests'),
  ]).then(([calendar, history, interests]) => {
   if (!active) return;
   setSources({
    interests: interests.status === 'fulfilled' ? interests.value : undefined,
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
 const items = deduplicateActivities<TimelineRecord>([...(sources?.items ?? []), ...catalog]);
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
 const [insightYear, setInsightYear] = useState('');
 const experienceItems = items.filter(item => !item.entry || (!reviewMonth(item.entry) &&
  item.entry.id !== gptReviewId(timelineDay(item.startAt)?.slice(0, 7) ?? '')));
 const insightRows = timelineRows(experienceItems).dated;
 const selectedInsightYear = insightYear || insightRows.find(row => row.day <= today())?.day.slice(0, 4) || years[0];
 const insightSources = insightRows.filter(row => row.day.startsWith(selectedInsightYear + '-'));
 const insightUnique = insightSources.filter(({ item }) => {
  const match = calendarMatches.get(item.key);
  return !match || timelineDay(match.startAt)?.slice(0, 4) !== selectedInsightYear;
 });
 const currentDay = today();
 const elapsedSchedules = insightSources.filter(({ item }) => item.sourceType === 'calendar' && item.status === 'done');
 const plannedSchedules = insightSources.filter(({ item }) => item.sourceType === 'calendar' && item.status === 'planned');
 const cancelledSchedules = insightSources.filter(({ item }) => item.sourceType === 'calendar' && item.status === 'cancelled');
 const unknownSchedules = insightSources.filter(({ item }) => item.sourceType === 'calendar' && item.status === 'unknown');
 const confirmed = insightUnique.filter(({ item, day, end }) => item.status === 'done' && (item.sourceType !== 'calendar' || item.experienceVerified) && (end ?? day) <= currentDay);
 const upcoming = insightRows.filter(({ item, day }) => item.status !== 'cancelled' && item.sourceType !== 'entry' &&
  item.sourceType !== 'timeline' && (item.sourceType === 'calendar' ? item.status === 'planned' : day >= currentDay && item.status !== 'done')).sort((a, b) => a.day.localeCompare(b.day));
 const pastRows = insightRows.filter(({ item, day }) => day <= currentDay && !['planned', 'cancelled'].includes(item.status));
 const interestTrends = (sources?.interests?.interests ?? []).flatMap(interest => {
  const history = interestHistory(interest, pastRows, selectedInsightYear ?? '');
  return history ? [{ interest, ...history }] : [];
 });
 const confirmedCategories = Object.entries(catalogLabels).map(([key, label]) => ({
  label: key === 'uncategorized' ? '기타 활동' : label,
  count: confirmed.filter(({ item }) => !item.experienceVerified && item.category === key).length,
 }));
 confirmedCategories.push({ label: '일상 · 운동', count: confirmed.filter(({ item }) => item.experienceVerified).length });
 const rankedCategories = confirmedCategories.filter(row => row.count > 0).sort((a, b) => b.count - a.count);
 const activityMonths = [...new Set([...elapsedSchedules, ...plannedSchedules, ...confirmed].map(row => row.month))].sort();
 const highlighted = confirmed.slice(0, 3);
 const linkedStories = insightSources.filter(({ item }) => calendarMatches.has(item.key)).slice(0, 3);
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
  <section className="resume-panel" aria-labelledby="timeline-insights">
   <h2 id="timeline-insights">시기별 이야기</h2>
   {loading ? <p role="status">기록을 불러오는 중…</p> : <>
    {failed && <p role="status">조회할 수 있는 자료만 분석했어요.</p>}
    <label>분석 연도 <select value={selectedInsightYear} onChange={event => setInsightYear(event.target.value)}>
     {years.map(value => <option key={value}>{value}</option>)}
    </select></label>
    {insightSources.length > 0 && <p>{selectedInsightYear}년에 시작한 원본 {insightSources.length}개 · 확인된 일정 연결을 합친 기록 {insightUnique.length}개</p>}
    <p>완료 일정 {elapsedSchedules.length}건 · 예정 {plannedSchedules.length}건 · 취소 {cancelledSchedules.length}건 · 상태 미확인 {unknownSchedules.length}건</p>
    {activityMonths.length > 0 && <>
     <h3>월별 활동 흐름</h3>
     <ul>{activityMonths.map(month => <li key={month}>{Number(month.slice(5))}월{' · '}
      완료 일정 {elapsedSchedules.filter(row => row.month === month).length}건{' · '}
      예정 {plannedSchedules.filter(row => row.month === month).length}건{' · '}
      실제 경험 확인 {confirmed.filter(row => row.month === month).length}건
     </li>)}</ul>
    </>}
    {confirmed.length > 0 ? <>
     <p>실제 경험이 확인된 기록은 {confirmed.length}건이고, 가장 많이 확인된 분야는 {rankedCategories[0].label}이에요.</p>
     <ul aria-label="확인된 경험의 분야별 비중">
      {rankedCategories.map(row => <li key={row.label}>{row.label} {row.count}건{' '}
       <meter aria-label={row.label + '의 완료 경험 비중'} min={0} max={confirmed.length} value={row.count}/>
      </li>)}
     </ul>
     <h3>기록으로 확인된 순간</h3>
     <ul className="timeline-list">{highlighted.map(({ item, day, end }) => <TimelineItem key={item.key} item={item} day={day} end={end}/>)}</ul>
    </> : <p>이 기간에는 완료 여부를 확인할 수 있는 경험 자료가 부족해요.</p>}
    <h3>관심사 흐름</h3>
    {!sources?.interests ? <p role="status">관심사 자료를 불러오지 못했어요.</p> :
     !interestTrends.length ? <p>이 해에 관심사와 연결된 지난 기록이 없어요.</p> : <>
      <p>Notion에서 연결된 지난 기록의 월별 빈도입니다.</p>
      {interestTrends.slice(0, 5).map(({ interest, label, months }) => <div key={interest.id}>
       <h4><Link href={'/explore/interests?id=' + encodeURIComponent(interest.id)}>{interest.name}</Link></h4>
       <p>{label}{months.length > 1 && ' · ' + months.length + '개월에 걸쳐 기록'}</p>
       <ul>{months.map(([month, count]) => <li key={month}>{Number(month.slice(5))}월 {count}건{' '}
        <meter aria-label={interest.name + ' ' + Number(month.slice(5)) + '월 연결 기록'} min={0}
         max={Math.max(...months.map(([, total]) => total))} value={count}/>
       </li>)}</ul>
      </div>)}
      {interestTrends.length > 5 && <Link href="/explore/interests">전체 관심사 보기</Link>}
     </>}
    {linkedStories.length > 0 && <>
     <h3>일정과 연결된 기록</h3>
     <ul className="timeline-list">{linkedStories.map(({ item, day, end }) => <TimelineItem key={item.key} item={item} day={day} end={end} calendar={calendarMatches.get(item.key)}/>)}</ul>
    </>}
    {upcoming.length > 0 && <>
     <h3>예정된 일정과 계획</h3>
     <ul className="timeline-list">{upcoming.slice(0, 3).map(({ item, day, end }) => <TimelineItem key={item.key} item={item} day={day} end={end}/>)}</ul>
    </>}
    <a href="#timeline-evidence" onClick={() => {
     const evidence = document.querySelector<HTMLDetailsElement>('#timeline-evidence');
     if (evidence) evidence.open = true;
    }}>근거 기록 보기</a>
   </>}
  </section>
  <details id="timeline-evidence" className="resume-panel">
   <summary>모든 원본 기록 보기</summary>
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
        <TimelineItem key={item.key} item={item} day={day} end={end} calendar={calendarMatches.get(item.key)} editCategory/>)}</ol>
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
  </details>
 </div>;
}
