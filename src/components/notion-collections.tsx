import Image from 'next/image';
import { Icon, type IconName } from './icon';
import { dayLabel } from '@/lib/dates';
import { catalogLabels, type CatalogItem, type CatalogKind } from '@/lib/universe-catalog';

export const catalogIcons = { travel: 'travel', concert: 'concert', daily: 'daily', project: 'project' } satisfies Record<CatalogKind, IconName>;

export function CatalogCard({ item, compact = false }: { item: CatalogItem; compact?: boolean }) {
 const start = item.start?.slice(0, 10);
 const end = item.end?.slice(0, 10);
 const excerpt = item.summary?.trim().slice(0, 180);
 return (
  <article className={`universe-card universe-tone-${item.kind}${compact ? ' universe-card-compact' : ''}`}>
   {item.cover && <Image className="universe-cover" src={item.cover} alt="" width={560} height={320} unoptimized referrerPolicy="no-referrer"/>}
   {compact && !item.cover && <span className="universe-type-thumbnail"><Icon name={catalogIcons[item.kind]} size="large"/></span>}
   <div className="universe-card-body">
    <span className="universe-kind"><Icon name={catalogIcons[item.kind]} size="small"/> {item.type === '기록' || item.type === '활동' ? catalogLabels[item.kind] + ' · ' + item.type : item.type}</span>
    <h3>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} <Icon name="external" size="small"/></a> : item.title}</h3>
    {start && <p className="universe-meta"><Icon name="calendar" size="small"/> <time dateTime={item.start}>{dayLabel(start)}</time>{end && end !== start && <> ~ <time dateTime={item.end}>{dayLabel(end)}</time></>}</p>}
    {item.location && <p className="universe-meta"><Icon name="place" size="small"/> {item.location}</p>}
    {!compact && item.detail && <p className="universe-meta">{item.detail}</p>}
    {excerpt && (!compact || item.entry) && <p className="universe-excerpt">{excerpt}{(item.summary?.length ?? 0) > 180 && '…'}</p>}
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
