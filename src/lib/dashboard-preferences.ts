'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'mlu.dashboard.v1';
const CHANGE_EVENT = 'mlu:dashboard-change';
const WIKI_ID = /^[a-f0-9]{32}$/i;
const MAX_RECENT = 8;
const MAX_FAVORITES = 500;

export interface RecentWiki {
 id: string;
 title: string;
 root: boolean;
}

interface DashboardPreferences {
 favorites: string[];
 recentWiki: RecentWiki[];
}

const empty: DashboardPreferences = { favorites: [], recentWiki: [] };

function readSnapshot() {
 try { return localStorage.getItem(STORAGE_KEY) ?? ''; }
 catch { return ''; }
}

function decode(raw: string): DashboardPreferences {
 if (!raw) return empty;
 try {
  const value = JSON.parse(raw) as Partial<DashboardPreferences> | null;
  const favorites = Array.isArray(value?.favorites)
   ? value.favorites.filter(key => typeof key === 'string' && key.length <= 200).slice(0, MAX_FAVORITES) : [];
  const recentWiki = Array.isArray(value?.recentWiki)
   ? value.recentWiki.filter(page => page && typeof page.id === 'string' && WIKI_ID.test(page.id) &&
     typeof page.title === 'string' && page.title.length <= 180 && typeof page.root === 'boolean').slice(0, MAX_RECENT) : [];
  return { favorites, recentWiki };
 } catch { return empty; }
}

function subscribe(notify: () => void) {
 const onStorage = (event: StorageEvent) => {
  if (event.key === STORAGE_KEY || event.key === null) notify();
 };
 window.addEventListener('storage', onStorage);
 window.addEventListener(CHANGE_EVENT, notify);
 return () => {
  window.removeEventListener('storage', onStorage);
  window.removeEventListener(CHANGE_EVENT, notify);
 };
}

export function useDashboardPreferences() {
 return decode(useSyncExternalStore(subscribe, readSnapshot, () => ''));
}

function update(transform: (current: DashboardPreferences) => DashboardPreferences) {
 try {
  const current = decode(localStorage.getItem(STORAGE_KEY) ?? '');
  const next = transform(current);
  if (next !== current) {
   localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
   window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return true;
 } catch { return false; }
}

export function toggleFavorite(key: string) {
 return update(current => ({
  ...current,
  favorites: current.favorites.includes(key)
   ? current.favorites.filter(saved => saved !== key)
   : [key, ...current.favorites].slice(0, MAX_FAVORITES),
 }));
}

export function rememberWiki(page: RecentWiki) {
 if (!WIKI_ID.test(page.id)) return;
 const next = { ...page, title: page.title.trim().slice(0, 180) || '개인 WIKI' };
 update(current => {
  const first = current.recentWiki[0];
  if (first?.id === next.id && first.title === next.title && first.root === next.root) return current;
  return { ...current, recentWiki: [next, ...current.recentWiki.filter(saved => saved.id !== page.id)].slice(0, MAX_RECENT) };
 });
}
