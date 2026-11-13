'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { interestLinks } from '@/lib/interest-links';
import { calendarCatalogItem } from '@/lib/universe-catalog';
import { reviewMonth } from '@/lib/wiki-review';
import { archiveCalendarHref, type ArchiveCalendarEvent } from '@/lib/calendar/archive';
import { api } from '@/lib/notion-sync';
import { notionActivityUrl } from '@/lib/activity-view';
import { timelineRows } from '@/lib/activity-timeline';
import { interestMonths } from '@/lib/interest-months';
import { today } from '@/lib/local-store';
import { deriveScheduleState, scheduleLabels } from '@/lib/calendar/schedule-state';
import { dayLabel } from '@/lib/dates';
import type { Interest, InterestResult } from '@/lib/interests';
import type { CatalogItem } from '@/lib/universe-catalog';
import { CollectionCover } from './notion-collections';

const path = '/explore/interests';

function relatedItems(interest: Interest, items: CatalogItem[]) {
 const ids = new Set(interest.relatedPageIds);
 return items.filter(item => item.originalUrl && ids.has(item.sourcePageId.replaceAll('-', '').toLowerCase()));
}

export function InterestsView({ items, loadingActivities, activitiesFailed, interestId }: {
 items: CatalogItem[];
 loadingActivities: boolean;
 activitiesFailed: boolean;
 interestId?: string;
}) {
 const [result, setResult] = useState<InterestResult>();
 const [schedule, setSchedule] = useState<{ events: ArchiveCalendarEvent[]; failed?: boolean }>();
 const [error, setError] = useState('');
 const [attempt, setAttempt] = useState(0);
 const [category, setCategory] = useState('');
 const [status, setStatus] = useState('');
 useEffect(() => {
  let active = true;
  void api<InterestResult>('interests' + (interestId ? '?id=' + encodeURIComponent(interestId) : ''))
   .then(value => { if (active) setResult(value); })
   .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : '관심사를 불러오지 못했어요.'); });
  if (interestId) {
   void api<{ events: ArchiveCalendarEvent[] }>('life-calendar')
    .then(value => { if (active) setSchedule(value); })
    .catch(() => { if (active) setSchedule({ events: [], failed: true }); });
  }
  return () => { active = false; };
 }, [interestId, attempt]);

 const interests = result?.interests ?? [];
 const interest = interestId ? interests[0] : undefined;
 const categoryOptions = [...new Set(interests.flatMap(item => item.category ? [item.category] : []))].sort((a, b) => a.localeCompare(b, 'ko'));
 const statusOptions = [...new Set(interests.flatMap(item => item.status ? [item.status] : []))].sort((a, b) => a.localeCompare(b, 'ko'));
 const shown = interests.filter(item => (!category || item.category === category) && (!status || item.status === status));
 const { dated, undated } = timelineRows(interest ? relatedItems(interest, items) : []);
 const [now] = useState(Date.now);
 const directSchedules = (schedule?.events ?? []).filter(event =>
  interest && (event.interestIds?.includes(interest.id) || interest.relatedPageIds.includes(event.pageId)));
 const months = interestMonths(dated.map(row => row.item), directSchedules, today(), now);
 const original = notionActivityUrl(interest?.id);

 return <div className="activity-timeline">
  <div className="universe-heading"><h1>{interest?.name ?? '관심사'}</h1>
   <Link href={interestId ? path : '/explore'}>{interestId ? '관심사 목록' : '전체 탐색'}</Link></div>
  {!result && !error && <p role="status">관심사를 불러오는 중…</p>}
  {error && <div className="universe-load-error"><p role="alert">{error}</p>
   <button className="button" type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>다시 불러오기</button></div>}
  {result && !result.configured && <p>아직 연결된 Notion 관심사 데이터 소스가 없어요.</p>}
  {result?.configured && !interestId && <>
   {interests.length > 0 && <div className="universe-filter-row timeline-filters" role="group" aria-label="관심사 필터">
    <label>카테고리 <select value={category} onChange={event => setCategory(event.target.value)}>
     <option value="">전체</option>{categoryOptions.map(value => <option key={value}>{value}</option>)}
    </select></label>
    <label>상태 <select value={status} onChange={event => setStatus(event.target.value)}>
     <option value="">전체</option>{statusOptions.map(value => <option key={value}>{value}</option>)}
    </select></label>
   </div>}
   {!shown.length && <p role="status">{interests.length ? '조건에 맞는 관심사가 없어요.' : '등록된 관심사가 없어요.'}</p>}
   {shown.length > 0 && <ul className="timeline-list">
    {shown.map(item => {
     const latest = timelineRows(relatedItems(item, items)).dated[0]?.day;
     return <li key={item.id} className="universe-tone-project">
      <h3><Link href={path + '?id=' + item.id}>{item.name}</Link></h3>
      <p className="universe-meta">{[item.category, item.status].filter(Boolean).join(' · ')}</p>
      <p className="universe-meta">시작 {item.startedAt ? dayLabel(item.startedAt) : '미기록'} · 관련 활동 {item.relatedPageIds.length}{item.moreRelations ? '+' : ''}개</p>
      <p className="universe-meta">최근 활동 {latest ? dayLabel(latest) : loadingActivities ? '조회 중' : activitiesFailed ? '조회 실패' : '미기록'}</p>
     </li>;
    })}
   </ul>}
   {result.truncated && <p className="universe-muted">불러온 관심사만 표시합니다.</p>}
  </>}
  {interest && <>
   <div className="collection-record universe-tone-project">
    <CollectionCover src={interest.cover} kind="project"/>
    <p className="universe-meta">{[interest.category, interest.status, interest.preferenceLevel].filter(Boolean).join(' · ')}</p>
    <p>시작 {interest.startedAt ? dayLabel(interest.startedAt) : '미기록'}</p>
    {interest.endedAt && <p>종료 {dayLabel(interest.endedAt)}</p>}
    {interest.lastReviewedAt && <p>최근 검토 {dayLabel(interest.lastReviewedAt)}</p>}
    {interest.tags.length > 0 && <p>{interest.tags.join(' · ')}</p>}
    {original && <a className="text-link" href={original} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a>}
   </div>
   {interest.memo && <section><h2>메모</h2><p className="preserve-lines">{interest.memo}</p></section>}
   <section><h2>좋아하는 이유</h2><p className="preserve-lines">{interest.why || '미기록'}</p></section>
   <section className="resume-panel" aria-labelledby="interest-months">
    <h2 id="interest-months">월별 활동</h2>
    {(!schedule || loadingActivities) && <p role="status">월별 기록을 확인하는 중…</p>}
    {(schedule?.failed || activitiesFailed || interest.moreRelations ||
      interest.relatedPageIds.length > dated.length + undated.length) && <p role="status">조회할 수 있는 자료만 집계했어요.</p>}
    {schedule && !loadingActivities && !months.length && <p>날짜가 기록된 활동이나 일정이 없어요.</p>}
    {months.length > 0 && <>
     <p>시작일 기준으로 집계합니다. 완료 수에는 완료 상태가 기록된 활동과 확인된 필라테스 레슨이 포함됩니다.</p>
     <ul>{months.map(row => <li key={row.month}>
      <strong>{row.month.slice(0, 4)}년 {Number(row.month.slice(5))}월</strong>
      {' · 활동 ' + row.activities + '개 · 일정 ' + row.schedules + '개 · 확인된 완료 ' + row.completed + '회'}
     </li>)}</ul>
     <p><a href="#interest-activities">활동 기록 보기</a> · <a href="#interest-schedule">일정 기록 보기</a></p>
    </>}
   </section>
   <InterestConnections key={interest.id} interest={interest}
    items={[...items, ...(schedule?.events ?? []).map(event => calendarCatalogItem(event, now))]}
    loading={loadingActivities || !schedule} failed={activitiesFailed || Boolean(schedule?.failed)}/>
   <section id="interest-schedule"><h2>관련 일정</h2>
    {!schedule ? <p role="status">관련 일정을 불러오는 중…</p> : schedule.failed
     ? <p role="alert">관련 일정을 불러오지 못했어요.</p> : !directSchedules.length
     ? <p>Notion 관계로 연결된 일정이 없어요.</p> : <ul className="timeline-list">
      {directSchedules.map(event => <li key={event.pageId}>
       <h3><Link href={archiveCalendarHref(event)}>{event.title}</Link></h3>
       <p className="universe-meta">{dayLabel(event.wallStart.slice(0, 10))} · {scheduleLabels[event.scheduleState ?? deriveScheduleState(event, now)]}</p>
      </li>)}
     </ul>}
   </section>
   <section id="interest-activities"><h2>관련 활동</h2>
    {loadingActivities ? <p role="status">활동을 불러오는 중…</p> : <>
     {dated.length + undated.length > 0 && <ul className="timeline-list">
      {[...dated.map(row => ({ item: row.item, day: row.day })), ...undated.map(item => ({ item, day: undefined }))].map(({ item, day }) => <li key={item.key} className={'universe-tone-' + item.category}>
       <h3>{item.detailHref ? <Link href={item.detailHref}>{item.title}</Link> : <a href={item.originalUrl} target="_blank" rel="noopener noreferrer">{item.title}</a>}</h3>
       <p className="universe-meta">{day ? dayLabel(day) : '날짜 미상'}</p>
      </li>)}
     </ul>}
     {!interest.relatedPageIds.length && <p>Notion 관계로 연결된 활동이 없어요.</p>}
     {interest.relatedPageIds.length > dated.length + undated.length && <p>일부 연결 활동은 앱에서 조회할 수 있어야 표시됩니다.</p>}
    </>}
    {interest.moreRelations && <p>일부 연결 활동만 불러왔어요.</p>}
   </section>
  </>}
 </div>;
}

