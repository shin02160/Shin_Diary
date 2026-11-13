'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { interestLinks } from '@/lib/interest-links';
import { calendarCatalogItem } from '@/lib/universe-catalog';
import { reviewMonth } from '@/lib/wiki-review';
import type { ArchiveCalendarEvent } from '@/lib/calendar/archive';
import { api } from '@/lib/notion-sync';
import { notionActivityUrl } from '@/lib/activity-view';
import { timelineDay, timelineRows } from '@/lib/activity-timeline';
import { interestMonths } from '@/lib/interest-months';
import { today } from '@/lib/local-store';
import { scheduleLabels } from '@/lib/calendar/schedule-state';
import { dayLabel } from '@/lib/dates';
import type { Interest, InterestResult } from '@/lib/interests';
import type { CatalogItem } from '@/lib/universe-catalog';
import { approvedKey, dismissedKey, storedLinks as stored } from '@/lib/interest-link-store';
import { CollectionCover } from './notion-collections';
import { Icon } from './icon';

const path = '/explore/interests';
type LinkRow = ReturnType<typeof interestLinks>[number];
const scheduleOnly = (row: LinkRow) => row.sources.every(source => source.sourceType === 'calendar');

// Schedules are listed apart from records, so the list and the detail count the same things.
function linkGroups(interest: Interest, items: CatalogItem[], approved: string[], dismissed: string[]) {
 const hidden = new Set(dismissed);
 const rows = interestLinks(interest, items, approved);
 const records = rows.filter(row => !scheduleOnly(row));
 return {
  confirmed: records.filter(row => row.confirmed),
  suggested: records.filter(row => !row.confirmed && !hidden.has(row.item.key)),
  schedules: rows.filter(row => scheduleOnly(row) && (row.confirmed || !hidden.has(row.item.key))),
  dismissed: rows.filter(row => !row.confirmed && hidden.has(row.item.key)),
 };
}

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
 const [query, setQuery] = useState('');
 const [order, setOrder] = useState<'name' | 'links'>('name');
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
 const search = query.trim().toLocaleLowerCase('ko-KR');
 const cards = interests.filter(item => (!category || item.category === category) && (!status || item.status === status) &&
  [item.name, item.category, ...item.tags].join(' ').toLocaleLowerCase('ko-KR').includes(search))
  .map(item => ({ item, links: linkGroups(item, items, stored(approvedKey(item.id)), stored(dismissedKey(item.id))) }));
 if (order === 'links') cards.sort((a, b) => b.links.confirmed.length - a.links.confirmed.length ||
  b.links.suggested.length - a.links.suggested.length || a.item.name.localeCompare(b.item.name, 'ko'));
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
   {interests.length > 0 && <div className="universe-filters">
    <label className="search icon-search"><Icon name="search" size="small"/><span className="sr-only">관심사 검색</span>
     <input type="search" placeholder="이름, 카테고리, 태그 검색" value={query} onChange={event => setQuery(event.target.value)}/>
    </label>
    <div className="universe-filter-row timeline-filters" role="group" aria-label="관심사 필터">
     <label>카테고리 <select value={category} onChange={event => setCategory(event.target.value)}>
      <option value="">전체</option>{categoryOptions.map(value => <option key={value}>{value}</option>)}
     </select></label>
     {statusOptions.length > 0 && <label>상태 <select value={status} onChange={event => setStatus(event.target.value)}>
      <option value="">전체</option>{statusOptions.map(value => <option key={value}>{value}</option>)}
     </select></label>}
     <label>정렬 <select value={order} onChange={event => setOrder(event.target.value as typeof order)}>
      <option value="name">이름순</option><option value="links">연결 많은 순</option>
     </select></label>
    </div>
   </div>}
   {!cards.length && <p role="status">{interests.length ? '조건에 맞는 관심사가 없어요.' : '등록된 관심사가 없어요.'}</p>}
   {cards.length > 0 && cards.every(({ item }) => item.relationsUnavailable) && <p className="universe-muted" role="status">관심사 DB에 기록 관계 속성이 없어 확정 연결은 이 브라우저에서 직접 확정한 것만 셉니다.</p>}
   {activitiesFailed && cards.length > 0 && <p role="status">일부 기록을 불러오지 못해 연결 수가 실제보다 적을 수 있어요.</p>}
   {cards.length > 0 && <div className="universe-cards interest-cards">
    {cards.map(({ item, links }) => <article key={item.id} className="universe-card universe-tone-project">
     {item.cover ? <CollectionCover src={item.cover} kind="project" compact/> :
      <span className="universe-type-thumbnail"><Icon name="interested" size="large"/></span>}
     <div className="universe-card-body">
      {item.category && <span className="universe-kind">{item.category}</span>}
      <h3><Link href={path + '?id=' + item.id}>{item.name}</Link></h3>
      {(item.preferenceLevel || item.status) && <p className="universe-meta">{[item.preferenceLevel && '선호 ' + item.preferenceLevel, item.status].filter(Boolean).join(' · ')}</p>}
      <p className="universe-meta">{loadingActivities ? '연결 기록 확인 중…' :
       '확정 연결 ' + links.confirmed.length + '건 · 추천 후보 ' + links.suggested.length + '건'}</p>
     </div>
    </article>)}
   </div>}
   {result.truncated && <p className="universe-muted">불러온 관심사만 표시합니다.</p>}
  </>}
  {interest && <>
   <div className="collection-record universe-tone-project">
    {interest.cover ? <CollectionCover src={interest.cover} kind="project"/> :
     <span className="universe-type-thumbnail"><Icon name="interested" size="large"/></span>}
    <p className="universe-meta">{[interest.category, interest.status, interest.preferenceLevel && '선호 ' + interest.preferenceLevel].filter(Boolean).join(' · ')}</p>
    <p className="universe-meta">{interest.startedAt ? '기록된 시작 ' + dayLabel(interest.startedAt) : '시작 시기 미기록'}
     {interest.endedAt && ' · 종료 ' + dayLabel(interest.endedAt)}{interest.lastReviewedAt && ' · 최근 검토 ' + dayLabel(interest.lastReviewedAt)}</p>
    {interest.tags.length > 0 && <p className="universe-meta">{interest.tags.map(tag => '#' + tag).join(' · ')}</p>}
   </div>
   <section><h2>좋아하는 이유</h2><p className="preserve-lines">{interest.why || '미기록'}</p></section>
   {interest.memo && <section><h2>메모</h2><p className="preserve-lines">{interest.memo}</p></section>}
   <InterestConnections key={interest.id} interest={interest}
    items={[...items, ...(schedule?.events ?? []).map(event => calendarCatalogItem(event, now))]}
    loading={loadingActivities || !schedule} recordsFailed={activitiesFailed} schedulesFailed={Boolean(schedule?.failed)}
    missing={Math.max(0, interest.relatedPageIds.length - dated.length - undated.length - directSchedules.length)}/>
   <p><Link className="text-link" href={'/explore/timeline?interest=' + encodeURIComponent(interest.id)}>이 관심사의 취향 연대기 보기</Link>
    {original && <> · <a className="text-link" href={original} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a></>}</p>
   <details className="resume-panel">
    <summary>월별 활동 수 보기</summary>
    <p className="universe-meta">Notion 관계로 연결된 활동과 일정의 건수예요. 건수는 취향의 크기를 뜻하지 않아요. 전체 통계는 <Link href="/report">활동 리포트</Link>에서 볼 수 있어요.</p>
    {(!schedule || loadingActivities) && <p role="status">월별 기록을 확인하는 중…</p>}
    {(schedule?.failed || activitiesFailed || interest.moreRelations) && <p role="status">조회할 수 있는 자료만 집계했어요.</p>}
    {schedule && !loadingActivities && !months.length && <p>날짜가 기록된 활동이나 일정이 없어요.</p>}
    {months.length > 0 && <ul>{months.map(row => <li key={row.month}>
     <strong>{row.month.slice(0, 4)}년 {Number(row.month.slice(5))}월</strong>
     {' · 활동 ' + row.activities + '개 · 일정 ' + row.schedules + '개 · 확인된 완료 ' + row.completed + '회'}
    </li>)}</ul>}
   </details>
  </>}
 </div>;
}

