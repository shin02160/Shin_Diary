"use client";
import { useSyncExternalStore } from 'react';
import { activities as samples, entries as sampleEntries } from './sample-data';
import { dateKey } from './dates';
import type { Activity, Entry } from './types';
import { decode, safeUrl, type Archive } from './archive-schema';
export { decode, safeUrl };
export type { Archive };
export const STORAGE_KEY = 'mlu.archive.v1';
interface Snapshot extends Archive { ready: boolean; error: string | null }
const initial: Snapshot = { version: 1, revision: 0, activities: samples.map(a => ({ ...a, isSample: true })), entries: sampleEntries.map(e => ({ ...e, isSample: true })), ready: false, error: null };
let snapshot = initial;
const listeners = new Set<() => void>();
function publish(value: Snapshot) { snapshot = value; listeners.forEach(fn => fn()); }
function read(): Archive {
 const raw = localStorage.getItem(STORAGE_KEY);
 return raw === null ? { version: 1, revision: 0, activities: initial.activities, entries: initial.entries } : decode(raw);
}
function reload() { try { publish({ ...read(), ready: true, error: null }); } catch { publish({ ...snapshot, ready: true, error: '브라우저 저장소를 읽을 수 없습니다. 기존 데이터 보호를 위해 저장을 중단했습니다. 설정에서 원본 데이터를 백업하고 저장소 접근 상태를 확인해 주세요.' }); } }
function subscribe(fn: () => void) {
 listeners.add(fn);
 if (listeners.size === 1) { window.addEventListener('storage', storageChanged); reload(); }
 return () => { listeners.delete(fn); if (!listeners.size) window.removeEventListener('storage', storageChanged); };
}
function storageChanged(event: StorageEvent) { if (event.key === STORAGE_KEY || event.key === null) reload(); }
export function useArchive() { return useSyncExternalStore(subscribe, () => snapshot, () => initial); }
export function today(): string { return dateKey({ kind: 'zoned', instant: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }
export async function mutate(transform: (current: Archive) => Archive) {
 const write = () => {
  let current: Archive;
  try { current = read(); } catch { reload(); throw new Error('기존 저장 데이터를 읽을 수 없어 저장하지 않았습니다. 입력은 화면에 유지됩니다.'); }
  const updated = transform(current);
  const next = { ...updated, revision: current.revision + 1 };
  decode(JSON.stringify(next));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { throw new Error('브라우저에 저장하지 못했습니다. 저장 공간과 사이트 권한을 확인한 뒤 다시 시도하세요. 입력은 그대로 유지됩니다.'); }
  publish({ ...next, ready: true, error: null });
 };
 if (navigator.locks) await navigator.locks.request(STORAGE_KEY, write);
 else throw new Error('안전한 동시 저장을 지원하지 않는 브라우저입니다. 최신 Chrome, Edge 또는 Safari에서 localhost로 접속해 주세요.');
}
export async function saveEntry(entry: Entry) {
 await mutate(current => ({ ...current, entries: current.entries.some(e => e.id === entry.id) ? current.entries : [{ ...entry, isSample: false, syncPending: true }, ...current.entries] }));
}
export async function updateEntry(entry: Entry, expected: Entry) {
 await mutate(current => {
  const existing = current.entries.find(item => item.id === expected.id);
  if (!existing || existing.isSample || JSON.stringify(existing) !== JSON.stringify(expected)) {
   throw new Error('다른 탭이나 Notion에서 기록이 변경됐습니다. 입력을 복사한 뒤 새로고침해 주세요.');
  }
  return { ...current, entries: current.entries.map(item =>
   item.id === expected.id ? { ...entry, id: existing.id, syncPending: true } : item
  ) };
 });
}
export async function saveActivity(activity: Activity, expected?: Activity) {
 await mutate(current => {
  const previous = current.activities.find(a => a.id === activity.id);
  if (expected && JSON.stringify(previous) !== JSON.stringify(expected)) throw new Error('다른 탭에서 이 활동이 변경되었습니다. 입력을 복사한 뒤 새로고침하여 최신 내용을 확인해 주세요.');
  if (!expected && previous) return current;
  const next = { ...activity, isSample: false, syncPending: true, updatedAt: new Date().toISOString() };
  return { ...current, activities: previous ? current.activities.map(a => a.id === next.id ? next : a) : [next, ...current.activities] };
 });
}
export function orderedEntries(entries: Entry[]) { return [...entries].sort((a, b) => dateKey(b.occurredAt).localeCompare(dateKey(a.occurredAt)) || b.createdAt.localeCompare(a.createdAt)); }
