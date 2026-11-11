'use client';

import Link from 'next/link';
import { useState } from 'react';
import { dateKey } from '@/lib/dates';
import { orderedEntries, today, useArchive } from '@/lib/local-store';
import { EntryCard } from './cards';

export function RediscoverMemories() {
  const { entries, ready, error } = useArchive();
  const [pickedId, setPickedId] = useState<string>();
  if (!ready) return <p role="status">기록을 불러오는 중…</p>;
  if (error) return <p role="alert">{error}</p>;

  const todayKey = today();
  const past = orderedEntries(entries.filter(entry => !entry.isSample && dateKey(entry.occurredAt) < todayKey));
  const anniversaries = past.filter(entry => dateKey(entry.occurredAt).slice(5) === todayKey.slice(5));
  const picked = past.find(entry => entry.id === pickedId);

  if (!past.length) return (
    <div className="empty">
      <h2>아직 지난 기록이 없어요</h2>
      <Link href="/capture" className="button">기록 남기기</Link>
    </div>
  );

  return (
    <>
      <section aria-labelledby="on-this-day">
        <div className="section-heading"><h2 id="on-this-day">이전 해의 오늘</h2></div>
        {anniversaries.length ? (
          <div className="grid three">{anniversaries.map(entry => <EntryCard key={entry.id} entry={entry}/>)}</div>
        ) : <p className="muted">이전 해의 같은 날짜에 남긴 기록이 없어요.</p>}
      </section>
      <section aria-labelledby="random-memory">
        <div className="section-heading"><h2 id="random-memory">무작위로 꺼내 보기</h2></div>
        <div className="form-actions">
          <button
            className="button primary"
            type="button"
            disabled={!!picked && past.length === 1}
            onClick={() => {
              const candidates = past.filter(entry => entry.id !== picked?.id);
              if (candidates.length) setPickedId(candidates[Math.floor(Math.random() * candidates.length)].id);
            }}
          >
            {picked ? '다른 추억 보기' : '추억 하나 꺼내기'}
          </button>
        </div>
        <p role="status" className="muted">
          {picked && (past.length === 1 ? '꺼내 볼 수 있는 기록이 한 개 있어요.' : '추억을 하나 골랐어요.')}
        </p>
        {picked && <div className="grid three"><EntryCard key={picked.id} entry={picked}/></div>}
      </section>
    </>
  );
}
