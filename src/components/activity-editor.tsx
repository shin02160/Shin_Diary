"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { categoryLabels, statusLabels } from '@/lib/sample-data';
import { safeUrl, saveActivity, today, useArchive } from '@/lib/local-store';
import type { Activity, Category, LifecycleStatus, LocalDate } from '@/lib/types';
export function ActivityEditor({ activity }: { activity?: Activity }) {
 const router = useRouter(); const { error: storageError, ready } = useArchive();
 const base = useRef(activity).current;
 const [name, setName] = useState(activity?.name || ''); const [category, setCategory] = useState<Category>(activity?.category || 'Daily');
 const [status, setStatus] = useState<LifecycleStatus>(activity?.lifecycleStatus || 'interested'); const [archived, setArchived] = useState(activity?.isArchived || false);
 const [summary, setSummary] = useState(activity?.summary || ''); const [lastProgress, setLastProgress] = useState(activity?.lastProgress || ''); const [nextStep, setNextStep] = useState(activity?.nextStep || '');
 const [resumeNotes, setResumeNotes] = useState(activity?.resumeNotes || ''); const [references, setReferences] = useState(activity?.references?.join('\n') || ''); const [satisfactionNote, setSatisfactionNote] = useState(activity?.satisfactionNote || ''); const [tags, setTags] = useState(activity?.tags.join(', ') || '');
 const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const busy = useRef(false); const id = useRef(activity?.id);
 async function submit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (busy.current) return; setError('');
  if (!name.trim()) { setError('활동 이름을 입력해 주세요.'); return; }
  const urls = references.split('\n').map(s => s.trim()).filter(Boolean);
  if (urls.some(url => !safeUrl(url))) { setError('참고 링크는 http 또는 https 주소로 한 줄에 하나씩 입력해 주세요.'); return; }
  busy.current = true; setSaving(true); id.current ??= crypto.randomUUID();
  const next: Activity = { ...base, id: id.current, name: name.trim(), category, lifecycleStatus: status, isArchived: archived, summary: summary.trim(), lastProgress: lastProgress.trim(), nextStep: nextStep.trim(), resumeNotes: resumeNotes.trim(), references: urls, satisfactionNote: satisfactionNote.trim(), tags: [...new Set(tags.split(',').map(t => t.trim()).filter(Boolean))], parkedAt: status === 'parked' && base?.lifecycleStatus !== 'parked' ? today() as LocalDate : base?.parkedAt };
  try { await saveActivity(next, base); router.push(`/activities/${next.id}`); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했습니다.'); busy.current = false; setSaving(false); }
 }
 return <form className="editor-form resume-panel" onSubmit={submit}><label>활동 이름 <span className="muted">필수</span><input required maxLength={150} value={name} onChange={e => setName(e.target.value)}/></label><div className="form-grid"><label>카테고리<select value={category} onChange={e => setCategory(e.target.value as Category)}>{Object.entries(categoryLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>활동 상태<select value={status} onChange={e => setStatus(e.target.value as LifecycleStatus)}>{Object.entries(statusLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label></div><label className="checkbox-label"><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)}/>아카이브에 보관</label><p className="muted">아카이브는 활동 상태와 별개예요. 만족 완료한 활동도 다시 경험 중으로 바꿀 수 있어요.</p><label>활동 소개<textarea rows={2} maxLength={4000} value={summary} onChange={e => setSummary(e.target.value)}/></label><fieldset><legend>다시 시작할 나를 위한 메모</legend><label>마지막으로 한 일<textarea rows={3} maxLength={4000} value={lastProgress} onChange={e => setLastProgress(e.target.value)}/></label><label>다음에 할 일<textarea rows={2} maxLength={4000} value={nextStep} onChange={e => setNextStep(e.target.value)}/></label><label>재개 메모<textarea rows={3} maxLength={8000} value={resumeNotes} onChange={e => setResumeNotes(e.target.value)}/></label><label>참고 링크 (한 줄에 하나)<textarea rows={3} maxLength={4000} placeholder="https://…" value={references} onChange={e => setReferences(e.target.value)}/></label></fieldset><label>만족한 이유<textarea rows={2} maxLength={4000} value={satisfactionNote} onChange={e => setSatisfactionNote(e.target.value)}/></label><label>태그 (쉼표로 구분)<input maxLength={500} value={tags} onChange={e => setTags(e.target.value)}/></label>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-actions"><button type="submit" className="button primary" disabled={saving || !!storageError || !ready}>{saving ? '저장 중…' : '활동 저장'}</button><Link className="button" href={activity ? `/activities/${activity.id}` : '/collection'}>취소</Link></div></form>;
}
