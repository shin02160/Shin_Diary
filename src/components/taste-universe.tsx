'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { dayLabel } from '@/lib/dates';
import { api, SyncError } from '@/lib/notion-sync';
import { attractionSentences, blockText, entryObservations, staleReviews, traitGroups, type ReviewStatus, type TasteObservation, type TasteReview } from '@/lib/taste-observations';
import type { Entry } from '@/lib/types';
import type { WikiEntryBody } from '@/lib/wiki';

const PAGE = 5;
const bodiesKey = 'mlu.taste.bodies', reviewsKey = 'mlu.taste.reviews';
const areas = { Daily: '일상', Travel: '여행', Concert: '공연', Projects: '프로젝트' } as const;
// Starting points only; any wording can be typed in.
const seedTraits = ['공간성', '디테일', '색감', '분위기', '현장감', '무대 구성', '서사', '함께하는 경험', '낯선 장소 탐색', '일상 풍경', '맛', '새로운 시도', '휴식', '만들기'];
type Bodies = Record<string, { updatedAt?: string; text: string }>;
type Reviews = Record<string, TasteReview>;

function read<T extends object>(key: string): T {
 try {
  const value: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : {} as T;
 } catch { return {} as T; }
}
const pageOf = (entry: Entry) => entry.notion?.pageId.replaceAll('-', '').toLowerCase();
const when = (row: { day: string; precision?: string }) => row.precision === 'month' ? row.day.slice(0, 4) + '년 ' + Number(row.day.slice(5, 7)) + '월' : dayLabel(row.day);

