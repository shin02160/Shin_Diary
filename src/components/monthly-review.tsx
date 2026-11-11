"use client";
import { Icon } from '@/components/icon';

import { LocalDraft } from './local-draft';
import Link from 'next/link';
import { useState } from 'react';
import { dateKey } from '@/lib/dates';
import { orderedEntries, today, useArchive } from '@/lib/local-store';
import { categoryLabels } from '@/lib/sample-data';
import type { Activity, Entry } from '@/lib/types';
import { EntryCard } from './cards';

const PAGE_SIZE = 24;

export function MonthlyReview() {
  const { ready, entries, activities } = useArchive();
  if (!ready) return <p role="status">기록을 불러오는 중…</p>;
  return <Review entries={entries} activities={activities} />;
}

function Review({ entries, activities }: { entries: Entry[]; activities: Activity[] }) {
  const currentMonth = today().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [showSamples, setShowSamples] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = showSamples ? entries : entries.filter(entry => !entry.isSample);
  const dated = visible.map(entry => ({ entry, date: dateKey(entry.occurredAt) }));
  const months = [...new Set([currentMonth, month, ...dated.map(item => item.date.slice(0, 7))])].sort().reverse();
  const selected = dated.filter(item => item.date.slice(0, 7) === month);
  const records = orderedEntries(selected.map(item => item.entry));
  const recordedDays = new Set(selected.map(item => item.date)).size;

  const categoryCounts = new Map<Entry['category'], number>();
  const activityCounts = new Map<string, number>();
  for (const entry of records) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
    if (entry.activityId) activityCounts.set(entry.activityId, (activityCounts.get(entry.activityId) ?? 0) + 1);
  }
  const names = new Map(activities.map(activity => [activity.id, activity.name]));
  const linked = [...activityCounts].sort((a, b) => b[1] - a[1]);
  const monthName = (value: string) => value.slice(0, 4) + '년 ' + Number(value.slice(5)) + '월';

  return (
    <>
      <section className="resume-panel editor-form" aria-label="회고 범위">
        <label>회고할 월
          <select value={month} onChange={event => { setMonth(event.target.value); setLimit(PAGE_SIZE); }}>
            {months.map(value => <option value={value} key={value}>{monthName(value)}</option>)}
          </select>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={showSamples} onChange={event => { setShowSamples(event.target.checked); setLimit(PAGE_SIZE); }}/>
          샘플 함께 보기
        </label>
      </section>
      <p className="result-count" aria-live="polite">{monthName(month)} · 기록 {records.length}개 · 기록한 날 {recordedDays}일</p>
      {records.length === 0 ? (
        <div className="empty">
          <h2>이 달에는 아직 기록이 없어요</h2>
          <p>기록이 있는 다른 월을 선택하거나 새로운 순간을 남겨보세요.</p>
          <Link href="/capture" className="button">기록 남기기</Link>
        </div>
      ) : (
        <>
          <LocalDraft label="회고 초안" source={records.filter(entry => !entry.isSample && (entry.title || entry.content)).map(entry =>
            dateKey(entry.occurredAt) + ' · ' + (entry.title || entry.content).trim().replace(/\s+/g, ' ').slice(0, 160)
          ).join('\n').slice(0, 8000)}/>
          <div className="grid two">
            <section className="resume-panel">
              <h2>카테고리별 기록</h2>
              <ul>{[...categoryCounts].sort((a, b) => b[1] - a[1]).map(([category, count]) => (
                <li key={category}>{categoryLabels[category]} · {count}개</li>
              ))}</ul>
            </section>
            <section className="resume-panel">
              <h2>연결된 활동</h2>
              {linked.length ? (
                <ul>{linked.map(([id, count]) => (
                  <li key={id}><Link className="text-link" href={'/activities/' + encodeURIComponent(id)}>{names.get(id) ?? '연결된 활동'} <Icon name="open" size="small"/></Link> · {count}개 <Link className="text-link" href={'/activities/' + encodeURIComponent(id) + '/review'} aria-label={(names.get(id) ?? '연결된 활동') + ' 회고 보기'}>회고 보기 <Icon name="open" size="small"/></Link></li>
                ))}</ul>
              ) : <p>이 달에 활동과 연결한 기록이 없어요.</p>}
            </section>
          </div>
          <section aria-labelledby="review-entries">
            <h2 id="review-entries">이 달의 기록</h2>
            <div className="grid three">{records.slice(0, limit).map(entry => <EntryCard key={entry.id} entry={entry}/>)}</div>
            {records.length > limit && (
              <button className="button" type="button" onClick={() => setLimit(value => value + PAGE_SIZE)}>기록 더 보기</button>
            )}
          </section>
        </>
      )}
    </>
  );
}
