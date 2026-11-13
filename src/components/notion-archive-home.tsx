'use client';

import Link from 'next/link';
import { InterestsView } from './interests-view';
import { ActivityTimeline } from './activity-timeline';
import { useEffect, useState } from 'react';
import { Icon } from './icon';
import { CatalogCard, catalogIcons } from './notion-collections';
import { RecordReminder } from './record-reminder';
import { useDashboardPreferences } from '@/lib/dashboard-preferences';
import { compareExperience, experienceKey } from '@/lib/experience-order';
import { useArchive } from '@/lib/local-store';
import { api } from '@/lib/notion-sync';
import { buildCatalog, calendarCatalogItem, mergeCatalogEntries, catalogLabels, filterCatalog, type CatalogItem, type CatalogKind } from '@/lib/universe-catalog';
import type { ArchiveCalendarEvent } from '@/lib/calendar/archive';
import type { Activity, Entry } from '@/lib/types';
import type { NotionCollections } from '@/lib/notion-collections';

const kinds = (['travel', 'concert', 'daily', 'project'] as const) satisfies readonly CatalogKind[];
const PAGE = 18;
type Archive = { activities: Activity[]; entries: Entry[] };
type Result<T> = { data: T } | { error: string };

export function NotionArchiveHome({ mode = 'home', initialKind = 'all', focusSearch = false, remote = true, interestId }: {
 mode?: 'home' | 'explore' | 'wiki' | 'timeline' | 'interests';
 initialKind?: CatalogKind | 'all';
 focusSearch?: boolean;
 interestId?: string;
 remote?: boolean;
}) {
 const local = useArchive();
 const preferences = useDashboardPreferences();
 const [notionEntries, setNotionEntries] = useState<Result<{ entries: Entry[] }>>();
 const [archive, setArchive] = useState<Result<Archive>>();
 const [schedules, setSchedules] = useState<Result<CatalogItem[]>>();
 const [collections, setCollections] = useState<Result<NotionCollections>>();
 const [attempt, setAttempt] = useState(0);
 const [kind, setKind] = useState(initialKind);
 const [query, setQuery] = useState('');
 const [year, setYear] = useState('');
 const [tag, setTag] = useState('');
 const [list, setList] = useState(false);
 const [limit, setLimit] = useState(PAGE);

 useEffect(() => {
  let alive = true;
  const load = <T,>(path: string, update: (result: Result<T>) => void) => {
   void api<T>(path).then(data => { if (alive) update({ data }); })
    .catch(error => { if (alive) update({ error: error instanceof Error ? error.message : '기록을 불러오지 못했습니다.' }); });
  };
  load<{ entries: Entry[] }>('wiki-entries', setNotionEntries);
  if (mode === 'explore') load<{ events: ArchiveCalendarEvent[] }>('life-calendar', result => {
   if ('error' in result) setSchedules(result);
   else {
    const now = Date.now();
    setSchedules({ data: result.data.events.map(event => calendarCatalogItem(event, now)) });
   }
  });
  if (remote) load<Archive>('archive', setArchive);
  load<NotionCollections>('collections', setCollections);
  return () => { alive = false; };
 }, [attempt, remote, mode]);

 const collectionData = collections && 'data' in collections ? collections.data : undefined;
 const archiveData = remote ? archive && 'data' in archive ? archive.data : undefined : local.ready ? local : undefined;
 const remoteEntries = notionEntries && 'data' in notionEntries ? notionEntries.data.entries : [];
 const archiveItems = buildCatalog({
  activities: archiveData?.activities ?? [],
  entries: mergeCatalogEntries(remoteEntries, archiveData?.entries ?? []),
 }, collectionData);
 const items = schedules && 'data' in schedules ? [...archiveItems, ...schedules.data].sort(compareExperience) : archiveItems;
 const loading = (remote ? !archive : !local.ready) || !collections || !notionEntries || (mode === 'explore' && !schedules);
 const failedCollections = Object.entries(collectionData ?? {}).filter(([, value]) => value.state === 'failed');
 const sourceNames = { trips: '여행', performances: '공연' } as const;
 const errors = [
  schedules && 'error' in schedules ? schedules.error : '',
  notionEntries && 'error' in notionEntries ? notionEntries.error : '',
  archive && 'error' in archive ? archive.error : '',
  collections && 'error' in collections ? collections.error : '',
  ...failedCollections.map(([key, value]) => value.state === 'failed' ? sourceNames[key as keyof typeof sourceNames] + ' · ' + value.message : ''),
 ].filter(Boolean);
 const years = [...new Set(items.flatMap(item => {
  const value = experienceKey(item.startAt);
  return value ? [value.slice(0, 4)] : [];
 }))].sort().reverse();
 const tags = [...new Set(items.flatMap(item => item.tags))].sort((a, b) => a.localeCompare(b, 'ko'));
 const shown = filterCatalog(items, kind, query, year, tag);
 const dated = shown.filter(item => experienceKey(item.startAt));
 const undated = shown.filter(item => !experienceKey(item.startAt));
 const itemsByKey = new Map(items.map(item => [item.key, item]));
 const favorites = preferences.favorites.flatMap(key => {
  const item = itemsByKey.get(key);
  return item ? [item] : [];
 });
 const continuing = items.find(item => item.activity && !item.activity.isArchived &&
  (item.activity.lifecycleStatus === 'active' || item.activity.lifecycleStatus === 'parked'));
 const hasTruncatedSource = Object.values(collectionData ?? {}).some(value => value.state === 'ready' && value.truncated);

 function reload() {
  setSchedules(undefined);
  setArchive(undefined);
  setNotionEntries(undefined);
  setCollections(undefined);
  setAttempt(value => value + 1);
 }

 return <>
  {mode === 'interests' ? <InterestsView items={items} loadingActivities={loading} activitiesFailed={errors.length > 0} interestId={interestId}/> : mode === 'timeline' ? <ActivityTimeline items={items} loading={loading} failed={errors.length > 0}/> : mode === 'home' ? <>
   <section className="universe-hero">
    <div className="universe-hero-copy">
     <h1>나의 모든 기록과 이야기,<br/><span>Youngshin&apos;s Universe</span></h1>
     <p>여행, 공연, 일상과 프로젝트를 담은 개인 위키.</p>
    </div>
    <div className="universe-night" aria-hidden="true">
     <span className="universe-moon"/><span className="universe-star star-top"/><span className="universe-star star-left"/><span className="universe-star star-bottom"/>
    </div>
   </section>
   {!remote && local.ready && !local.error && <RecordReminder entries={local.entries}/>}
   <section aria-labelledby="universe-spaces">
    <div className="universe-heading"><h2 id="universe-spaces">나의 공간</h2><Link href="/explore">전체 탐색 <Icon name="next" size="small"/></Link></div>
    <Link className="text-link" href="/explore/interests">관심사 <Icon name="next" size="small"/></Link> <Link className="text-link" href="/explore/timeline">취향 연대기 <Icon name="next" size="small"/></Link>
    <div className="universe-spaces">
     {(['travel', 'concert', 'daily'] as const).map(key => <Link className={'universe-space universe-tone-' + key} key={key} href={'/explore?category=' + key}>
      <Icon name={catalogIcons[key]} size="large"/><strong>{catalogLabels[key]}</strong>
     </Link>)}
     <Link className="universe-space universe-tone-project" href="/wiki"><Icon name="wiki" size="large"/><strong>개인 WIKI</strong></Link>
    </div>
   </section>
   <section aria-labelledby="universe-recent">
    <div className="universe-heading"><h2 id="universe-recent"><Icon name="archive" size="small"/> 최근 기록</h2><Link href="/explore">모두 보기 <Icon name="next" size="small"/></Link></div>
    {items.length > 0 && <div className="universe-cards universe-recent">{items.filter(item => experienceKey(item.startAt)).slice(0, 6).map(item => <CatalogCard key={item.key} item={item} compact/>)}</div>}
    {!loading && items.length === 0 && !errors.length && <p className="universe-muted">아직 표시할 기록이 없어요.</p>}
   </section>
   {favorites.length > 0 && <section aria-labelledby="universe-favorites">
    <div className="universe-heading"><h2 id="universe-favorites"><Icon name="favorite" size="small"/> 즐겨찾기</h2></div>
    <div className="universe-cards universe-recent">{favorites.map(item => <CatalogCard key={item.key} item={item} compact/>)}</div>
   </section>}
   {continuing && <section aria-labelledby="universe-continue">
    <div className="universe-heading"><h2 id="universe-continue"><Icon name="resume" size="small"/> 이어서 하기</h2>
     <Link href="/continue">모두 보기 <Icon name="next" size="small"/></Link></div>
    <CatalogCard item={continuing}/>
   </section>}
   {preferences.recentWiki.length > 0 && <section aria-labelledby="universe-wiki-recent">
    <div className="universe-heading"><h2 id="universe-wiki-recent"><Icon name="wiki" size="small"/> 최근 WIKI 문서</h2>
     <Link href="/wiki">개인 WIKI <Icon name="next" size="small"/></Link></div>
    <ul className="universe-wiki-recent">{preferences.recentWiki.slice(0, 5).map(page => <li key={page.id}>
     <Link href={page.root ? '/wiki' : '/wiki?page=' + page.id}><Icon name="file" size="small"/> <span>{page.title}</span><Icon name="next" size="small"/></Link>
    </li>)}</ul>
   </section>}
  </> : <>
   <div className="universe-heading"><h1>{mode === 'wiki' ? '개인 WIKI' : '나의 기록 탐색'}</h1>{mode === 'explore' && <Link href="/explore/timeline">취향 연대기 <Icon name="next" size="small"/></Link>}</div>
   {mode === 'explore' && <Link className="text-link" href="/explore/interests">관심사 <Icon name="next" size="small"/></Link>}
   <div className="universe-filters">
    <label className="search icon-search">
     <Icon name="search" size="small"/><span className="sr-only">제목, 장소, 태그 검색</span>
     <input type="search" autoFocus={focusSearch} placeholder="제목, 장소, 태그 검색" value={query}
      onChange={event => { setQuery(event.target.value); setLimit(PAGE); }}/>
    </label>
    <p className="universe-muted">제목, 장소, 태그와 아티스트 등 표시 속성을 검색합니다.</p>
    <div className="chips" role="group" aria-label="카테고리">
     {(['all', ...kinds] as const).map(key => <button key={key} type="button" aria-pressed={kind === key}
      onClick={() => { setKind(key); setLimit(PAGE); }}>{key === 'all' ? '전체' : catalogLabels[key]}</button>)}
    </div>
    <div className="universe-filter-row">
     <label>연도 <select value={year} onChange={event => { setYear(event.target.value); setLimit(PAGE); }}>
      <option value="">전체</option>{years.map(value => <option key={value}>{value}</option>)}
     </select></label>
     {!!tags.length && <label>태그 <select value={tag} onChange={event => { setTag(event.target.value); setLimit(PAGE); }}>
      <option value="">전체</option>{tags.map(value => <option key={value}>{value}</option>)}
     </select></label>}
     <div className="chips" role="group" aria-label="보기 방식">
      <button type="button" aria-pressed={!list} aria-label="카드 보기" onClick={() => setList(false)}><Icon name="grid" size="small"/></button>
      <button type="button" aria-pressed={list} aria-label="목록 보기" onClick={() => setList(true)}><Icon name="list" size="small"/></button>
     </div>
    </div>
   </div>
   {shown.length > 0 && <>
    <p className="universe-muted" aria-live="polite">{shown.length}개</p>
    <div className={'universe-cards' + (list ? ' universe-list' : '')}>
     {dated.slice(0, limit).map(item => <CatalogCard key={item.key} item={item} compact={list}/>)}
    </div>
    {undated.length > 0 && dated.length < limit && <section aria-labelledby="undated-records">
     <h2 id="undated-records">날짜 미기록</h2>
     <div className={'universe-cards' + (list ? ' universe-list' : '')}>
      {undated.slice(0, limit - dated.length).map(item => <CatalogCard key={item.key} item={item} compact={list}/>)}
     </div>
    </section>}
    {shown.length > limit && <button className="button" type="button" onClick={() => setLimit(value => value + PAGE)}>기록 더 보기</button>}
   </>}
   {!loading && !shown.length && <>
    <p className="universe-muted" role="status">{errors.length ? '일부 기록을 불러오지 못했어요.' : items.length || query || year || tag || kind !== 'all'
     ? '조건에 맞는 기록이 없어요.' : '아직 표시할 기록이 없어요.'}</p>
    {(query || year || tag || kind !== 'all') && <button className="button" type="button" onClick={() => {
     setQuery('');
     setKind('all');
     setYear('');
     setTag('');
     setLimit(PAGE);
    }}>조건 초기화</button>}
   </>}
  </>}
  {mode !== 'home' && hasTruncatedSource && <p className="universe-muted">일부 데이터 소스는 최근 항목 500개까지 표시합니다.</p>}
  {loading && <p role="status" className="universe-muted">기록을 불러오는 중…</p>}
  {errors.length > 0 && <div className="universe-load-error">
   <ul>{errors.map(message => <li key={message} role="alert">{message}</li>)}</ul>
   <button type="button" className="button" onClick={reload}>다시 불러오기</button> <Link className="text-link" href="/settings">연결 상태</Link>
  </div>}
 </>;
}
