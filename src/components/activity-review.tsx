'use client';

import Link from 'next/link';
import { useState } from 'react';
import { dateKey, dayLabel } from '@/lib/dates';
import { orderedEntries, useArchive } from '@/lib/local-store';
import type { Entry } from '@/lib/types';
import { EntryCard, PageHeading } from './cards';

const DAYS_PER_PAGE = 14;

export function ActivityReview({ id }: { id: string }) {
  const { activities, entries, ready, error } = useArchive();
  const [dayLimit, setDayLimit] = useState(DAYS_PER_PAGE);
  if (!ready) return <p role="status">기록을 불러오는 중…</p>;
  if (error) return <p role="alert">{error}</p>;

  const activity = activities.find(item => item.id === id);
  if (!activity) return (
    <div className="empty">
      <h1>활동을 찾을 수 없어요</h1>
      <Link className="button" href="/collection">활동 목록으로</Link>
    </div>
  );

  const records = orderedEntries(entries.filter(entry =>
    entry.activityId === id && (!entry.isSample || activity.isSample)
  )).reverse();
  const byDay = new Map<string, Entry[]>();
  const places = new Set<string>();
  for (const entry of records) {
    const day = dateKey(entry.occurredAt);
    const group = byDay.get(day);
    if (group) group.push(entry);
    else byDay.set(day, [entry]);
    if (entry.place) places.add(entry.place);
  }
  const days = [...byDay.keys()];
  const range = days.length > 1 ? dayLabel(days[0]) + ' ~ ' + dayLabel(days[days.length - 1]) : days[0] && dayLabel(days[0]);
  const activityUrl = '/activities/' + encodeURIComponent(id);

  return (
    <>
      <Link href={activityUrl} className="text-link">← 활동 상세</Link>
      <PageHeading eyebrow="ACTIVITY REVIEW" title={activity.name + ' 회고'}>{activity.summary}</PageHeading>
      {days.length === 0 ? (
        <div className="empty">
          <h2>이 활동에 연결된 기록이 없어요</h2>
          <Link className="button" href={'/capture?activity=' + encodeURIComponent(id)}>이 활동에 기록 남기기</Link>
        </div>
      ) : (
        <>
          <section className="resume-panel" aria-label="활동 기록 요약">
            <p>{range} · 기록 {records.length}개 · 기록한 날 {days.length}일</p>
            {places.size > 0 && <p>기록에 남긴 장소 · {[...places].join(' · ')}</p>}
          </section>
          {[...byDay].slice(0, dayLimit).map(([day, group]) => (
            <section key={day}>
              <div className="section-heading"><h2><time dateTime={day}>{dayLabel(day)}</time></h2></div>
              <div className="grid three">{group.map(entry => <EntryCard key={entry.id} entry={entry}/>)}</div>
            </section>
          ))}
          {days.length > dayLimit && <button className="button" type="button" onClick={() => setDayLimit(value => value + DAYS_PER_PAGE)}>다음 날짜의 기록 보기</button>}
        </>
      )}
    </>
  );
}
