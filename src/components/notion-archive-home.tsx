'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NotionCollections } from './notion-collections';
import { EntryCard, PageHeading } from './cards';
import { orderedEntries } from '@/lib/local-store';
import { api, SyncError } from '@/lib/notion-sync';
import { categoryLabels, statusLabels } from '@/lib/sample-data';
import type { Activity, Entry } from '@/lib/types';

const PAGE_SIZE = 24;
interface ArchiveData { activities: Activity[]; entries: Entry[] }

export function NotionArchiveHome() {
 const [data, setData] = useState<ArchiveData>();
 const [failure, setFailure] = useState<{ message: string; login: boolean }>();
 const [attempt, setAttempt] = useState(0);
 const [query, setQuery] = useState('');
 const [activity, setActivity] = useState('');
 const [limit, setLimit] = useState(PAGE_SIZE);

 useEffect(() => {
  let current = true;
  api<ArchiveData>('archive').then(result => {
   if (current) setData({ ...result, entries: orderedEntries(result.entries) });
  }).catch(error => {
   if (current) setFailure({
    message: error instanceof Error ? error.message : 'Notion 기록을 불러오지 못했습니다.',
    login: error instanceof SyncError && error.status === 401,
   });
  });
  return () => { current = false; };
 }, [attempt]);

 const search = query.trim().toLocaleLowerCase('ko-KR');
 const names = new Map(data?.activities.map(item => [item.id, item.name]));
 const entries = data?.entries.filter(entry =>
  (!activity || entry.activityId === activity) &&
  [entry.title, entry.content, entry.place, entry.mood, entry.activityId && names.get(entry.activityId), ...entry.tags]
   .join(' ').toLocaleLowerCase('ko-KR').includes(search)
 ) ?? [];

 return (
  <>
   <PageHeading eyebrow="NOTION ARCHIVE" title="나의 기록 모아보기">{null}</PageHeading>
   {failure ? (
    <div className="resume-panel">
     <p role="alert">{failure.message}</p>
     {failure.login ? <Link href="/settings" className="button">설정에서 로그인</Link> :
      <button type="button" className="button" onClick={() => {
       setFailure(undefined);
       setAttempt(value => value + 1);
      }}>다시 불러오기</button>}
    </div>
   ) : !data ? <p role="status">Notion 기록을 불러오는 중…</p> : (
    <>
     <p>활동 {data.activities.length}개 · 기록 {data.entries.length}개</p>
     <div className="form-actions">
      <button type="button" className="button" onClick={() => {
       setData(undefined);
       setAttempt(value => value + 1);
      }}>새로 불러오기</button>
     </div>
     {data.activities.length > 0 && (
      <section aria-labelledby="archive-activities">
       <h2 id="archive-activities">활동</h2>
       <div className="grid two">
        {data.activities.map(item => (
         <details className="resume-panel" key={item.id}>
          <summary>{item.name}</summary>
          <p>{categoryLabels[item.category]} · {statusLabels[item.lifecycleStatus]}{item.isArchived && ' · 아카이브'}</p>
          {item.summary && <p className="preserve-lines">{item.summary}</p>}
          <button type="button" className="button" onClick={() => { setActivity(item.id); setLimit(PAGE_SIZE); }}>연결 기록만 보기</button>
         </details>
        ))}
       </div>
      </section>
     )}
     <section aria-labelledby="archive-entries">
      <h2 id="archive-entries">기록</h2>
      {data.entries.length > 0 && (
       <div className="editor-form form-grid">
        <label>기록 검색<input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE); }}/></label>
        {data.activities.length > 0 && <label>연결 활동<select value={activity} onChange={event => {
         setActivity(event.target.value);
         setLimit(PAGE_SIZE);
        }}>
         <option value="">모든 활동</option>
         {data.activities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
       </div>
      )}
      {entries.length === 0 ? <div className="empty"><p>{data.entries.length ? '검색 조건에 맞는 기록이 없어요.' : 'Notion에서 불러올 기록이 아직 없어요.'}</p></div> : (
       <>
        <div className="grid three">{entries.slice(0, limit).map(entry => <EntryCard key={entry.id} entry={entry} readOnly/>)}</div>
        {entries.length > limit && <button className="button" type="button" onClick={() => setLimit(value => value + PAGE_SIZE)}>기록 더 보기</button>}
       </>
      )}
     </section>
     <NotionCollections key={attempt} attempt={attempt}/>
    </>
   )}
  </>
 );
}
