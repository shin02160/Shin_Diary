'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { api } from '@/lib/notion-sync';
import { dateKey, dayLabel } from '@/lib/dates';
import { notionActivityUrl } from '@/lib/activity-view';
import { wikiDirectory } from '@/lib/wiki-directory';
import type { WikiBlock } from '@/lib/wiki';
import type { Entry } from '@/lib/types';
import { Icon } from './icon';

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

export function WikiArchive({ blocks = [], entryId }: { blocks?: WikiBlock[]; entryId?: string }) {
 const [data, setData] = useState<{ entries: Entry[] }>();
 const [error, setError] = useState('');
 const [attempt, setAttempt] = useState(0);
 const [selected, setSelected] = useState<(typeof categories)[number]['key']>('daily');
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
 if (entryId !== undefined) {
  const entry = entries.find(item => item.id === entryId);
  const original = notionActivityUrl(entry?.notion?.pageId);
  return <div className="wiki-archive">
   <Link className="text-link" href="/wiki">Wiki로 돌아가기</Link>
   <h1>{entry ? entryTitle(entry) : 'Wiki 기록'}</h1>
   {feedback}
   {data && !entry && <p>이 기록을 찾을 수 없어요.</p>}
   {entry && <article className="resume-panel wiki-content">
    <p>{dayLabel(dateKey(entry.occurredAt))}{entry.place && ' · ' + entry.place}</p>
    {entry.photo && <Image src={entry.photo} width={640} height={360} alt="기록 사진" unoptimized className="wiki-entry-photo"/>}
    {entry.content && <p className="preserve-lines">{entry.content}</p>}
    {original && <a className="text-link" href={original} target="_blank" rel="noopener noreferrer">Notion 원본 열기</a>}
   </article>}
  </div>;
 }
 const category = categories.find(item => item.key === selected)!;
 const categoryEntries = entries.filter(entry => entry.category === category.entry);
 const categoryDocs = documents.filter(doc => doc.category === selected || (selected === 'collection' && doc.category === 'project'));
 const system = documents.filter(doc => doc.category === 'system');
 const uncategorized = documents.filter(doc => doc.category === 'uncategorized');
 return <div className="wiki-archive">
  <section aria-labelledby="wiki-archive-categories">
   <h2 id="wiki-archive-categories">카테고리</h2>
   <div className="wiki-archive-categories" role="group" aria-label="Wiki 카테고리">
    {categories.map(item => <button className="button" type="button" key={item.key} aria-pressed={selected === item.key} onClick={() => setSelected(item.key)}>
     <Icon name={item.icon} size="small"/>{item.label}
    </button>)}
   </div>
  </section>
  <section aria-labelledby="wiki-recent-records"><h2 id="wiki-recent-records">최근 기록</h2>
   {feedback}
   {data && (entries.length ? entryList(entries.slice(0, 8)) : <p>아직 기록이 없어요.</p>)}
  </section>
  <section aria-labelledby="wiki-selected-category">
   <h2 id="wiki-selected-category">{category.label}</h2>
   {categoryEntries.length > 0 && entryList(categoryEntries)}
   {categoryDocs.length > 0 && documentList(categoryDocs)}
   {data && !categoryEntries.length && !categoryDocs.length && <p>이 카테고리에 표시할 기록이 없어요.</p>}
  </section>
  {uncategorized.length > 0 && <section><h2>미분류 문서</h2>{documentList(uncategorized)}</section>}
  {system.length > 0 && <details className="resume-panel"><summary>시스템 관리</summary>{documentList(system)}</details>}
 </div>;
}