const connectionGroups = ['공연', '여행', '일상', '회고', '기타'] as const;
function connectionGroup(item: CatalogItem) {
 if (item.entry && reviewMonth(item.entry)) return '회고';
 return item.category === 'concert' ? '공연' : item.category === 'travel' ? '여행' :
  item.category === 'daily' ? '일상' : '기타';
}

function InterestConnections({ interest, items, loading, recordsFailed, schedulesFailed, missing }: {
 interest: Interest; items: CatalogItem[]; loading: boolean; recordsFailed: boolean; schedulesFailed: boolean; missing: number;
}) {
 const [approved, setApproved] = useState(() => stored(approvedKey(interest.id)));
 const [dismissed, setDismissed] = useState(() => stored(dismissedKey(interest.id)));
 const [error, setError] = useState(false);
 const [group, setGroup] = useState<typeof connectionGroups[number] | ''>('');
 const links = linkGroups(interest, items, approved, dismissed);
 const records = [...links.confirmed, ...links.suggested];
 const groups = connectionGroups.filter(name => records.some(row => connectionGroup(row.item) === name));
 const shown = (rows: LinkRow[]) => rows.filter(row => !group || connectionGroup(row.item) === group);

 function toggle(key: string, id: string, list: string[], update: (next: string[]) => void) {
  const next = list.includes(id) ? list.filter(value => value !== id) : [...list, id];
  try {
   localStorage.setItem(key, JSON.stringify(next));
   update(next);
   setError(false);
  } catch { setError(true); }
 }
 const approve = (id: string) => toggle(approvedKey(interest.id), id, approved, setApproved);
 const dismiss = (id: string) => toggle(dismissedKey(interest.id), id, dismissed, setDismissed);

 function rows(list: LinkRow[], hidden = false) {
  return <ul className="timeline-list">{list.map(({ item, confirmed, evidence, sources }) => {
   const day = timelineDay(item.startAt);
   const excerpt = item.entry ? item.summary?.trim().slice(0, 120) : '';
   return <li key={item.key} className={'universe-tone-' + item.category}>
    <h4><Link href={item.detailHref ?? item.originalUrl ?? '/explore'}>{item.title}</Link></h4>
    <p className="universe-meta">{day ? dayLabel(day) : '날짜 미기록'} · {item.scheduleState ? '일정 ' + scheduleLabels[item.scheduleState] : connectionGroup(item)} · 근거: {evidence}</p>
    {excerpt && <p className="universe-excerpt">{excerpt}{(item.summary?.trim().length ?? 0) > 120 && '…'}</p>}
    {sources.length > 1 && <ul aria-label="같은 경험의 원본">{sources.map(source => <li key={source.key}>
     <Link href={source.detailHref ?? source.originalUrl ?? '/explore'}>{source.type} · {source.title}</Link>
    </li>)}</ul>}
    {evidence !== 'Notion 관계' && <div className="form-actions">
     {hidden ? <button type="button" className="button" onClick={() => dismiss(item.key)}>후보로 되돌리기</button> : <>
      <button type="button" className="button" onClick={() => approve(item.key)}>{confirmed ? '확정 해제' : '연결 확정'}</button>
      {!confirmed && <button type="button" className="button" onClick={() => dismiss(item.key)}>관련 없음</button>}
     </>}
    </div>}
   </li>;
  })}</ul>;
 }

 return <section aria-labelledby="interest-records">
  <h2 id="interest-records">관련 기록</h2>
  {loading ? <p role="status">관련 기록을 찾는 중…</p> :
   <p><strong>확정 연결 {links.confirmed.length}건 · 추천 후보 {links.suggested.length}건</strong>{links.schedules.length > 0 && ' · 일정 ' + links.schedules.length + '건'}</p>}
  {recordsFailed && <p role="alert">일부 기록을 불러오지 못했어요. 아래는 조회된 범위에서 찾은 결과이며, 연결이 없다는 뜻은 아니에요.</p>}
  {interest.relationsUnavailable && <p role="status">관심사 DB에서 기록 관계 속성(관련 기록·관련 활동)을 찾지 못해 Notion 연결을 확인할 수 없어요. 연결된 기록이 없다는 뜻은 아니에요.</p>}
  {(missing > 0 || interest.moreRelations) && <p role="status">Notion에 연결된 기록 중 {missing > 0 ? missing + '건은' : '일부는'} 앱에서 조회할 수 없어 표시하지 못했어요.</p>}
  {error && <p role="alert">연결 선택을 저장하지 못했어요.</p>}
  {groups.length > 1 && <div className="chips" role="group" aria-label="기록 유형">
   {(['', ...groups] as const).map(name => <button key={name} type="button" aria-pressed={group === name} onClick={() => setGroup(name)}>{name || '전체'}</button>)}
  </div>}
  <h3>확정 연결</h3>
  {shown(links.confirmed).length > 0 ? rows(shown(links.confirmed)) :
   !loading && <p>{interest.relationsUnavailable || recordsFailed ? '확인된 연결을 표시할 수 없어요.' : 'Notion 관계나 직접 확정한 연결이 아직 없어요.'}</p>}
  <h3>추천 연결</h3>
  <p className="universe-meta">제목·태그·본문에서 찾은 후보예요. 확정과 제외는 이 브라우저에만 저장되고 Notion은 바뀌지 않아요.</p>
  {shown(links.suggested).length > 0 ? rows(shown(links.suggested)) : !loading && <p>{recordsFailed ? '조회된 자료에서는 후보를 찾지 못했어요.' : '추천할 후보가 없어요.'}</p>}
  <h3>관련 일정</h3>
  <p className="universe-meta">일정은 계획과 경과 상태만 보여줘요. 지난 일정이 실제 참석을 뜻하지는 않아요.</p>
  {schedulesFailed ? <p role="alert">관련 일정을 불러오지 못했어요.</p> :
   links.schedules.length > 0 ? rows(links.schedules) : !loading && <p>연결되거나 추천할 일정이 없어요.</p>}
  {links.dismissed.length > 0 && <details>
   <summary>관련 없음으로 제외한 후보 {links.dismissed.length}건</summary>
   {rows(links.dismissed, true)}
  </details>}
 </section>;
}
