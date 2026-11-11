'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { dateKey } from '@/lib/dates';
import { today } from '@/lib/local-store';
import type { Entry } from '@/lib/types';

const enabledKey = 'mlu.record-reminder.enabled';
const dismissedKey = 'mlu.record-reminder.dismissed';
const changeEvent = 'mlu.record-reminder.change';

function subscribe(onChange: () => void) {
 window.addEventListener('storage', onChange);
 window.addEventListener(changeEvent, onChange);
 return () => {
  window.removeEventListener('storage', onChange);
  window.removeEventListener(changeEvent, onChange);
 };
}

function preference() {
 try {
  return localStorage.getItem(enabledKey) === 'true' ? localStorage.getItem(dismissedKey) ?? '' : null;
 } catch {
  return null;
 }
}

function subscribeToDate(onChange: () => void) {
 const timer = window.setInterval(onChange, 30_000);
 window.addEventListener('focus', onChange);
 return () => {
  window.clearInterval(timer);
  window.removeEventListener('focus', onChange);
 };
}

function writePreference(key: string, value: string) {
 localStorage.setItem(key, value);
 window.dispatchEvent(new Event(changeEvent));
}

export function RecordReminderSettings() {
 const enabled = useSyncExternalStore(subscribe, preference, () => null) !== null;
 const [error, setError] = useState(false);
 return (
  <section className="resume-panel">
   <h2>기록 리마인더</h2>
   <label className="checkbox-label">
    <input type="checkbox" checked={enabled} onChange={event => {
     try {
      writePreference(enabledKey, String(event.target.checked));
      setError(false);
     } catch {
      setError(true);
     }
    }}/>
    오늘 기록이 없으면 홈에 안내 표시
   </label>
   <p>현재 브라우저의 앱 홈에서만 표시됩니다.</p>
   {error && <p role="alert" className="form-error">브라우저에 리마인더 설정을 저장하지 못했습니다.</p>}
  </section>
 );
}

export function RecordReminder({ entries }: { entries: Entry[] }) {
 const dismissed = useSyncExternalStore(subscribe, preference, () => null);
 const date = useSyncExternalStore(subscribeToDate, today, () => '');
 const [error, setError] = useState(false);
 if (dismissed === null || !date || dismissed === date ||
     entries.some(entry => !entry.isSample && dateKey(entry.occurredAt) === date)) return null;

 return (
  <section className="resume-panel" aria-labelledby="record-reminder">
   <h2 id="record-reminder">오늘 기록을 남겨볼까요?</h2>
   <div className="form-actions">
    <Link href="/capture" className="button primary">오늘 기록 남기기</Link>
    <button className="button" type="button" onClick={() => {
     try {
      writePreference(dismissedKey, date);
      setError(false);
     } catch {
      setError(true);
     }
    }}>오늘은 닫기</button>
   </div>
   {error && <p role="alert" className="form-error">오늘 닫기 상태를 저장하지 못했습니다.</p>}
  </section>
 );
}
