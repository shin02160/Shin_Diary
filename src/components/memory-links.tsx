'use client';

import Link from 'next/link';
import { useState } from 'react';
import { timelineDay } from '@/lib/activity-timeline';
import { dayLabel } from '@/lib/dates';
import type { CatalogItem } from '@/lib/universe-catalog';

export function MemoryLinks({ item, linked, candidates }: {
 item: CatalogItem; linked: CatalogItem[]; candidates: CatalogItem[];
}) {
 const key = 'mlu.timeline.memory-link.' + item.sourcePageId;
 const [saved, setSaved] = useState(() => {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
 });
 const [choice, setChoice] = useState('');
 const [error, setError] = useState(false);
 const target = candidates.find(candidate => candidate.key === saved);
 const options = candidates.filter(candidate => !linked.some(record => record.key === candidate.key));

 function save(value: string) {
  try {
   if (value) localStorage.setItem(key, value);
   else localStorage.removeItem(key);
   setSaved(value);
   setChoice('');
   setError(false);
  } catch { setError(true); }
 }

 return <>
  {target && <p>이 브라우저에서 연결한 기록 · <Link href={target.detailHref!}>{target.title}</Link></p>}
  {saved && !target && <p role="status">저장한 연결의 원본을 현재 조회할 수 없어요.</p>}
  <details>
   <summary>관련 기록 연결 확인</summary>
   <p>제목과 날짜를 확인한 뒤 관련 기록을 선택하세요. 선택은 이 브라우저에 저장됩니다.</p>
   <label>연결할 기록{' '}
    <select value={choice} onChange={event => setChoice(event.target.value)}>
     <option value="">기록 선택</option>
     {options.map(record => {
      const day = timelineDay(record.startAt);
      return <option key={record.key} value={record.key}>{record.type} · {day ? dayLabel(day) : '날짜 미기록'} · {record.title}</option>;
     })}
    </select>
   </label>
   <div className="form-actions">
    <button type="button" className="button" disabled={!choice || choice === saved} onClick={() => save(choice)}>연결 저장</button>
    {saved && <button type="button" className="button" onClick={() => save('')}>연결 해제</button>}
   </div>
   {error && <p role="alert">이 브라우저에 연결을 저장하지 못했어요.</p>}
  </details>
 </>;
}
