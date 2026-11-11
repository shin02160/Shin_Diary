"use client";
import { Icon, statusIcons } from '@/components/icon';
import Link from 'next/link';
import { useArchive } from '@/lib/local-store';
import { statusLabels } from '@/lib/sample-data';
import { EntryCard, PageHeading } from './cards';
import { ActivityEditor } from './activity-editor';
export function ActivityDetail({ id, edit = false }: { id: string; edit?: boolean }) {
 const { activities, entries, ready } = useArchive(); const activity = activities.find(a => a.id === id);
 if (!ready) return <p role="status">활동을 불러오는 중…</p>;
 if (!activity) return <div className="empty"><h1>활동을 찾을 수 없어요</h1><p>이 브라우저에 저장된 활동인지 확인해 주세요.</p><Link className="button" href="/collection">활동 목록으로</Link></div>;
 if (edit) return <><PageHeading eyebrow="EDIT ACTIVITY" title="활동에 이야기를 더해요">상태와 재개 메모를 함께 정리하세요.</PageHeading><ActivityEditor key={id} activity={activity}/></>;
 const related = entries.filter(e => e.activityId === id);
 return <><Link href="/collection" className="text-link"><Icon name="back" size="small"/> 좋아하는 것들</Link><PageHeading eyebrow={activity.isSample ? 'ACTIVITY · SAMPLE' : 'MY ACTIVITY'} title={activity.name}>{activity.summary}</PageHeading><div className="detail-status"><span className={`status status-${activity.lifecycleStatus}`}><Icon name={statusIcons[activity.lifecycleStatus]} size="small"/>{statusLabels[activity.lifecycleStatus]}</span><span>아카이브: {activity.isArchived ? '보관됨' : '보관하지 않음'}</span></div><div className="form-actions"><Link className="button primary" href={`/activities/${id}/edit`}>활동 편집·상태 변경</Link><Link className="button" href={`/capture?activity=${encodeURIComponent(id)}`}>이 활동에 기록 남기기</Link><Link className="button" href={`/activities/${encodeURIComponent(id)}/review`}>활동 회고 보기</Link></div><section className="resume-panel"><div className="eyebrow">A PLACE TO BEGIN AGAIN</div><h2>이어서 할 때 기억할 것</h2><dl><div><dt>마지막으로 한 일</dt><dd>{activity.lastProgress || '아직 남긴 재개 메모가 없어요.'}</dd></div><div><dt>다음에 할 일</dt><dd>{activity.nextStep || '다시 마음이 가면 작은 한 걸음부터 시작해요.'}</dd></div>{activity.parkedAt && <div><dt>최근에 잠시 멈춘 날</dt><dd>{activity.parkedAt}</dd></div>}{activity.resumeNotes && <div><dt>재개 메모</dt><dd className="preserve-lines">{activity.resumeNotes}</dd></div>}{activity.satisfactionNote && <div><dt>만족한 이유</dt><dd className="preserve-lines">{activity.satisfactionNote}</dd></div>}{!!activity.references?.length && <div><dt>참고 링크</dt><dd>{activity.references.map(url => <a className="reference-link" key={url} href={url} target="_blank" rel="noopener noreferrer">{url} <Icon name="external" size="small"/></a>)}</dd></div>}</dl></section><div className="section-heading"><h2>이 활동의 순간들</h2><span>{related.length}개의 기록</span></div>{related.length ? <div className="grid two">{related.map(e => <EntryCard key={e.id} entry={e}/>)}</div> : <div className="empty"><h3>아직 연결된 순간이 없어요</h3><p>이 활동에 기록을 남겨보세요.</p></div>}</>;
}
