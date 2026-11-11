"use client";
import { Icon } from '@/components/icon';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { noteCalendarImport } from '@/lib/calendar/last-import';
import { eventPeriod, reviewImport } from '@/lib/calendar/event-utils';
import type { ImportedEvent, PreviewResult, SavedEvent } from '@/lib/calendar/types';
import { api, SyncError } from '@/lib/notion-sync';

interface Change {
  event: ImportedEvent;
  previous?: SavedEvent;
}
interface Review {
  source: PreviewResult;
  omitted: SavedEvent[];
  remaining: Change[];
  unchanged: number;
  completed: number;
  batch: string;
}

export function CalendarNotion({ preview, onRead, onSave }: {
  preview?: PreviewResult;
  onRead: (events: SavedEvent[]) => void;
  onSave: (event: SavedEvent) => void;
}) {
  const [canWrite, setCanWrite] = useState(false);
  const [review, setReview] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const mounted = useRef(false);
  const active = useRef(false);
  const retryAt = useRef(0);

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    void api<{ configured: boolean; readOnly?: boolean }>('status').then(status => {
      if (alive) setCanWrite(!status.readOnly);
    }).catch(() => {});

    return () => { alive = false; mounted.current = false; };
  }, []);

  async function run(action: () => Promise<void>) {
    if (active.current) return;
    if (Date.now() < retryAt.current) {
      setError(Math.ceil((retryAt.current - Date.now()) / 1000) + '초 후 다시 시도해 주세요.');
      return;
    }
    active.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    setNeedsLogin(false);
    try {
      await action();
    } catch (failure) {
      const retry = failure instanceof SyncError ? failure.retryAfter : undefined;
      if (retry) retryAt.current = Date.now() + retry * 1000;
      setNeedsLogin(failure instanceof SyncError && failure.status === 401);
      setError((failure instanceof Error ? failure.message : '일정을 처리하지 못했습니다.')
        + (retry ? ' ' + retry + '초 후 다시 시도해 주세요.' : ''));
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  async function read(compare: boolean) {
    setReview(undefined);
    const saved = await api<SavedEvent[]>('calendar');
    onRead(saved);
    if (!compare) {
      setMessage('Notion 일정 ' + saved.length + '개를 불러왔습니다.');
      return;
    }
    if (!preview) return;
    setReview({ source: preview, ...reviewImport(preview, saved), completed: 0, batch: crypto.randomUUID() });
  }

  async function save(plan: Review) {
    let completed = plan.completed;
    for (const [index, item] of plan.remaining.entries()) {
      if (!mounted.current) return;
      setMessage('Notion에 저장 중 · 완료 ' + completed + '개');
      const saved = await api<SavedEvent>('calendar', 'POST', {
        event: item.event, expected: item.previous?.revision ?? null, batch: plan.batch,
      });
      onSave(saved);
      completed++;
      noteCalendarImport(completed, plan.source.sourceName);
      setReview({ ...plan, completed, remaining: plan.remaining.slice(index + 1) });
    }
    setMessage('Notion에 ' + completed + '개 일정을 반영했습니다.');
  }

  const current = review?.source === preview ? review : undefined;
  const additions = current?.remaining.filter(item => !item.previous) ?? [];
  const updates = current?.remaining.filter(item => item.previous) ?? [];

  return (
    <section className="resume-panel" aria-labelledby="calendar-notion-heading">
      <h2 id="calendar-notion-heading">Notion 일정</h2>
      <div className="form-actions">
        <button type="button" className="button" disabled={busy} onClick={() => void run(() => read(false))}>
          <Icon name="cloudRead"/> 저장된 일정 불러오기
        </button>
        {preview && canWrite && (
          <button type="button" className="button" disabled={busy} onClick={() => void run(() => read(true))}>
            <Icon name="filter"/> Notion 저장 전 비교
          </button>
        )}
      </div>
      {current && (
        <div className="ics-result">
          <p>신규 {additions.length}개 · 변경 {updates.length}개 · 동일 {current.unchanged}개 · 저장 완료 {current.completed}개</p>
          <p>{current.source.sourceName} · {current.source.from} ~ {current.source.to}</p>
          {current.source.partial ? (
            <p>일부 일정이 제외된 파일이라 누락 여부를 판단할 수 없습니다.</p>
          ) : (
            <p>이번 파일에 없는 저장 일정 {current.omitted.length}개</p>
          )}
          {current.omitted.length > 0 && (
            <details>
              <summary>누락 후보 보기</summary>
              <p>이 일정은 Notion에 계속 보관됩니다.</p>
              <ul className="ics-preview-list">
                {current.omitted.map(({ event }) => (
                  <li key={event.id}>{event.title} · {eventPeriod(event)}</li>
                ))}
              </ul>
            </details>
          )}
          {updates.length > 0 && (
            <details>
              <summary>변경될 일정 {updates.length}개</summary>
              <ul className="ics-preview-list">
                {updates.map(({ event, previous }) => (
                  <li key={event.id}>
                    <p>저장된 일정 · {previous?.event.title} · {previous && eventPeriod(previous.event)}</p>
                    <p>미리보기 일정 · {event.title} · {eventPeriod(event)}</p>
                    {previous && previous.event.location !== event.location && (
                      <p>장소 · {previous.event.location || '없음'} <span className="sr-only">에서</span><Icon name="forward" size="small"/> {event.location || '없음'}</p>
                    )}
                    {previous && previous.event.description !== event.description && (
                      <details><summary>설명 비교</summary>
                        <p className="preserve-lines">{previous.event.description || '저장된 설명 없음'}</p>
                        <p className="preserve-lines">{event.description || '새 설명 없음'}</p>
                      </details>
                    )}
                    {previous && previous.event.status !== event.status && (
                      <p>일정 상태 · {previous.event.status} <span className="sr-only">에서</span><Icon name="forward" size="small"/> {event.status}</p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {current.remaining.length > 0 && (
            <button type="button" className="button primary" disabled={busy} onClick={() => void run(() => save(current))}>
              {current.completed ? '남은 일정 저장' : '비교한 일정 Notion에 저장'}
            </button>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {needsLogin && <Link href="/settings" className="text-link">설정에서 로그인</Link>}
    </section>
  );
}
