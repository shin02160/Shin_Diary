'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { api } from '@/lib/notion-sync';
import { dateKey, dayLabel } from '@/lib/dates';
import { notionActivityUrl } from '@/lib/activity-view';
import { wikiDirectory } from '@/lib/wiki-directory';
import type { WikiBlock } from '@/lib/wiki';
import type { Entry } from '@/lib/types';
import { Icon } from './icon';
import { WikiStory } from './wiki-story';
import { LocalDraft } from './local-draft';
import { WikiGptReview } from './wiki-gpt-review';
import { WikiReviewStats } from './wiki-review-stats';
import { gptReviewId, monthRecords, reviewMonth } from '@/lib/wiki-review';

const categories = [
 { key: 'daily', label: '일상 기록', entry: 'Daily', icon: 'daily' },
 { key: 'travel', label: '여행 아카이브', entry: 'Travel', icon: 'travel' },
 { key: 'concert', label: '공연 아카이브', entry: 'Concert', icon: 'concert' },
 { key: 'collection', label: '취향 컬렉션', entry: 'Projects', icon: 'collection' },
] as const;

function entryTitle(entry: Entry) {
 return entry.title?.trim() || entry.content.trim().split('\n')[0].slice(0, 72) || (entry.photo ? '사진 기록' : '기록');
}
const entryHref = (id: string) => '/wiki?entry=' + encodeURIComponent(id);

