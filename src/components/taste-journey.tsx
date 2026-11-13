'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { dayLabel } from '@/lib/dates';
import { tasteClues, tasteEvidence } from '@/lib/interest-history';
import { approvedKey, dismissedKey, storedLinks } from '@/lib/interest-link-store';
import type { Interest } from '@/lib/interests';
import { today } from '@/lib/local-store';
import { catalogLabels, type CatalogItem } from '@/lib/universe-catalog';
import { CollectionCover } from './notion-collections';
import { TasteLanes } from './taste-lanes';
import { TasteEras } from './taste-eras';
import { tasteEras } from '@/lib/taste-eras';

const PAGE = 6, HIGHLIGHTS = 4;
const interestHref = (id: string) => '/explore/interests?id=' + encodeURIComponent(id);
// Concerts and trips are the experiences worth leading with; everyday notes stay in the full list.
const major = (item: CatalogItem) => item.kind === 'concert' || item.kind === 'travel';

export function TasteJourney({ items, interests, loading, errors }: {
 items: CatalogItem[]; interests?: Interest[]; loading: boolean; errors: string[];
}) {
 const searchParams = useSearchParams();
 const [selected, setSelected] = useState<string>();
 const topic = selected ?? searchParams.get('interest') ?? '';
 const [year, setYear] = useState('');
 const [oldestFirst, setOldestFirst] = useState(false);
 const [confirmedOnly, setConfirmedOnly] = useState(false);
 const [limits, setLimits] = useState<Record<string, number>>({});
 const currentDay = today();

 const journeys = (interests ?? []).filter(interest => !topic || interest.id === topic).map(interest => {
  const rows = tasteEvidence(interest, items, currentDay, storedLinks(approvedKey(interest.id)), storedLinks(dismissedKey(interest.id)))
   .filter(row => !confirmedOnly || row.confirmed);
  return { interest, rows, ...tasteClues(rows) };
 });
 const found = journeys.filter(journey => journey.rows.length);
 const lacking = journeys.filter(journey => !journey.rows.length);
 const years = [...new Set(found.flatMap(journey => journey.years))].sort().reverse();
 const activeYear = years.includes(year) ? year : '';

 // A record that shows several interests appears once, with each interest named on it.
 const moments = new Map<string, { item: CatalogItem; day: string; tags: { interest: Interest; evidence: string; confirmed: boolean; clues: string[] }[] }>();
 for (const journey of found) for (const row of journey.rows) {
  const moment = moments.get(row.item.key) ?? { item: row.item, day: row.day, tags: [] };
  moment.tags.push({ interest: journey.interest, evidence: row.evidence, confirmed: row.confirmed, clues: journey.labels.get(row.item.key) ?? [] });
  moments.set(row.item.key, moment);
 }
 const all = [...moments.values()].sort((a, b) => a.day.localeCompare(b.day));
 const ordered = oldestFirst ? all : [...all].reverse();
 const groups = new Map<string, typeof all>();
 for (const moment of ordered) {
  const key = moment.day.slice(0, 4);
  if (activeYear && key !== activeYear) continue;
  groups.set(key, [...(groups.get(key) ?? []), moment]);
 }
 const dated = items.filter(item => item.sourceType !== 'calendar' && item.startAt).length;
 const more = (key: string, size: number) => setLimits({ ...limits, [key]: (limits[key] ?? size) + PAGE });

 return <section className="resume-panel" aria-labelledby="taste-flow">
  <h2 id="taste-flow">취향의 흐름</h2>
  {errors.map(message => <p role="alert" key={message}>{message} 조회된 자료만 표시해요.</p>)}
  {loading ? <p role="status">기록을 불러오는 중…</p> : !interests ? <p role="alert">관심사를 불러오지 못했어요.</p> : <>
   {interests.length === 0 && <p>등록된 관심사가 없어요.</p>}
   <TasteEras eras={tasteEras(items, interests, currentDay)}/>
   <h3 className="taste-year">관심사별로 보기</h3>
   <div className="universe-filter-row timeline-filters" role="group" aria-label="취향 연대기 필터">
    <label>관심사 <select value={topic} onChange={event => setSelected(event.target.value)}>
     <option value="">전체</option>
     {interests?.map(interest => <option value={interest.id} key={interest.id}>{interest.name}</option>)}
    </select></label>
    <label><input type="checkbox" checked={confirmedOnly} onChange={event => setConfirmedOnly(event.target.checked)}/> 확정 연결만</label>
   </div>
   {journeys.length > 0 && <details>
    <summary>관심사별 기록 분포</summary>
    <TasteLanes lanes={[...found, ...lacking]} today={currentDay} interestHref={interestHref}/>
   </details>}
   {all.length > 0 && <p className="universe-meta">날짜가 있는 기록 {dated}건 중 관심사와 이어지는 기록 {all.length}건 · {dayLabel(all[0].day)} ~ {dayLabel(all.at(-1)!.day)}. 점을 누르면 그 기록이 열려요. 일정만 있고 기록이 없는 항목은 <Link href="/report">활동 리포트</Link>에서 볼 수 있어요.</p>}
   {lacking.length > 0 && <p>{confirmedOnly ? '확정된 연결이 없는 관심사' : '이어지는 기록을 찾지 못한 관심사'} · {lacking.map((journey, index) => <span key={journey.interest.id}>
    {index > 0 && ', '}<Link className="text-link" href={interestHref(journey.interest.id)}>{journey.interest.name}</Link></span>)}. 관심사 상세에서 연결 후보를 확인할 수 있어요.</p>}
   {found.length > 0 && <details>
    <summary>글로 보는 변화 단서</summary>
    <div className="taste-clues">
     {found.map(({ interest, rows, years: seen, gaps, kinds, firstDay }) => <article key={interest.id} className="taste-topic">
      <h3><Link href={interestHref(interest.id)}>{interest.name}</Link></h3>
      <ul>
       <li>기록에서 처음 확인됨 · {dayLabel(firstDay!)}</li>
       {seen.length > 1 && <li>{seen.join('년, ')}년에 관련 기록이 있어요</li>}
       {gaps.map(([from, to]) => <li key={from}>{from === to ? from : from + '~' + to}년에는 관련 기록이 없어요</li>)}
       {kinds.length > 1 && <li>기록 유형이 {kinds.map(kind => catalogLabels[kind]).join(' → ')} 순으로 나타났어요</li>}
      </ul>
      <p className="universe-meta">확정 연결 {rows.filter(row => row.confirmed).length}건 · 추천 연결 {rows.filter(row => !row.confirmed).length}건</p>
     </article>)}
    </div>
    <p className="universe-meta">‘처음 확인됨’은 조회한 기록 기준이라 실제로 좋아하기 시작한 때와 다를 수 있어요. 기록이 없는 기간이 관심이 줄었다는 뜻도 아니에요.</p>
   </details>}

   {all.some(moment => major(moment.item)) && <section aria-labelledby="taste-highlights">
    <h3 id="taste-highlights" className="taste-year">주요 활동 이력</h3>
    <p className="universe-meta">관심사와 이어지는 공연·여행 중 후기가 남아 있는 기록이에요. 후기가 없는 해에는 공연·여행 DB의 기록을 보여줘요.</p>
    {[...new Set(ordered.map(moment => moment.day.slice(0, 4)))].map(key => {
     const inYear = ordered.filter(moment => moment.day.startsWith(key) && major(moment.item));
     // Written reviews lead; database rows without a review fill in only when a year has none.
     const reviews = inYear.filter(moment => moment.item.entry);
     const list = reviews.length ? reviews : inYear;
     const limit = limits['major:' + key] ?? HIGHLIGHTS;
     if (!list.length) return null;
     return <div key={key} className="taste-highlight-year">
      <h4>{key}년</h4>
      <ul>{list.slice(0, limit).map(({ item, day, tags }) => <li key={item.key} className={'universe-tone-' + item.kind}>
       <span className="universe-kind">{catalogLabels[item.kind]}</span>{' '}
       <Link href={item.detailHref ?? item.originalUrl ?? '/explore'}>{item.title}</Link>
       <span className="universe-meta"> · <time dateTime={day}>{Number(day.slice(5, 7))}월 {Number(day.slice(8))}일</time> · {tags.map(tag => tag.interest.name).join(', ')}{tags.some(tag => tag.confirmed) ? '' : ' (추천)'}</span>
      </li>)}</ul>
      {list.length > limit && <button className="button" type="button" onClick={() => more('major:' + key, HIGHLIGHTS)}>{key}년 {list.length - limit}건 더 보기</button>}
     </div>;
    })}
   </section>}

   {all.length > 0 && <details className="taste-all">
    <summary>모든 장면 보기 · {all.length}건</summary>
    <div className="universe-filter-row timeline-filters" role="group" aria-label="장면 필터">
     <label>연도 <select value={activeYear} onChange={event => setYear(event.target.value)}>
      <option value="">전체 기간</option>{years.map(value => <option key={value}>{value}</option>)}
     </select></label>
     <label>순서 <select value={oldestFirst ? 'old' : 'new'} onChange={event => setOldestFirst(event.target.value === 'old')}>
      <option value="new">최근부터</option><option value="old">처음부터</option>
     </select></label>
    </div>
    {[...groups].map(([key, list]) => {
     const limit = limits[key] ?? PAGE;
     return <section key={key} aria-label={key + '년'}>
      <h3 className="taste-year">{key}년</h3>
      <ol className="timeline-list taste-moments">
       {list.slice(0, limit).map(({ item, day, tags }) => <li key={item.key} className={'universe-tone-' + item.kind + (tags.some(tag => tag.confirmed) ? '' : ' taste-suggested')}>
        <p className="universe-meta"><time dateTime={day}>{dayLabel(day)}</time> · {catalogLabels[item.kind]}</p>
        <h4><Link href={item.detailHref ?? item.originalUrl ?? '/explore'}>{item.title}</Link></h4>
        {item.cover && <CollectionCover src={item.cover} kind={item.kind}/>}
        {item.summary?.trim() && <p className="universe-excerpt">{item.summary.trim().slice(0, 140)}{item.summary.trim().length > 140 && '…'}</p>}
        {tags.map(tag => <p className="universe-meta" key={tag.interest.id}>
         <Link className="universe-kind" href={interestHref(tag.interest.id)}>{tag.interest.name}</Link>{' '}
         {tag.confirmed ? '확정 연결' : '추천 연결'} · 근거: {tag.evidence}
         {tag.clues.map(clue => <strong key={clue}> · {clue}</strong>)}
        </p>)}
       </li>)}
      </ol>
      {list.length > limit && <button className="button" type="button" onClick={() => more(key, PAGE)}>{key}년 기록 {list.length - limit}건 더 보기</button>}
     </section>;
    })}
   </details>}
  </>}
 </section>;
}