export function TasteUniverse({ entries, loading }: { entries: Entry[]; loading: boolean }) {
 const [bodies, setBodies] = useState<Bodies>(() => read(bodiesKey));
 const [reviews, setReviews] = useState<Reviews>(() => read(reviewsKey));
 const [progress, setProgress] = useState<{ done: number; total: number; failed: number; wait?: number }>();
 // What the last finished run left in the cache, and the pages it could not read; both decide what is still to read.
 const [saved, setSaved] = useState<Bodies>(() => read(bodiesKey));
 const [skipped, setSkipped] = useState<string[]>([]);
 const [area, setArea] = useState<keyof typeof areas | ''>('');
 const [limits, setLimits] = useState<Record<string, number>>({});
 const [editing, setEditing] = useState('');
 const [draft, setDraft] = useState('');
 const [notice, setNotice] = useState('');
 const [opened, setOpened] = useState<string[]>([]);
 const cache = useRef(bodies);

 // Each record body is read once and kept until the record is edited in Notion. Only the quoted sentences are stored.
 const pending = entries.filter(entry => pageOf(entry) && !skipped.includes(pageOf(entry)!) && saved[pageOf(entry)!]?.updatedAt !== entry.updatedAt).map(entry => pageOf(entry)! + ':' + entry.updatedAt).join(',');
 useEffect(() => {
  const queue = pending ? pending.split(',').map(item => ({ page: item.slice(0, 32), updatedAt: item.slice(33) })) : [];
  if (!queue.length) return;
  let active = true, done = 0, wait: number | undefined;
  const failed: string[] = [];
  const total = queue.length;
  async function worker() {
   for (let job = queue.shift(); job && active && !wait; job = queue.shift()) {
    try {
     const body = await api<WikiEntryBody>('wiki-entries/' + job.page);
     cache.current = { ...cache.current, [job.page]: { updatedAt: job.updatedAt, text: attractionSentences(blockText(body.blocks)).map(row => row.quote).join('\n') } };
    } catch (error) {
     failed.push(job.page);
     if (error instanceof SyncError && error.status === 429) wait = error.retryAfter ?? 30;
    }
    done++;
    if (active) { setBodies(cache.current); setProgress({ done, total, failed: failed.length, wait }); }
   }
  }
  void Promise.all([worker(), worker()]).then(() => {
   if (!active) return;
   try { localStorage.setItem(bodiesKey, JSON.stringify(cache.current)); } catch { /* The next visit reads the bodies again. */ }
   setProgress({ done, total, failed: failed.length + queue.length, wait });
   setSkipped(list => [...list, ...failed, ...queue.map(job => job.page)]);
   setSaved(cache.current);
  });
  return () => { active = false; };
 }, [pending]);

 const observations = entries.flatMap(entry => entryObservations(entry, bodies[pageOf(entry) ?? '']?.text))
  .sort((a, b) => b.day.localeCompare(a.day));
 const reading = Boolean(progress && progress.done < progress.total && !progress.wait);
 const complete = !loading && !pending && !skipped.length;
 const visible = observations.filter(row => reviews[row.id]?.status !== 'rejected' && (!area || row.category === area));
 const rejected = observations.filter(row => reviews[row.id]?.status === 'rejected');
 const traits = traitGroups(observations, reviews);
 const stale = complete ? staleReviews(observations, reviews) : [];
 const known = [...new Set([...Object.values(reviews).flatMap(review => review.traits), ...seedTraits])];
 const years = [...new Set(visible.map(row => row.day.slice(0, 4)))];

 function save(next: Reviews) {
  try {
   localStorage.setItem(reviewsKey, JSON.stringify(next));
   setReviews(next);
   setNotice('');
  } catch { setNotice('확인 내용을 이 브라우저에 저장하지 못했어요.'); }
 }
 function update(row: TasteObservation, change: Partial<Pick<TasteReview, 'status' | 'traits'>>) {
  const current = reviews[row.id] ?? { traits: [], quote: row.quote, title: row.title, day: row.day };
  save({ ...reviews, [row.id]: { ...current, quote: row.quote, title: row.title, day: row.day, ...change } });
 }
 function decide(row: TasteObservation, status: ReviewStatus) {
  update(row, { status: reviews[row.id]?.status === status ? undefined : status });
 }
 function addTrait(row: TasteObservation) {
  const trait = draft.trim().slice(0, 30);
  if (trait) update(row, { traits: [...new Set([...(reviews[row.id]?.traits ?? []), trait])] });
  setDraft('');
  setEditing('');
 }
 function backup() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, reviews }, null, 1)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'taste-reviews.json' });
  link.click();
  URL.revokeObjectURL(url);
 }
 async function restore(file?: File) {
  try {
   const data: unknown = JSON.parse(await file!.text());
   const incoming = (data as { reviews?: unknown }).reviews;
   if (!incoming || typeof incoming !== 'object') throw new Error();
   const valid = Object.entries(incoming as Record<string, Partial<TasteReview>>).filter(([, review]) =>
    review && Array.isArray(review.traits) && review.traits.every(trait => typeof trait === 'string') && typeof review.quote === 'string' &&
    (review.status === undefined || review.status === 'confirmed' || review.status === 'rejected'));
   save({ ...reviews, ...Object.fromEntries(valid) as Reviews });
   setNotice('확인 내용 ' + valid.length + '건을 가져왔어요.');
  } catch { setNotice('가져올 수 없는 파일이에요.'); }
 }

 const item = (row: TasteObservation, hidden = false) => {
  const review = reviews[row.id];
  return <li key={row.id} className={review?.status === 'confirmed' ? 'confirmed' : undefined}>
   <blockquote>{row.quote}</blockquote>
   <p className="universe-meta">{when(row)} · {areas[row.category]} · <Link href={'/wiki?entry=' + encodeURIComponent(row.entryId)}>{row.title}</Link></p>
   {(review?.traits.length ?? 0) > 0 && <p className="taste-traits">{review!.traits.map(trait => <span key={trait}>{trait}
    <button type="button" aria-label={trait + ' 특성 떼기'} onClick={() => update(row, { traits: review!.traits.filter(value => value !== trait) })}>×</button></span>)}</p>}
   {hidden ? <button className="button" type="button" onClick={() => decide(row, 'rejected')}>다시 보이기</button> : <div className="form-actions">
    <button className="button" type="button" aria-pressed={review?.status === 'confirmed'} onClick={() => decide(row, 'confirmed')}>맞아요</button>
    <button className="button" type="button" onClick={() => decide(row, 'rejected')}>아니에요</button>
    {editing === row.id ? <>
     <input aria-label="붙일 특성" list="taste-trait-options" value={draft} maxLength={30} autoFocus onChange={event => setDraft(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter') addTrait(row); if (event.key === 'Escape') setEditing(''); }}/>
     <button className="button" type="button" onClick={() => addTrait(row)}>붙이기</button>
    </> : <button className="button" type="button" onClick={() => { setEditing(row.id); setDraft(''); }}>특성 붙이기</button>}
   </div>}
  </li>;
 };

 return <section className="resume-panel taste-universe" aria-labelledby="taste-attractions">
  <h2 id="taste-attractions">내가 끌린 것들</h2>
  <p className="universe-meta">기록에 “좋았다”, “인상적이었다”처럼 직접 적은 문장만 그대로 모았어요. 앱이 덧붙인 해석은 없어요. 맞는 문장에 특성을 붙이면 영역을 넘어 반복되는 취향이 모여요.</p>
  <datalist id="taste-trait-options">{known.map(trait => <option key={trait} value={trait}/>)}</datalist>
  {reading && <p role="status">기록 본문을 읽는 중 · {progress!.done}/{progress!.total}건. 읽은 만큼 먼저 보여줘요.</p>}
  {progress && !reading && progress.failed > 0 && <p role="alert">본문 {progress.failed}건을 읽지 못해 요약에서 찾은 문장만 보여줘요.{progress.wait ? ' Notion 요청이 잠시 제한됐어요.' : ''}{' '}
   <button className="button" type="button" onClick={() => { setProgress(undefined); setSkipped([]); }}>다시 읽기</button></p>}
  {notice && <p role="status">{notice}</p>}

  <h3>확인한 취향 특성</h3>
  {traits.length ? <div className="taste-clues">{traits.map(({ trait, rows, categories }) => <article key={trait} className="taste-topic">
   <h4>{trait}</h4>
   <p className="universe-meta">문장 {rows.length}개 · {categories.map(category => areas[category]).join(', ')}{categories.length > 1 && ' · 여러 영역에서 반복'}</p>
   <ul>{rows.slice(0, 3).map(row => <li key={row.id}>“{row.quote}” <Link href={'/wiki?entry=' + encodeURIComponent(row.entryId)}>{when(row)}</Link></li>)}</ul>
  </article>)}</div> : <p>아직 붙인 특성이 없어요. 아래 문장에서 “특성 붙이기”를 누르면 여기에 모여요.</p>}

  <h3>끌림 문장 · {visible.length}개</h3>
  {loading && !observations.length ? <p role="status">기록을 불러오는 중…</p> : !observations.length ? <p>끌림을 직접 적은 문장을 아직 찾지 못했어요.</p> : <>
   <div className="chips" role="group" aria-label="영역">
    {(['', ...Object.keys(areas)] as ('' | keyof typeof areas)[]).map(key => {
     const count = observations.filter(row => reviews[row.id]?.status !== 'rejected' && (!key || row.category === key)).length;
     return (!key || count > 0) && <button key={key} type="button" aria-pressed={area === key} onClick={() => setArea(key)}>{key ? areas[key] : '전체'} {count}</button>;
    })}
   </div>
   {years.map(year => {
    // One record often says the same thing in its summary and its body, so each record leads with two sentences.
    const records = new Map<string, TasteObservation[]>();
    for (const row of visible) if (row.day.startsWith(year)) records.set(row.pageId, [...(records.get(row.pageId) ?? []), row]);
    const limit = limits[year] ?? PAGE;
    return <section key={year} aria-label={year + '년'}>
     <h4 className="taste-year">{year}년</h4>
     <ul className="taste-quotes">{[...records].slice(0, limit).flatMap(([page, rows]) => {
      const shown = opened.includes(page) ? rows : rows.slice(0, 2);
      return [...shown.map(row => item(row)), ...(rows.length > shown.length ? [<li key={page + ':more'} className="taste-more">
       <button className="button" type="button" onClick={() => setOpened([...opened, page])}>{rows[0].title} · 문장 {rows.length - shown.length}개 더 보기</button>
      </li>] : [])];
     })}</ul>
     {records.size > limit && <button className="button" type="button" onClick={() => setLimits({ ...limits, [year]: limit + PAGE * 2 })}>{year}년 기록 {records.size - limit}건 더 보기</button>}
    </section>;
   })}
  </>}
  {rejected.length > 0 && <details><summary>아니라고 한 문장 {rejected.length}개</summary><ul className="taste-quotes">{rejected.map(row => item(row, true))}</ul></details>}
  {stale.length > 0 && <details><summary>다시 확인이 필요한 항목 {stale.length}건</summary>
   <p className="universe-meta">확인해 둔 문장이 지금 기록에서는 보이지 않아요. 원문이 바뀌었을 수 있어요.</p>
   <ul className="taste-quotes">{stale.map(row => <li key={row.id}>
    <blockquote>{row.quote}</blockquote>
    <p className="universe-meta">{row.day && dayLabel(row.day)} · {row.title}{row.traits.length > 0 && ' · ' + row.traits.join(', ')}</p>
    <button className="button" type="button" onClick={() => save(Object.fromEntries(Object.entries(reviews).filter(([id]) => id !== row.id)))}>확인 내용 지우기</button>
   </li>)}</ul>
  </details>}
  <details><summary>확인 내용 백업</summary>
   <p className="universe-meta">맞아요·아니에요·특성은 이 브라우저에만 저장돼요. 파일로 내보내 다른 기기에서 가져올 수 있어요. Notion은 바뀌지 않아요.</p>
   <div className="form-actions">
    <button className="button" type="button" onClick={backup}>파일로 내보내기</button>
    <label className="button">파일에서 가져오기<input type="file" accept="application/json" hidden onChange={event => { void restore(event.target.files?.[0]); event.target.value = ''; }}/></label>
   </div>
  </details>
 </section>;
}
