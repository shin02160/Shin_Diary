'use client';

import { useEffect, useState } from 'react';
import { dayLabel } from '@/lib/dates';
import type { CollectionResult, NotionCollections as Collections } from '@/lib/notion-collections';
import { api } from '@/lib/notion-sync';

const PAGE_SIZE = 12;

function CollectionSection({ id, title, result }: { id: string; title: string; result: CollectionResult }) {
 const [limit, setLimit] = useState(PAGE_SIZE);
 return (
  <section aria-labelledby={id}>
   <h2 id={id}>{title}</h2>
   {result.state === 'unconfigured' ? <p className="muted">Notion 데이터 소스를 연결하면 표시됩니다.</p> :
    result.state === 'failed' ? <p role="alert">{result.message}</p> :
    !result.items.length ? <p className="muted">불러올 항목이 없어요.</p> : (
     <>
      <div className="grid two">{result.items.slice(0, limit).map(item => {
       const start = item.start?.slice(0, 10);
       const end = item.end?.slice(0, 10);
       return (
        <article className="resume-panel" key={item.id}>
         <h3>{item.title}</h3>
         {start && <p><time dateTime={item.start}>{dayLabel(start)}</time>{end && end !== start && <> ~ <time dateTime={item.end}>{dayLabel(end)}</time></>}</p>}
         {item.location && <p>{item.location}</p>}
         {item.detail && <p>{item.detail}</p>}
         {item.memo && <details><summary>감상 메모</summary><p className="preserve-lines">{item.memo}</p></details>}
         <a className="text-link" href={item.url} target="_blank" rel="noopener noreferrer">Notion 원본 열기 ↗</a>
        </article>
       );
      })}</div>
      {result.items.length > limit && <button className="button" type="button" onClick={() => setLimit(value => value + PAGE_SIZE)}>{title} 더 보기</button>}
      {result.truncated && <p>최근 500개 항목까지 표시합니다.</p>}
     </>
    )}
  </section>
 );
}

export function NotionCollections({ attempt }: { attempt: number }) {
 const [data, setData] = useState<Collections>();
 const [error, setError] = useState('');
 useEffect(() => {
  let current = true;
  api<Collections>('collections').then(result => {
   if (current) setData(result);
  }).catch(error => {
   if (current) setError(error instanceof Error ? error.message : '여행·공연 자료를 불러오지 못했습니다.');
  });
  return () => { current = false; };
 }, [attempt]);

 if (error) return <p role="alert">{error}</p>;
 if (!data) return <p role="status">여행·공연 자료를 불러오는 중…</p>;
 return (
  <>
   <CollectionSection id="notion-trips" title="여행" result={data.trips}/>
   {data.itinerary.state !== 'unconfigured' && <CollectionSection id="notion-itinerary" title="여행 일정" result={data.itinerary}/>}
   <CollectionSection id="notion-performances" title="공연" result={data.performances}/>
  </>
 );
}
