'use client';

import Image from 'next/image';
import { useState } from 'react';

export function SourceLinkPreview({ url }: { url: string }) {
 const [preview, setPreview] = useState<{ title: string; description: string; image?: string }>();
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 async function load() {
  setBusy(true);
  setError('');
  try {
   const response = await fetch('/api/notion/link-preview', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
   });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || '미리보기를 불러오지 못했습니다.');
   setPreview(result);
  } catch (failure) {
   setError(failure instanceof Error ? failure.message : '미리보기를 불러오지 못했습니다.');
  } finally { setBusy(false); }
 }
 if (!url.toLowerCase().startsWith('https://')) return null;
 return (
  <div className="link-preview">
   {!preview && <button className="button" type="button" disabled={busy} onClick={() => void load()}>{busy ? '불러오는 중…' : '링크 미리보기'}</button>}
   {error && <p role="status">{error}</p>}
   {preview && <>
    {preview.image && <Image className="entry-photo" unoptimized width={360} height={220} src={preview.image} alt=""/>}
    <strong>{preview.title}</strong>
    {preview.description && <p>{preview.description}</p>}
   </>}
  </div>
 );
}
