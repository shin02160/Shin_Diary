import { Icon, statusIcons } from '@/components/icon';
import { LocalDraft } from './local-draft';
import Link from 'next/link';
import { dateLabel, dayLabel } from '@/lib/dates';
import { categoryLabels, statusLabels } from '@/lib/sample-data';
import { sourceLinkHost } from '@/lib/source-links';
import type { Activity, Entry } from '@/lib/types';

export function ResumeCard({ activity, recent, onResume, resumeDisabled }: {
 activity: Activity;
 recent: Entry[];
 onResume?: () => void;
 resumeDisabled: boolean;
}) {
 const url = '/activities/' + encodeURIComponent(activity.id);
 const hasNotes = activity.lastProgress || activity.nextStep || activity.parkedAt || activity.resumeNotes;
 return (
  <article className="resume-panel">
   <div className="detail-status">
    <span className={`status status-${activity.lifecycleStatus}`}><Icon name={statusIcons[activity.lifecycleStatus]} size="small"/>{statusLabels[activity.lifecycleStatus]}</span>
    <span>{categoryLabels[activity.category]}{activity.isSample && ' · 샘플'}{activity.isArchived && ' · 아카이브'}</span>
   </div>
   <h2><Link className="text-link" href={url}>{activity.name}</Link></h2>
   {activity.summary && <p>{activity.summary}</p>}
   {hasNotes ? (
    <dl>
     {activity.lastProgress && <div><dt>마지막으로 한 일</dt><dd className="preserve-lines">{activity.lastProgress}</dd></div>}
     {activity.parkedAt && <div><dt>최근에 잠시 멈춘 날</dt><dd><time dateTime={activity.parkedAt}>{dayLabel(activity.parkedAt)}</time></dd></div>}
     {activity.nextStep && <div><dt>다음에 할 일</dt><dd className="preserve-lines">{activity.nextStep}</dd></div>}
     {activity.resumeNotes && <div><dt>재개 메모</dt><dd className="preserve-lines">{activity.resumeNotes}</dd></div>}
    </dl>
   ) : <p className="muted">아직 남긴 재개 메모가 없어요.</p>}
   {!!activity.references?.length && (
    <details className="event-details">
     <summary>참고 링크 {activity.references.length}개</summary>
     <ul>{activity.references.map(url => (
      <li key={url}><a className="reference-link" href={url} target="_blank" rel="noopener noreferrer">{url} <Icon name="external" size="small"/></a></li>
     ))}</ul>
    </details>
   )}
   {recent.length > 0 && (
    <>
     <h3>최근 연결 기록</h3>
     <ul>{recent.map(entry => (
      <li key={entry.id}><time>{dateLabel(entry.occurredAt)}</time> · {entry.title || entry.content.slice(0, 60) || sourceLinkHost(entry.sourceLinks?.[0] ?? '') || (entry.photo ? '사진 기록' : '링크 기록')}</li>
     ))}</ul>
     <Link className="text-link" href={url + '/review'}>연결 기록 돌아보기 <Icon name="open" size="small"/></Link>
    </>
   )}
   {!activity.isSample && hasNotes && <LocalDraft label="재개 초안" source={[
    activity.lastProgress && '마지막 진행 · ' + activity.lastProgress,
    activity.nextStep && '다음 할 일 · ' + activity.nextStep,
    activity.resumeNotes && '재개 메모 · ' + activity.resumeNotes,
   ].filter(Boolean).join('\n\n').slice(0, 8000)}/>}
   <div className="form-actions">
    {onResume && <button type="button" className="button primary" disabled={resumeDisabled} onClick={onResume}>활동 재개</button>}
    <Link className="button" href={url + '/edit'}>재개 메모 편집</Link>
   </div>
  </article>
 );
}
