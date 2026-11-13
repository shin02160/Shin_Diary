'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/notion-sync';
import { today } from '@/lib/local-store';
import { monthLessonCount } from '@/lib/wiki-review';
import type { ArchiveCalendarEvent } from '@/lib/calendar/archive';

export function WikiReviewStats({ month, recordCount }: { month: string; recordCount: number }) {
 const [result, setResult] = useState<number | 'error'>();
 useEffect(() => {
  let active = true;
  const [year, monthNumber] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  void api<{ events: ArchiveCalendarEvent[] }>('life-calendar?from=' + month + '-01&to=' + last)
   .then(({ events }) => { if (active) setResult(monthLessonCount(events, month, today())); })
   .catch(() => { if (active) setResult('error'); });
  return () => { active = false; };
 }, [month]);
 return <section className="wiki-story-callout" aria-labelledby="wiki-review-stats">
  <h2 id="wiki-review-stats">이달의 기록과 활동</h2>
  <p>Notion 기록 {recordCount}개</p>
  {result === undefined ? <p role="status">완료가 확인된 레슨을 확인하는 중…</p> : result === 'error' ?
   <p role="status">일정 데이터를 불러오지 못했어요.</p> : <p>완료가 확인된 필라테스 {result}회</p>}
  <Link href={'/calendar?date=' + month + '-01'}>이달의 캘린더</Link>
 </section>;
}
