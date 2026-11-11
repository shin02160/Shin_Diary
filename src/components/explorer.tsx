"use client";
import { useState } from 'react';
import Link from 'next/link';
import { orderedEntries, saveActivity, useArchive } from '@/lib/local-store';
import { dateKey } from '@/lib/dates';
import { categoryLabels, statusLabels } from '@/lib/sample-data';
import { ActivityCard, EntryCard } from './cards';
import { ResumeCard } from './resume-card';
import type { Activity, Category, Entry } from '@/lib/types';
const categories = Object.keys(categoryLabels) as Category[];

function CollectionGallery({ activities }: { activities: Activity[] }) {
 const groups = new Map<Category, Activity[]>();
 for (const activity of activities) {
  const group = groups.get(activity.category);
  if (group) group.push(activity);
  else groups.set(activity.category, [activity]);
 }
 return categories.map(category => {
  const group = groups.get(category);
  if (!group) return null;
  const headingId = 'gallery-' + category;
  return (
   <section key={category} aria-labelledby={headingId}>
    <div className="section-heading"><h2 id={headingId}>{categoryLabels[category]}</h2><span>{group.length}개</span></div>
    <div className="grid two">{group.map(activity => <ActivityCard key={activity.id} activity={activity}/>)}</div>
   </section>
  );
 });
}

