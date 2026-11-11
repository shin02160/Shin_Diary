'use client';

import { useState } from 'react';

export function SiteUnlock({ next, numeric }: { next: string; numeric: boolean }) {
 const [password, setPassword] = useState('');
 const [visible, setVisible] = useState(false);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 async function unlock(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (busy) return;
  setBusy(true);
  setError('');
  try {
   const response = await fetch('/api/site/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
   });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error);
   location.replace(next);
  } catch (failure) {
   setError(failure instanceof Error ? failure.message : '잠금을 해제하지 못했습니다. 다시 시도해 주세요.');
   setBusy(false);
  }
 }
 return (
  <section className="site-lock-card" aria-labelledby="site-lock-title">
   <div className="site-lock-icon" aria-hidden="true">🔒</div>
   <h1 id="site-lock-title">다이어리 잠금 해제</h1>
   <p>{numeric ? '설정된 숫자 4자리를 입력하세요.' : '다이어리 비밀번호를 입력하세요.'}</p>
   <form onSubmit={unlock}>
    <label htmlFor="site-password">다이어리 비밀번호</label>
    <div className="site-lock-input">
     <input id="site-password" type={visible ? 'text' : 'password'} inputMode={numeric ? 'numeric' : undefined}
      pattern={numeric ? '[0-9]{4}' : undefined} maxLength={numeric ? 4 : 1000}
      value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required/>
     <button type="button" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? '숨기기' : '보기'}</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="button primary site-lock-submit" disabled={busy}>{busy ? '확인 중…' : '다이어리 열기 →'}</button>
   </form>
  </section>
 );
}
