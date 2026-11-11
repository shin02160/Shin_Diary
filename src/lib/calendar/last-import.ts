'use client';
import { useSyncExternalStore } from 'react';

const key = 'mlu.calendar.last-notion-save';
const changed = 'mlu.calendar.saved';
function subscribe(listener: () => void) {
 window.addEventListener('storage', listener);
 window.addEventListener(changed, listener);
 return () => {
  window.removeEventListener('storage', listener);
  window.removeEventListener(changed, listener);
 };
}
function read() {
 try { return localStorage.getItem(key); } catch { return null; }
}
export function useLastCalendarImport() {
 const raw = useSyncExternalStore(subscribe, read, () => null);
 if (!raw) return null;
 try {
  const data = JSON.parse(raw) as { at: string; count: number; source: string };
  return typeof data.source === 'string' && Number.isFinite(Date.parse(data.at)) && Number.isInteger(data.count) && data.count > 0 ? data : null;
 } catch { return null; }
}
export function noteCalendarImport(count: number, source: string) {
 try {
  localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), count, source }));
  window.dispatchEvent(new Event(changed));
 } catch { /* Notion has already confirmed the save. */ }
}