export function WikiArchive({ blocks = [], entryId, month }: { blocks?: WikiBlock[]; entryId?: string; month?: string }) {
 const [data, setData] = useState<{ entries: Entry[] }>();
 const [error, setError] = useState('');
 const [attempt, setAttempt] = useState(0);
 const [query, setQuery] = useState('');
 const params = useSearchParams();
 const selected = categories.find(item => item.key === params.get('category'))?.key ?? 'daily';
 function selectCategory(key: typeof selected) {
  const url = new URL(window.location.href);
  url.searchParams.set('category', key);
  window.history.pushState(null, '', url);
 }
 useEffect(() => {
  let active = true;
  void api<{ entries: Entry[] }>('wiki-entries').then(result => {
   if (active) setData(result);
  }).catch(() => { if (active) setError('Notion 기록을 불러오지 못했어요.'); });
  return () => { active = false; };
 }, [attempt]);
 const entries = (data?.entries ?? []).filter(entry => !entry.isSample).sort((a, b) =>
  dateKey(b.occurredAt).localeCompare(dateKey(a.occurredAt)) || b.createdAt.localeCompare(a.createdAt));
 const documents = wikiDirectory(blocks).all;
 const documentList = (items: typeof documents) => <ul className="universe-wiki-recent">
  {items.map(doc => <li key={doc.id}><Link href={'/wiki?page=' + doc.id}><Icon name="file" size="small"/><span>{doc.title}</span><Icon name="next" size="small"/></Link></li>)}
 </ul>;
 const entryList = (items: Entry[]) => <ul className="universe-wiki-recent">
  {items.map(entry => <li key={entry.id}><Link href={entryHref(entry.id)}><Icon name="file" size="small"/>
   <span>{entryTitle(entry)}<small className="wiki-record-date">{dayLabel(dateKey(entry.occurredAt))}</small></span><Icon name="next" size="small"/></Link></li>)}
 </ul>;
 const loading = !data && !error;
 const feedback = loading ? <p role="status">기록을 불러오는 중…</p> : error ? <div>
  <p role="alert">{error}</p><button className="button" type="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>다시 불러오기</button>
 </div> : null;
 const reviews = entries.flatMap(entry => {
  const period = reviewMonth(entry);
  return period ? [{ entry, period }] : [];
 }).sort((a, b) => b.period.localeCompare(a.period));
 if (month) {
  const matching = reviews.filter(review => review.period === month);
  const review = matching[0]?.entry;
  const records = monthRecords(entries, month);
  const title = month.slice(0, 4) + '년 ' + Number(month.slice(5)) + '월';
  return <div className="wiki-archive">
   <Link className="text-link" href="/wiki">Wiki로 돌아가기</Link>
   <h1>{title} 회고</h1>
   {feedback}
   {reviews.some(item => item.period !== month) && <nav aria-label="다른 월 회고">
    <ul>{[...new Set(reviews.map(item => item.period))].filter(period => period !== month).map(period =>
     <li key={period}><Link href={'/wiki/review/' + period}>{period.slice(0, 4)}년 {Number(period.slice(5))}월</Link></li>)}</ul>
   </nav>}
   {review?.content.trim() && <p className="preserve-lines">{review.content.trim().replace(/\s+/g, ' ').slice(0, 160)}{review.content.trim().replace(/\s+/g, ' ').length > 160 && '…'}</p>}
   {records.length > 0 && <section aria-labelledby="wiki-review-moments">
    <h2 id="wiki-review-moments">이달의 기록</h2>{entryList(records)}
   </section>}
   {review?.notion?.pageId && <article className="wiki-story wiki-content">
    <h2>{entryTitle(review)}</h2>
    <WikiStory pageId={review.notion.pageId} summary="" monthRecords={records} records={entries.flatMap(item => item.notion?.pageId ?
     [{ pageId: item.notion.pageId, href: entryHref(item.id), title: entryTitle(item) }] : [])}/>
    <a className="text-link" href={notionActivityUrl(review.notion.pageId)} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a>
   </article>}
   {matching.length > 1 && <section><h2>이달의 다른 통합 회고</h2>{entryList(matching.slice(1).map(item => item.entry))}</section>}
   {data && !review && <p>이달에 저장된 통합 회고가 없어요.</p>}
   {data && <WikiReviewStats key={month} month={month} recordCount={records.length}/>}
   {data && <WikiGptReview month={month} records={records}
    existingId={entries.find(entry => entry.id === gptReviewId(month))?.id}/>}
   {records.length > 0 && <LocalDraft label="브라우저에서 회고 초안 편집" source={records.slice(0, 12).map((record, index) =>
    '[' + (index + 1) + '] ' + dateKey(record.occurredAt) + ' · ' + entryTitle(record).slice(0, 120) + '\n' +
    record.content.trim().slice(0, 330) + '\n' + (notionActivityUrl(record.notion?.pageId) ?? '')
   ).join('\n\n')}/>}
  </div>;
 }
 if (entryId !== undefined) {
  const entry = entries.find(item => item.id === entryId);
  const original = notionActivityUrl(entry?.notion?.pageId);
  return <div className="wiki-archive">
   <Link className="text-link" href="/wiki">Wiki로 돌아가기</Link>
   <h1>{entry ? entryTitle(entry) : 'Wiki 기록'}</h1>
   {feedback}
   {data && !entry && <p>이 기록을 찾을 수 없어요.</p>}
   {entry && <article className="wiki-story wiki-content">
    <p className="wiki-story-meta">{categories.find(item => item.entry === entry.category)?.label} · {dayLabel(dateKey(entry.occurredAt))}{entry.place && ' · ' + entry.place}</p>
    {entry.photo && <Image src={entry.photo} width={640} height={360} alt="기록 사진" unoptimized className="wiki-entry-photo"/>}
    {entry.calendarEvent && <p><Link className="text-link" href={'/calendar?date=' + entry.calendarEvent.date}>
     캘린더에서 {entry.calendarEvent.title} 보기
    </Link></p>}
    {entry.notion?.pageId ? <WikiStory key={entry.notion.pageId} pageId={entry.notion.pageId} summary={entry.content}
     records={entries.flatMap(item => item.notion?.pageId ? [{ pageId: item.notion.pageId, href: entryHref(item.id), title: entryTitle(item) }] : [])}/> : <p className="preserve-lines">{entry.content}</p>}
    {original && <a className="text-link" href={original} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a>}
   </article>}
  </div>;
 }
 const monthly = reviews[0]?.entry;
 const moments = entries.filter(entry => entry.category === 'Travel' || entry.category === 'Concert').slice(0, 4);
 const search = query.trim().toLowerCase();
 const category = categories.find(item => item.key === selected)!;
 const categoryEntries = entries.filter(entry => entry.category === category.entry && [entryTitle(entry), entry.content, entry.place, dateKey(entry.occurredAt), ...entry.tags].some(value => value?.toLowerCase().includes(search)));
 const categoryDocs = documents.filter(doc => (doc.category === selected || (selected === 'collection' && doc.category === 'project')) && doc.title.toLowerCase().includes(search));
 const system = documents.filter(doc => doc.category === 'system');
 const uncategorized = documents.filter(doc => doc.category === 'uncategorized');
 return <div className="wiki-archive">
  <section className="resume-panel" aria-labelledby="wiki-monthly">
   <h2 id="wiki-monthly">이번 달의 이야기</h2>
   {monthly ? <>
    <h3>{entryTitle(monthly)}</h3>
    {monthly.content.trim() && <p>{monthly.content.trim().slice(0, 160)}{monthly.content.trim().length > 160 ? '…' : ''}</p>}
    <Link className="text-link" href={'/wiki/review/' + reviews[0].period}>회고 바로 읽기</Link>
   </> : data ? <p>아직 월간 통합 회고가 없어요.</p> : feedback}
  </section>
  {moments.length > 0 && <section><h2>전체 최근 여행·공연</h2>{entryList(moments)}</section>}
  <section aria-labelledby="wiki-archive-categories">
   <h2 id="wiki-archive-categories">주제별 탐색</h2>
   <div className="wiki-archive-categories" role="group" aria-label="Wiki 카테고리">
    {categories.map(item => <button className="button" type="button" key={item.key} aria-pressed={selected === item.key} onClick={() => selectCategory(item.key)}>
     <Icon name={item.icon} size="small"/>{item.label}{data && ' (' + (entries.filter(entry => entry.category === item.entry).length + documents.filter(doc => doc.category === item.key || (item.key === 'collection' && doc.category === 'project')).length) + ')'}
    </button>)}
   </div>
   <h3 id="wiki-selected-category" aria-live="polite">{category.label} · {categoryEntries.length + categoryDocs.length}건</h3>
   {feedback}
      {data && <>
    <label htmlFor="wiki-record-search">기억 찾기</label>
    <input className="wiki-record-search" id="wiki-record-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="제목, 날짜, 장소, 태그 검색"/>
    {search && <button className="button" type="button" onClick={() => setQuery('')}>검색 초기화</button>}
   </>}
   {selected === 'collection' && <p>프로젝트 기록과 Wiki 문서를 탐색하거나 <Link href="/explore/interests">Notion 관심사 목록</Link>을 열 수 있어요.</p>}
   {categoryEntries.length > 0 && entryList(categoryEntries)}
   {categoryDocs.length > 0 && documentList(categoryDocs)}
   {data && !categoryEntries.length && !categoryDocs.length && <p>이 카테고리에 표시할 기록이 없어요.</p>}
  </section>
  {uncategorized.length > 0 && <section><h2>미분류 문서</h2>{documentList(uncategorized)}</section>}
  {system.length > 0 && <details className="resume-panel"><summary>시스템 관리</summary>{documentList(system)}</details>}
 </div>;
}