export function Explorer({ mode }: { mode: 'memories' | 'collection' | 'continue' }) {
 const { activities, entries, ready, error: storageError } = useArchive();
 const [showSamples, setShowSamples] = useState(true);
 const [collectionView, setCollectionView] = useState<'cards' | 'gallery' | 'list'>('cards');
 const [archived, setArchived] = useState(false);
 const [resuming, setResuming] = useState(false);
 const [resumeMessage, setResumeMessage] = useState('');
 const [resumeError, setResumeError] = useState('');
 const [category, setCategory] = useState<Category | 'all'>('all');
 const [query, setQuery] = useState('');
 const [from, setFrom] = useState('');
 const [to, setTo] = useState('');
 const [place, setPlace] = useState('');
 const [tag, setTag] = useState('');
 const [activity, setActivity] = useState('');
 const matchesCategory = (c: Category) => category === 'all' || c === category;
 const normalized = query.trim().toLocaleLowerCase('ko-KR');
 const normalizedPlace = place.trim().toLocaleLowerCase('ko-KR');
 const reversedRange = Boolean(from && to && from > to);
 const activityNames = new Map(activities.map(item => [item.id, item.name]));
 const availableTags = [...new Set(entries.filter(entry => showSamples || !entry.isSample).flatMap(entry => entry.tags))]
  .sort((left, right) => left.localeCompare(right, 'ko-KR'));
 const shownEntries = mode === 'memories' && !reversedRange ? orderedEntries(entries).filter(entry => {
  if ((!showSamples && entry.isSample) || !matchesCategory(entry.category)) return false;
  if (from || to) {
   const date = dateKey(entry.occurredAt);
   if ((from && date < from) || (to && date > to)) return false;
  }
  if (normalizedPlace && !entry.place?.toLocaleLowerCase('ko-KR').includes(normalizedPlace)) return false;
  if (tag && !entry.tags.includes(tag)) return false;
  if (activity && entry.activityId !== activity) return false;
  const searchable = [
   entry.title, entry.content, entry.place, entry.mood, entry.calendarEvent?.title,
   entry.activityId ? activityNames.get(entry.activityId) : undefined, ...entry.tags, ...(entry.sourceLinks ?? []), ...Object.values(entry.travelReferences ?? {}),
  ];
  return searchable.join(' ').toLocaleLowerCase('ko-KR').includes(normalized);
 }) : [];
 function resetFilters() {
  setCategory('all');
  setQuery('');
  setFrom('');
  setTo('');
  setPlace('');
  setTag('');
  setActivity('');
 }
 async function resumeArchived(item: Activity) {
  setResuming(true);
  setResumeMessage('');
  setResumeError('');
  try {
   await saveActivity({ ...item, isArchived: false, lifecycleStatus: 'active' }, item);
   setResumeMessage(item.name + ' 활동을 재개했습니다. 진행·중단 활동에서 볼 수 있어요.');
  } catch (error) {
   setResumeError(error instanceof Error ? error.message : '활동을 재개하지 못했습니다.');
  } finally {
   setResuming(false);
  }
 }
 const matchingActivities = activities.filter(item => {
  if ((!showSamples && item.isSample) || !matchesCategory(item.category)) return false;
  if (item.isArchived !== archived) return false;
  if (mode === 'continue' && !archived && item.lifecycleStatus !== 'active' && item.lifecycleStatus !== 'parked') return false;
  return [item.name, item.summary, ...item.tags].join(' ').toLocaleLowerCase('ko-KR').includes(normalized);
 });
 const activityTags = mode === 'collection'
  ? [...new Set(matchingActivities.flatMap(item => item.tags))].sort((left, right) => left.localeCompare(right, 'ko-KR'))
  : [];
 const shownActivities = mode === 'collection' && tag
  ? matchingActivities.filter(item => item.tags.includes(tag))
  : matchingActivities;
 const recentByActivity = new Map<string, Entry[]>();
 if (mode === 'continue') {
  const shownIds = new Set(shownActivities.map(item => item.id));
  for (const entry of orderedEntries(entries)) {
   if (!entry.activityId || !shownIds.has(entry.activityId) || (entry.isSample && !showSamples)) continue;
   const recent = recentByActivity.get(entry.activityId);
   if (!recent) recentByActivity.set(entry.activityId, [entry]);
   else if (recent.length < 3) recent.push(entry);
  }
 }
 const count = mode === 'memories' ? shownEntries.length : shownActivities.length;
 if (!ready) return <p role="status">기록을 불러오는 중…</p>;
 return <><div className="form-actions"><Link className="button primary" href={mode === 'memories' ? '/capture' : '/activities/new'}>{mode === 'memories' ? '＋ 기록 남기기' : '＋ 새 활동'}</Link><label className="checkbox-label"><input type="checkbox" checked={showSamples} onChange={e => setShowSamples(e.target.checked)}/>샘플 함께 보기</label>{mode === 'collection' && <label className="checkbox-label"><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)}/>아카이브 보기</label>}</div><div className="filter-row"><div className="chips" role="group" aria-label="카테고리 필터">{(['all', ...Object.keys(categoryLabels)] as (Category | 'all')[]).map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c === 'all' ? '전체' : categoryLabels[c]}</button>)}</div><label className="search"><span className="sr-only">기록과 활동 검색</span><input type="search" placeholder="마음에 남은 단어 찾기" value={query} onChange={e => setQuery(e.target.value)}/></label></div>{mode === 'continue' && (
  <>
   <div className="chips" role="group" aria-label="재개 활동 범위">
    <button type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>진행·중단 활동</button>
    <button type="button" aria-pressed={archived} onClick={() => setArchived(true)}>아카이브 활동</button>
   </div>
   <div role="status">{resumeMessage}</div>
   {resumeError && <p role="alert" className="form-error">{resumeError}</p>}
  </>
 )}{mode === 'collection' && (
  <div className="form-actions">
   <div className="chips" role="group" aria-label="컬렉션 보기 방식">
    <button type="button" aria-pressed={collectionView === 'cards'} onClick={() => setCollectionView('cards')}>전체 카드</button>
    <button type="button" aria-pressed={collectionView === 'gallery'} onClick={() => setCollectionView('gallery')}>카테고리별 갤러리</button>
    <button type="button" aria-pressed={collectionView === 'list'} onClick={() => setCollectionView('list')}>목록 보기</button>
   </div>
   <label>관심사 태그{' '}
    <select value={tag} onChange={event => setTag(event.target.value)}>
     <option value="">모든 태그</option>
     {tag && !activityTags.includes(tag) && <option value={tag}>{tag}</option>}
     {activityTags.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
   </label>
  </div>
 )}{mode === 'memories' && (
  <details className="resume-panel">
   <summary>날짜·장소·태그·활동 필터{(from || to || place || tag || activity) && ' · 적용 중'}</summary>
   <div className="editor-form">
    <div className="form-grid">
     <label>시작일<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
     <label>종료일<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
     <label>장소<input type="search" value={place} onChange={event => setPlace(event.target.value)}/></label>
     <label>태그<select value={tag} onChange={event => setTag(event.target.value)}>
      <option value="">모든 태그</option>
      {tag && !availableTags.includes(tag) && <option value={tag}>{tag}</option>}
      {availableTags.map(value => <option value={value} key={value}>{value}</option>)}
     </select></label>
     <label>연결 활동<select value={activity} onChange={event => setActivity(event.target.value)}>
      <option value="">모든 활동</option>
      {activities.map(item => <option value={item.id} key={item.id}>{item.name}{item.isSample ? ' · 샘플' : ''}</option>)}
     </select></label>
    </div>
    {reversedRange && <p className="form-error" role="alert">종료일은 시작일과 같거나 이후여야 합니다.</p>}
    <button type="button" className="button" onClick={resetFilters}>검색 조건 초기화</button>
   </div>
  </details>
 )}<p className="result-count" aria-live="polite">{count}개의 {mode === 'memories' ? '기록' : '활동'}</p>{count === 0 ? <div className="empty"><span aria-hidden="true">✧</span><h2>아직 이곳은 비어 있어요</h2><p>{mode === 'memories' ? '검색 조건을 바꿔 다시 찾아보세요.' : mode === 'continue' && archived ? '현재 조건에 맞는 아카이브 활동이 없어요.' : '다른 카테고리나 검색어로 찾아보세요.'}</p><button className="button" onClick={resetFilters}>전체 보기</button></div> : mode === 'collection' && collectionView === 'gallery' ? <CollectionGallery activities={shownActivities}/>
 : mode === 'collection' && collectionView === 'list' ? (
  <ul className="collection-list">
   {shownActivities.map(item => <li key={item.id}>
    <Link href={'/activities/' + encodeURIComponent(item.id)} className="text-link">{item.name}</Link>
    <span>{categoryLabels[item.category]} · {statusLabels[item.lifecycleStatus]}{item.isSample && ' · 샘플'}</span>
    {!!item.tags.length && <span>{item.tags.join(' · ')}</span>}
   </li>)}
  </ul>
 ) : <div className={`grid ${mode === 'memories' ? 'three' : 'two'}`}>{mode === 'memories' ? shownEntries.map(e => <EntryCard key={e.id} entry={e}/>) : shownActivities.map(a => mode === 'continue'
  ? <ResumeCard key={a.id} activity={a} recent={recentByActivity.get(a.id) ?? []}
    onResume={a.isArchived && !a.isSample ? () => resumeArchived(a) : undefined}
    resumeDisabled={resuming || !!storageError}/>
  : <ActivityCard key={a.id} activity={a}/>)}</div>}</>;
}
