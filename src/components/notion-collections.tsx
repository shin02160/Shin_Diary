'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { Icon, type IconName } from './icon';
import { toggleFavorite, useDashboardPreferences } from '@/lib/dashboard-preferences';
import { dayLabel } from '@/lib/dates';
import { catalogLabels, type CatalogItem, type CatalogKind } from '@/lib/universe-catalog';

export const catalogIcons = { travel: 'travel', concert: 'concert', daily: 'daily', project: 'project', uncategorized: 'archive' } satisfies Record<CatalogKind, IconName>;

export function CollectionCover({ src, kind, compact = false }: { src?: string; kind: CatalogKind; compact?: boolean }) {
 const [failedSource, setFailedSource] = useState<string>();
 if (src && failedSource !== src) return <Image className="universe-cover" src={src} alt="" width={560} height={320}
  unoptimized referrerPolicy="no-referrer" onError={() => setFailedSource(src)}/>;
 return <span className={compact ? 'universe-type-thumbnail' : 'universe-cover universe-cover-placeholder'}>
  <Icon name={catalogIcons[kind]} size="large"/>
 </span>;
}

export function FavoriteButton({ recordKey, title }: { recordKey: string; title: string }) {
 const { favorites } = useDashboardPreferences();
 const [error, setError] = useState(false);
 const selected = favorites.includes(recordKey);
 return <>
  <button type="button" className="universe-favorite" aria-pressed={selected} aria-label={title + ' 즐겨찾기'}
   title={selected ? '즐겨찾기 해제' : '즐겨찾기 추가'} onClick={() => setError(!toggleFavorite(recordKey))}>
   <Icon name="favorite" size="small"/>
  </button>
  {error && <span className="universe-muted" role="alert">즐겨찾기를 저장하지 못했어요.</span>}
 </>;
}

export function CatalogCard({ item, compact = false }: { item: CatalogItem; compact?: boolean }) {
 const start = item.start?.slice(0, 10);
 const end = item.end?.slice(0, 10);
 const excerpt = item.summary?.trim().slice(0, 100);
 return (
  <article className={`universe-card universe-tone-${item.kind}${compact ? ' universe-card-compact' : ''}`}>
   {(item.cover || compact || item.detailHref) && <CollectionCover src={item.cover} kind={item.kind} compact={compact}/>}
   <div className="universe-card-body">
    <span className="universe-kind"><Icon name={catalogIcons[item.kind]} size="small"/> {item.type === '기록' || item.type === '활동' ? catalogLabels[item.kind] + ' · ' + item.type : item.type}</span>
    <div className="universe-card-heading">
     <h3>{item.detailHref ? <Link href={item.detailHref}>{item.title} <Icon name="next" size="small"/></Link> : item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} <Icon name="external" size="small"/></a> : item.title}</h3>
     <FavoriteButton recordKey={item.key} title={item.title}/>
    </div>
    {start && <p className="universe-meta"><Icon name="calendar" size="small"/> <time dateTime={item.start}>{dayLabel(start)}</time>{end && end !== start && <> ~ <time dateTime={item.end}>{dayLabel(end)}</time></>}</p>}
    {item.location && <p className="universe-meta"><Icon name="place" size="small"/> {item.location}</p>}
    {!item.detailHref && !compact && item.detail && <p className="universe-meta">{item.detail}</p>}
    {(!item.detailHref || item.entry) && excerpt && (!compact || item.entry) && <p className="universe-excerpt">{excerpt}{(item.summary?.length ?? 0) > 100 && '…'}</p>}
    {!compact && item.activity && (item.activity.nextStep || item.activity.lastProgress) && <details>
     <summary>이어서 하기</summary>
     {item.activity.lastProgress && <p className="universe-excerpt">{item.activity.lastProgress}</p>}
     {item.activity.nextStep && <p className="universe-excerpt">{item.activity.nextStep}</p>}
    </details>}
    {!compact && !!item.tags.length && <p className="universe-meta">{item.tags.map(tag => '#' + tag).join(' · ')}</p>}
   </div>
  </article>
 );
}