const connectionGroups = ['공연', '여행', '일상', '회고', '기타'] as const;
function connectionGroup(item: CatalogItem) {
 if (item.entry && reviewMonth(item.entry)) return '회고';
 return item.category === 'concert' ? '공연' : item.category === 'travel' ? '여행' :
  item.category === 'daily' ? '일상' : '기타';
}

function InterestConnections({ interest, items, loading, failed }: {
 interest: Interest; items: CatalogItem[]; loading: boolean; failed: boolean;
}) {
 const key = 'mlu.interest-links.' + interest.id;
 const [approved, setApproved] = useState<string[]>(() => {
  try {
   const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
   return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
  } catch { return []; }
 });
 const [error, setError] = useState(false);
 const links = interestLinks(interest, items, approved);
 function toggle(id: string) {
  const next = approved.includes(id) ? approved.filter(value => value !== id) : [...approved, id];
  try {
   localStorage.setItem(key, JSON.stringify(next));
   setApproved(next);
   setError(false);
  } catch { setError(true); }
 }
 return <section aria-labelledby="interest-records">
  <h2 id="interest-records">관련 기록</h2>
  <p>추천 근거를 확인한 뒤 이 브라우저에서 연결을 확정할 수 있어요.</p>
  {loading && <p role="status">관련 기록을 찾는 중…</p>}
  {failed && <p role="status">조회할 수 있는 자료에서 찾은 결과를 표시합니다.</p>}
  {!loading && !failed && !links.length && <p>조회한 자료에서 관련 근거를 찾지 못했어요.</p>}
  {error && <p role="alert">연결 선택을 저장하지 못했어요.</p>}
  {connectionGroups.map(group => {
   const rows = links.filter(row => connectionGroup(row.item) === group);
   if (!rows.length) return null;
   return <section key={group}><h3>{group} · {rows.length}건</h3>
    <ul className="timeline-list">{rows.map(({ item, confirmed, evidence, sources }) => <li key={item.key}>
     <h4><Link href={item.detailHref ?? item.originalUrl ?? '/explore'}>{item.title}</Link></h4>
     <p className="universe-meta">{timelineRows([item]).dated[0]?.day ?? '날짜 미기록'} · {confirmed ? '확정 연결' : '추천 연결'} · {evidence}</p>
     {sources.length > 1 && <ul aria-label="같은 경험의 원본">{sources.map(source => <li key={source.key}>
      <Link href={source.detailHref ?? source.originalUrl ?? '/explore'}>{source.type} · {source.title}</Link>
     </li>)}</ul>}
     {evidence !== 'Notion 관계' && <button type="button" className="button" onClick={() => toggle(item.key)}>
      {confirmed ? '확정 해제' : '연결 확정'}
     </button>}
    </li>)}</ul>
   </section>;
  })}
 </section>;
}
