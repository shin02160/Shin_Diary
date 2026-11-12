'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CollectionCover, FavoriteButton } from './notion-collections';
import { Icon } from './icon';
import { dayLabel } from '@/lib/dates';
import { useArchive } from '@/lib/local-store';
import type { CollectionDetail, CollectionKind, TravelSection } from '@/lib/notion-collections';
import { api } from '@/lib/notion-sync';
import type { Entry } from '@/lib/types';

function dateRange(start?: string, end?: string) {
 if (!start) return '';
 const first = start.slice(0, 10);
 const last = end?.slice(0, 10);
 return dayLabel(first) + (last && last !== first ? ' ~ ' + dayLabel(last) : '');
}

function notionPageKey(value: string) {
 try {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['notion.so', 'www.notion.so'].includes(url.hostname)) return;
  return url.pathname.replace(/[/]+$/, '').match(/([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i)?.[1].replaceAll('-', '').toLowerCase();
 } catch { return; }
}

function RelatedEntries({ detail, entries, failed, loading }: {
 detail: CollectionDetail;
 entries: Entry[];
 failed: boolean;
 loading: boolean;
}) {
 const keys = new Set([detail.item.url, ...(detail.sections ?? []).flatMap(section => section.records.map(record => record.url))].map(notionPageKey));
 keys.delete(undefined);
 const related = entries.filter(entry => entry.category === 'Travel' && !entry.isSample &&
  [...(entry.sourceLinks ?? []), ...Object.values(entry.travelReferences ?? {})].some(url => keys.has(notionPageKey(url))));
 return <section className="resume-panel">
  <h2>관련 기록</h2>
  {loading && <p role="status">관련 기록을 불러오는 중…</p>}
  {failed && <p role="alert">관련 기록을 불러오지 못했어요.</p>}
  {!loading && !failed && !related.length && <p>이 여행과 연결된 기록이 없어요.</p>}
  {related.map(entry => <details key={entry.id}>
   <summary>{entry.title || entry.content.trim().slice(0, 64) || '여행 기록'}</summary>
   {entry.content && <p className="preserve-lines">{entry.content}</p>}
   {entry.notion && /^[a-f0-9-]{32,36}$/i.test(entry.notion.pageId) &&
    <a href={'https://www.notion.so/' + entry.notion.pageId} target="_blank" rel="noopener noreferrer">Notion 기록 열기</a>}
  </details>)}
 </section>;
}

function TravelRecords({ section }: { section: TravelSection }) {
 return <section className="resume-panel">
  <h2>{section.label}</h2>
  {section.unavailable ? <p>Notion에서 이 항목을 불러오지 못했어요.</p> : section.records.length ? <ul>
   {section.records.map(record => <li key={record.url}>
    <a href={record.url} target="_blank" rel="noopener noreferrer">{record.title} <Icon name="external" size="small"/></a>
    <div className="universe-meta">{[dateRange(record.start, record.end), record.location, record.status].filter(Boolean).join(' · ')}</div>
   </li>)}
  </ul> : <p>등록된 항목이 없어요.</p>}
  {section.truncated && <p>연결된 항목을 500개까지 표시합니다.</p>}
 </section>;
}

export function CollectionRecord({ kind, id, remote }: { kind: CollectionKind; id: string; remote: boolean }) {
 const isTrip = kind === 'trips';
 const category = isTrip ? 'travel' : 'concert';
 const local = useArchive();
 const [result, setResult] = useState<{ data: CollectionDetail } | { error: string }>();
 const [related, setRelated] = useState<{ entries: Entry[] } | { error: true }>();
 const [attempt, setAttempt] = useState(0);
 useEffect(() => {
  let active = true;
  const path = 'collections/detail?' + new URLSearchParams({ kind, id });
  void api<CollectionDetail>(path).then(data => { if (active) setResult({ data }); })
   .catch(error => { if (active) setResult({ error: error instanceof Error ? error.message : '기록을 불러오지 못했어요.' }); });
  if (isTrip && remote) {
   void api<{ entries: Entry[] }>('archive').then(data => { if (active) setRelated(data); })
    .catch(() => { if (active) setRelated({ error: true }); });
  }
  return () => { active = false; };
 }, [kind, id, isTrip, remote, attempt]);

 const detail = result && 'data' in result ? result.data : undefined;
 const entries = remote ? related && 'entries' in related ? related.entries : [] : local.entries;
 return <article className={`collection-record universe-tone-${category}`}>
  <Link href={'/explore?category=' + category} className="text-link">{isTrip ? '여행' : '공연'} 목록</Link>
  {!result && <p role="status">기록을 불러오는 중…</p>}
  {result && 'error' in result && <div className="universe-load-error">
   <p role="alert">{result.error}</p>
   <button type="button" className="button" onClick={() => {
    setResult(undefined);
    setRelated(undefined);
    setAttempt(value => value + 1);
   }}>다시 불러오기</button>
  </div>}
  {detail && <>
   <CollectionCover src={detail.item.cover} kind={category}/>
   <header className="collection-record-header">
    <div className="universe-card-heading"><h1>{detail.item.title}</h1><FavoriteButton recordKey={kind + ':' + detail.item.id} title={detail.item.title}/></div>
    {detail.item.start && <p className="universe-meta"><Icon name="calendar" size="small"/> {dateRange(detail.item.start, detail.item.end)}</p>}
    {detail.item.location && <p className="universe-meta"><Icon name="place" size="small"/> {detail.item.location}</p>}
    <a className="text-link" href={detail.item.url} target="_blank" rel="noopener noreferrer">Notion 원본 열기 <Icon name="external" size="small"/></a>
   </header>
   {detail.sections?.map(section => <TravelRecords key={section.label} section={section}/>)}
   {isTrip && <RelatedEntries detail={detail} entries={entries} failed={Boolean(remote && related && 'error' in related)} loading={remote ? !related : !local.ready}/>}
   {([['아티스트', detail.item.detail], ['캐스팅', detail.cast], ['셋리스트', detail.setlist], ['감상 메모', detail.memo]] as const)
    .filter(([, value]) => Boolean(value)).map(([label, value]) => <section className="resume-panel" key={label}>
     <h2>{label}</h2><p className="preserve-lines">{value}</p>
    </section>)}
  </>}
 </article>;
}
