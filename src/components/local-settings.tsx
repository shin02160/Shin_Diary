"use client";
import { Icon } from '@/components/icon';

import { useRef, useState } from 'react';
import { decode, mutate, STORAGE_KEY, today, useArchive, type Archive } from '@/lib/local-store';
import { archiveMarkdown } from '@/lib/archive-markdown';
import { planArchiveRestore } from '@/lib/archive-restore';

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LocalSettings() {
  const archive = useArchive();
  const { entries, activities, ready } = archive;
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [incoming, setIncoming] = useState<Archive>();
  const [busy, setBusy] = useState(false);
  const inProgress = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const plan = incoming && ready && !archive.error ? planArchiveRestore(archive, incoming) : undefined;

  function backup() {
    setError('');
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const blob = new Blob([raw || JSON.stringify({ version: 1, revision: 0, activities, entries })], { type: 'application/json' });
      download(blob, 'my-little-universe-backup.json');
    } catch {
      setError('저장소를 읽을 수 없어 백업하지 못했습니다. 브라우저 사이트 권한을 확인해 주세요.');
    }
  }

  function exportMarkdown() {
    setError('');
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw === null ? archive : decode(raw);
      const blob = new Blob([archiveMarkdown(current)], { type: 'text/markdown;charset=utf-8' });
      download(blob, 'my-little-universe-' + today() + '.md');
    } catch {
      setError('현재 기록을 읽을 수 없어 Markdown 파일을 만들지 못했습니다.');
    }
  }

  async function preview() {
    if (!file || inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    setIncoming(undefined);
    setError('');
    setMessage('');
    try {
      if (!file.size || file.size > MAX_BACKUP_BYTES) throw new Error('백업 파일은 5MB 이하의 JSON 파일이어야 합니다.');
      const text = await file.text();
      try {
        setIncoming(decode(text.replace(/^\uFEFF/, '')));
      } catch {
        throw new Error('Diary 백업 형식이나 기록·활동 연결을 확인해 주세요.');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '백업 파일을 읽지 못했습니다.');
    } finally {
      inProgress.current = false;
      setBusy(false);
    }
  }

  async function restore() {
    if (!incoming || !plan?.changes || inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const expectedRevision = archive.revision;
      await mutate(current => {
        if (current.revision !== expectedRevision) {
          throw new Error('저장 데이터가 변경됐습니다. 복원 미리보기를 다시 확인해 주세요.');
        }
        return planArchiveRestore(current, incoming).archive;
      });
      setMessage('백업에서 활동 ' + (plan.activities.added + plan.activities.restoredOverSample)
        + '개와 기록 ' + (plan.entries.added + plan.entries.restoredOverSample) + '개를 복원했습니다.');
      setIncoming(undefined);
      setFile(null);
      if (input.current) input.current.value = '';
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '백업을 복원하지 못했습니다.');
    } finally {
      inProgress.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="resume-panel">
      <div className="eyebrow">LOCAL STORAGE</div>
      <h2>이 브라우저에 기록하고 있어요</h2>
      <p>직접 남긴 기록 {entries.filter(entry => !entry.isSample).length}개 · 활동 {activities.filter(activity => !activity.isSample).length}개</p>
      <p>같은 주소·브라우저에서 다시 열면 유지됩니다. 다른 기기에서는 Notion에 반영한 기록을 불러올 수 있습니다. 사이트 데이터 삭제 시 미반영 기록은 사라지므로 중요한 내용은 백업해 주세요.</p>
      <div className="form-actions">
        <button type="button" className="button" onClick={backup} disabled={!ready || busy}><Icon name="backup"/> 저장 데이터 백업</button>
        <button type="button" className="button" onClick={exportMarkdown} disabled={!ready || !!archive.error || busy}>
          <Icon name="download"/> 내 기록 Markdown으로 내보내기
        </button>
      </div>
      <details>
        <summary><Icon name="restore" size="small"/> 백업에서 복원</summary>
        <div className="editor-form">
          <p>백업에 있는 기록과 활동을 이 브라우저에 추가합니다. 같은 ID의 내 기록과 활동은 현재 내용이 우선합니다.</p>
          {archive.error && <p role="status">현재 저장소를 읽을 수 없어 병합 복원을 진행할 수 없습니다.</p>}
          <label>Diary JSON 백업 파일
            <input ref={input} type="file" accept=".json,application/json" disabled={!ready || !!archive.error || busy}
              onChange={event => {
                setFile(event.target.files?.[0] ?? null);
                setIncoming(undefined);
                setError('');
                setMessage('');
              }}/>
          </label>
          <button type="button" className="button" disabled={!file || !!archive.error || busy} onClick={() => void preview()}>
            복원 미리보기
          </button>
          {plan && (
            <div className="ics-result" aria-live="polite">
              <p>추가할 활동 {plan.activities.added}개 · 기록 {plan.entries.added}개</p>
              <p>현재 내용을 유지할 활동 {plan.activities.kept}개 · 기록 {plan.entries.kept}개</p>
              {(plan.activities.restoredOverSample + plan.entries.restoredOverSample) > 0 && (
                <p>샘플 대신 내 내용으로 복원할 활동 {plan.activities.restoredOverSample}개 · 기록 {plan.entries.restoredOverSample}개</p>
              )}
              {plan.changes > 0 ? (
                <button type="button" className="button primary" disabled={busy} onClick={() => void restore()}>백업 복원 적용</button>
              ) : <p>이 백업에서 추가할 항목이 없습니다.</p>}
            </div>
          )}
        </div>
      </details>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>
  );
}
