'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { notionActivityUrl } from '@/lib/activity-view';
import { api } from '@/lib/notion-sync';
import { gptReviewId } from '@/lib/wiki-review';
import { dateKey } from '@/lib/dates';
import type { ReviewSource } from '@/lib/review-draft';
import type { Entry, LocalDate } from '@/lib/types';

export function WikiGptReview({ month, records, existingId }: { month: string; records: Entry[]; existingId?: string }) {
 const [settings, setSettings] = useState<{ enabled: boolean; canSave: boolean }>();
 const [savedId, setSavedId] = useState<string>();
 const saved = savedId ?? existingId;
 const [draft, setDraft] = useState<{ text: string; generatedAt: string; sources: { id: string; title: string; url?: string }[] }>();
 const [busy, setBusy] = useState<'generating' | 'saving'>();
 const [error, setError] = useState('');
 const sources = records.filter(record => record.title?.trim() || record.content.trim()).slice(0, 12);
 const preview: ReviewSource[] = sources.map(record => ({
  date: dateKey(record.occurredAt), category: record.category,
  title: (record.title ?? '').trim().slice(0, 120), excerpt: record.content.trim().slice(0, 330),
 }));

 useEffect(() => {
  let active = true;
  void fetch('/api/review-draft', { cache: 'no-store' }).then(async response => {
   if (!response.ok) throw new Error();
   const value = await response.json();
   if (active) setSettings({ enabled: value.enabled === true, canSave: value.canSave === true });
  }).catch(() => {
   if (active) { setSettings({ enabled: false, canSave: false }); setError('GPT 생성 설정을 확인하지 못했어요.'); }
  });
  return () => { active = false; };
 }, []);

 async function generate() {
  setBusy('generating');
  setError('');
  try {
   const response = await fetch('/api/review-draft', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preview),
   });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || '회고를 생성하지 못했어요.');
   setDraft({ text: result.text, generatedAt: result.generatedAt,
    sources: sources.map((record, index) => ({ id: record.id, title: preview[index].title || preview[index].date, url: notionActivityUrl(record.notion?.pageId) })) });
  } catch (failure) {
   setError(failure instanceof Error ? failure.message : '회고를 생성하지 못했어요.');
  } finally { setBusy(undefined); }
 }

 async function save() {
  if (!draft?.text.trim() || !settings?.canSave || saved || busy) return;
  setBusy('saving');
  setError('');
  const references = draft.sources.map((source, index) =>
   '[' + (index + 1) + '] ' + source.title + (source.url ? ' ' + source.url : '')).join('\n');
  const record: Entry = {
   id: gptReviewId(month),
   title: month.slice(0, 4) + '년 ' + Number(month.slice(5)) + '월 GPT 회고',
   category: 'Daily',
   tags: ['GPT 회고'],
   occurredAt: { kind: 'date', date: (month + '-01') as LocalDate },
   createdAt: draft.generatedAt,
   content: draft.text.trim() + '\n\n근거 기록\n' + references,
  };
  try {
   const result = await api<{ record: Entry }>('archive', 'POST', { kind: 'entry', record });
   setSavedId(result.record.id);
  } catch (failure) {
   setError(failure instanceof Error ? failure.message : 'Notion에 저장하지 못했어요.');
  } finally { setBusy(undefined); }
 }

 if (saved) return <p role="status"><Link href={'/wiki?entry=' + encodeURIComponent(saved)}>Notion에 저장한 GPT 회고 보기</Link></p>;
 if (!sources.length) return null;
 return <details className="resume-panel">
  <summary>GPT 회고 초안</summary>
  {settings === undefined ? <p role="status">생성 설정을 확인하는 중…</p> : settings.enabled ? <>
   <p>생성 버튼을 누르면 아래 기록 {preview.length}개의 날짜, 분류, 제목, 요약 일부가 OpenAI로 전송됩니다.</p>
   <ol>{preview.map((record, index) => <li key={sources[index].id}>
    <p>{record.date} · {record.category} · {record.title}</p>
    {record.excerpt && <p className="preserve-lines">{record.excerpt}</p>}
   </li>)}</ol>
   <button className="button" type="button" disabled={Boolean(busy)} onClick={() => void generate()}>OpenAI로 보내고 초안 만들기</button>
  </> : !error && <p>GPT 회고 생성이 설정되지 않았어요.</p>}
  {busy && <p role="status">{busy === 'saving' ? 'Notion에 저장하는 중…' : '초안을 생성하는 중…'}</p>}
  {error && <p role="alert">{error}</p>}
  {draft && <>
   <label className="editor-form">검토할 초안
    <textarea rows={10} maxLength={8000} value={draft.text} disabled={Boolean(busy)}
     onChange={event => setDraft({ ...draft, text: event.target.value })}/>
   </label>
   <p>생성일 <time dateTime={draft.generatedAt}>{draft.generatedAt.slice(0, 10)}</time></p>
   <ol aria-label="근거 기록">{draft.sources.map(record => <li key={record.id}>
    <Link href={'/wiki?entry=' + encodeURIComponent(record.id)}>{record.title}</Link>
   </li>)}</ol>
   {settings?.canSave ? <button className="button" type="button" disabled={Boolean(busy) || !draft.text.trim()}
    onClick={() => void save()}>검토한 초안을 새 Notion 기록으로 저장</button> :
    <p>Notion 읽기 전용 모드에서는 초안을 복사해 사용할 수 있어요.</p>}
  </>}
 </details>;
}
