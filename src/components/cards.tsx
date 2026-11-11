import { SourceLinkPreview } from './source-link-preview';
import Image from 'next/image';
import { travelLabels, type TravelReferences } from '@/lib/entry-extras';
import Link from 'next/link';
import { sourceLinkHost } from '@/lib/source-links';
import { pending } from '@/lib/archive-schema';
import { categoryLabels, statusLabels } from '@/lib/sample-data';
import { dateLabel } from '@/lib/dates';
import type { Activity, Entry } from '@/lib/types';
export const categoryIcons = { Travel: '↟', Concert: '♫', Projects: '✳', Daily: '☼' };
export function EntryCard({ entry, readOnly = false }: { entry: Entry; readOnly?: boolean }) { return <article className={`entry-card tint-${entry.category}`}>{entry.photo ? <Image className="entry-photo" unoptimized width={600} height={400} src={entry.photo} alt={entry.title ? entry.title + '의 첨부 사진' : '기록에 첨부한 사진'}/> : <div className="entry-art" aria-hidden="true"><span>{categoryIcons[entry.category]}</span><i/><b/></div>}<div className="entry-body"><div className="eyebrow">{categoryLabels[entry.category]} {entry.mood && <span>· {entry.mood}</span>} {entry.isSample ? <span className="sample-badge">샘플</span> : <span className="sample-badge">{pending(entry) ? 'Notion 미반영' : 'Notion 반영됨'}</span>}</div><h3>{entry.title || entry.content.slice(0, 24) || sourceLinkHost(entry.sourceLinks?.[0] ?? '') || (entry.photo ? '사진 기록' : '링크 기록')}</h3>{entry.content && <p className="preserve-lines">{entry.content}</p>}
 {Boolean(entry.sourceLinks?.length) && <details className="event-details"><summary>관련 링크 {entry.sourceLinks?.length}개</summary>
  <ul className="ics-preview-list">{entry.sourceLinks?.map(url => <li key={url}>
   <a className="reference-link" href={url} target="_blank" rel="noopener noreferrer">
    <strong>{sourceLinkHost(url)}</strong><br/>{url} ↗
   </a>
  <SourceLinkPreview url={url}/>
  </li>)}</ul>
 </details>}{entry.travelReferences && <details className="event-details"><summary>여행 자료</summary><ul>{Object.entries(entry.travelReferences).map(([kind, url]) =>
  <li key={kind}><a href={url} target="_blank" rel="noopener noreferrer">{travelLabels[kind as keyof TravelReferences]} · {sourceLinkHost(url)} ↗</a></li>
 )}</ul></details>}<div className="entry-meta"><time>{dateLabel(entry.occurredAt)}</time>{entry.place && <span>⌖ {entry.place}</span>}</div>{entry.calendarEvent && <details className="event-details"><summary>연결된 일정 · {entry.calendarEvent.title}</summary><p>{entry.calendarEvent.period} · {entry.calendarEvent.sourceName}</p>{entry.calendarEvent.location && <p>{entry.calendarEvent.location}</p>}<Link className="text-link" href={'/calendar?date=' + entry.calendarEvent.date}>일정 날짜로 이동 ↗</Link></details>}{!readOnly && entry.activityId && <Link className="text-link" href={`/activities/${entry.activityId}`}>연결된 활동 보기 ↗</Link>}{!readOnly && !entry.isSample && <Link className="text-link" href={'/memories/' + encodeURIComponent(entry.id) + '/edit'}>기록 편집 ↗</Link>}</div></article>; }
export function ActivityCard({ activity }: { activity: Activity }) { return <Link href={`/activities/${activity.id}`} className={`activity-card tint-${activity.category}`}><div className="activity-top"><span className="activity-icon" aria-hidden="true">{categoryIcons[activity.category]}</span><span className={`status status-${activity.lifecycleStatus}`}>{statusLabels[activity.lifecycleStatus]}</span></div><div className="eyebrow">{categoryLabels[activity.category]} {activity.isSample ? <span className="sample-badge">샘플</span> : <span className="sample-badge">{pending(activity) ? 'Notion 미반영' : 'Notion 반영됨'}</span>}</div><h3>{activity.name}</h3><p>{activity.summary}</p>{activity.nextStep && <div className="next-step"><small>다음 작은 한 걸음</small>{activity.nextStep}</div>}<div className="tags">{activity.tags.map(tag => <span key={tag}>#{tag}</span>)}<span className="card-arrow" aria-hidden="true">↗</span></div></Link>; }
export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <div className="page-heading"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{children}</p></div>; }
