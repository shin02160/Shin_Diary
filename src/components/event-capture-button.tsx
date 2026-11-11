"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { eventDraftKey, type CalendarEntryLink } from '@/lib/calendar/entry-link';
import { eventPeriod } from '@/lib/calendar/event-utils';
import type { ImportedEvent } from '@/lib/calendar/types';

export function EventCaptureButton({ event }: { event: ImportedEvent }) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function open() {
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(event.id));
      const token = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const snapshot: CalendarEntryLink = {
        id: event.id, title: event.title.trim() || '제목 없는 일정', date: event.wallStart.slice(0, 10),
        period: eventPeriod(event).slice(0, 300), sourceName: event.sourceName, location: event.location,
      };
      sessionStorage.setItem(eventDraftKey(token), JSON.stringify(snapshot));
      router.push('/capture?event=' + token);
    } catch {
      setError('일정 정보를 전달하지 못했습니다. 브라우저의 저장소 권한을 확인해 주세요.');
    }
  }

  return (
    <>
      <button type="button" className="button" onClick={() => void open()}>이 일정으로 기록하기</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
