'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, SyncError } from '@/lib/notion-sync';
import type { WikiBlock, WikiPage } from '@/lib/wiki';

function Blocks({ blocks }: { blocks: WikiBlock[] }) {
 return blocks.map(block => {
  const text = block.text.map((item, index) => item.url
   ? <a key={index} href={item.url} target="_blank" rel="noopener noreferrer">{item.text}</a>
   : <span key={index}>{item.text}</span>);
  const children = <Blocks blocks={block.children}/>;
  if (block.page) return <p key={block.id}><Link className="text-link" href={'/wiki?page=' + block.page}>{text} ↗</Link></p>;
  if (block.kind === 'heading_1') return <h2 key={block.id}>{text}</h2>;
  if (block.kind === 'heading_2') return <h3 key={block.id}>{text}</h3>;
  if (block.kind === 'heading_3') return <h4 key={block.id}>{text}</h4>;
  if (block.kind === 'toggle') return <details key={block.id}><summary>{text}</summary>{children}</details>;
  if (block.kind === 'quote') return <blockquote key={block.id}>{text}{children}</blockquote>;
  if (block.kind === 'code') return <pre key={block.id}><code>{text}</code></pre>;
  if (block.kind === 'divider') return <hr key={block.id}/>;
  if (block.kind.endsWith('_list_item')) return <div key={block.id}><p>{block.kind === 'bulleted_list_item' ? '• ' : '– '}{text}</p>{children}</div>;
  return <div key={block.id}>{text.length > 0 && <p className="preserve-lines">{text}</p>}{children}</div>;
 });
}

export function NotionWiki({ pageId }: { pageId?: string }) {
 const [page, setPage] = useState<WikiPage>();
 const [error, setError] = useState('');
 const [loginRequired, setLoginRequired] = useState(false);
 const [attempt, setAttempt] = useState(0);
 useEffect(() => {
  let alive = true;
  api<WikiPage>('wiki' + (pageId ? '?page=' + encodeURIComponent(pageId) : ''))
   .then(result => { if (alive) setPage(result); })
   .catch(failure => {
    if (!alive) return;
    setLoginRequired(failure instanceof SyncError && failure.status === 401);
    setError(failure instanceof Error ? failure.message : '위키를 불러오지 못했습니다.');
   });
  return () => { alive = false; };
 }, [pageId, attempt]);

 return (
  <>
   <h1>{page?.title ?? '개인 위키'}</h1>
   {error ? <><p role="alert">{error}</p>{loginRequired ? <Link className="button" href="/settings">설정에서 로그인</Link> : <button className="button" type="button" onClick={() => {
    setError('');
    setAttempt(value => value + 1);
   }}>다시 불러오기</button>}</> : !page ? <p role="status">Notion 페이지를 불러오는 중…</p> : <>
    <div className="form-actions">
     {page.parent && <Link className="button" href={'/wiki?page=' + page.parent}>상위 페이지</Link>}
     {page.url && <a className="text-link" href={page.url} target="_blank" rel="noopener noreferrer">Notion 원본 열기 ↗</a>}
    </div>
    {page.truncated && <p>일부 내용은 Notion 원본에서 볼 수 있습니다.</p>}
    <article className="resume-panel wiki-content"><Blocks blocks={page.blocks}/></article>
   </>}
  </>
 );
}
