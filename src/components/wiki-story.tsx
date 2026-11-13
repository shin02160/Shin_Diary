'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { api, SyncError } from '@/lib/notion-sync';
import { recordsAddedAfter } from '@/lib/wiki-review';
import type { WikiBlock, WikiEntryBody, WikiText } from '@/lib/wiki';

function RichText({ items }: { items: WikiText[] }) {
 return items.map((item, index) => {
  let text: ReactNode = item.text;
  if (item.code) text = <code>{text}</code>;
  if (item.bold) text = <strong>{text}</strong>;
  if (item.italic) text = <em>{text}</em>;
  if (item.strikethrough) text = <s>{text}</s>;
  if (item.underline) text = <u>{text}</u>;
  return <span key={index}>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{text}</a> : text}</span>;
 });
}

const listKinds = ['bulleted_list_item', 'numbered_list_item'];

function StoryBlocks({ blocks }: { blocks: WikiBlock[] }) {
 const items: ReactNode[] = [];
 for (let index = 0; index < blocks.length; index++) {
  const block = blocks[index];
  if (!listKinds.includes(block.kind)) {
   items.push(<StoryBlock key={block.id} block={block}/>);
   continue;
  }
  const List = block.kind === 'numbered_list_item' ? 'ol' : 'ul';
  const group = [block];
  while (blocks[index + 1]?.kind === block.kind) group.push(blocks[++index]);
  items.push(<List key={block.id}>{group.map(item => <li key={item.id}>
   <RichText items={item.text}/><StoryBlocks blocks={item.children}/>
  </li>)}</List>);
 }
 return items;
}

function StoryBlock({ block }: { block: WikiBlock }) {
 const text = <RichText items={block.text}/>;
 const children = <StoryBlocks blocks={block.children}/>;
 switch (block.kind) {
  case 'heading_1': case 'heading_2': case 'heading_3': {
   const Heading = block.kind === 'heading_1' ? 'h2' : block.kind === 'heading_2' ? 'h3' : 'h4';
   return <><Heading id={'section-' + block.id}>{text}</Heading>{children}</>;
  }
  case 'divider': return <hr/>;
  case 'quote': return <blockquote>{text}{children}</blockquote>;
  case 'callout': return <div className="wiki-story-callout">{text}{children}</div>;
  case 'code': return <pre><code>{block.text.map(item => item.text).join('')}</code></pre>;
  case 'to_do': return <div><input type="checkbox" checked={block.checked ?? false} disabled aria-label={block.text.map(item => item.text).join('') || '할 일'}/> {text}{children}</div>;
  case 'toggle': return <details><summary>{text}</summary>{children}</details>;
  case 'table': return <div className="wiki-story-table"><table><tbody>{block.children.map((row, index) => <tr key={row.id}>
   {(row.cells ?? []).map((cell, column) => (block.columnHeader && index === 0) || (block.rowHeader && column === 0)
    ? <th key={column} scope={block.columnHeader && index === 0 ? 'col' : 'row'}><RichText items={cell}/></th>
    : <td key={column}><RichText items={cell}/></td>)}
  </tr>)}</tbody></table></div>;
  case 'image': return block.image ? <StoryImage key={block.image} block={block} src={block.image}/> : null;
  case 'column': case 'column_list': case 'synced_block': return children;
  default: return <>{block.text.some(item => item.text.trim()) && <p>{text}</p>}{children}</>;
 }
}

function StoryImage({ block, src }: { block: WikiBlock; src: string }) {
 const [failed, setFailed] = useState(false);
 const caption = block.caption ?? [];
 return <figure>
  {failed ? <p>사진을 불러오지 못했어요. Notion 원본에서 확인할 수 있어요.</p> :
   <Image src={src} alt={caption.map(item => item.text).join('') || '기록 사진'} width={760} height={480} unoptimized referrerPolicy="no-referrer" onError={() => setFailed(true)}/>}
  {caption.length > 0 && <figcaption><RichText items={caption}/></figcaption>}
 </figure>;
}

function storyHeadings(blocks: WikiBlock[]): WikiBlock[] {
 return blocks.flatMap(block => [
  ...(/^heading_[123]$/.test(block.kind) && block.text.some(item => item.text.trim()) ? [block] : []),
  ...(block.kind === 'toggle' ? [] : storyHeadings(block.children)),
 ]);
}

function notionPageLink(url?: string) {
 if (!url) return;
 const parsed = new URL(url);
 if (!['notion.so', 'www.notion.so'].includes(parsed.hostname)) return;
 return /(?:^|[-/])([a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i
  .exec(parsed.pathname)?.[1].replaceAll('-', '').toLowerCase();
}

function linkedPages(blocks: WikiBlock[]): string[] {
 return blocks.flatMap(block => [
  ...[...block.text, ...(block.caption ?? []), ...(block.cells ?? []).flat()].flatMap(item => {
   const id = item.page ?? notionPageLink(item.url);
   return id ? [id] : [];
  }),
  ...linkedPages(block.children),
 ]);
}

export function WikiStory({ pageId, summary, records, monthRecords = [] }: {
 pageId: string; summary: string; monthRecords?: { createdAt: string }[]; records: { pageId: string; href: string; title: string }[];
}) {
 const [body, setBody] = useState<WikiEntryBody>();
 const [error, setError] = useState('');
 const [attempt, setAttempt] = useState(0);
 useEffect(() => {
  let active = true;
  void api<WikiEntryBody>('wiki-entries/' + encodeURIComponent(pageId)).then(result => {
   if (active) setBody(result);
  }).catch((error: unknown) => {
   if (active) setError(error instanceof SyncError && error.retryAfter ?
    `Notion 요청이 잠시 제한됐어요. ${error.retryAfter}초 후 다시 시도해 주세요.` : 'Notion 본문을 불러오지 못했어요.');
  });
  return () => { active = false; };
 }, [pageId, attempt]);
 const retry = () => { setError(''); setBody(undefined); setAttempt(value => value + 1); };
 const blocks = body?.blocks ?? [];
 const omitted = Object.entries(body?.omitted ?? {});
 const headings = storyHeadings(blocks);
 const relatedIds = new Set(linkedPages(blocks));
 const related = records.filter(record => record.pageId !== pageId &&
  relatedIds.has(record.pageId.replaceAll('-', '').toLowerCase()));
 const newer = recordsAddedAfter(monthRecords, body?.updatedAt);
 const updated = body?.updatedAt ? new Date(body.updatedAt) : undefined;
 return <>
  {!body && !error && <p role="status">Notion 본문을 불러오는 중…</p>}
  {(error || body?.truncated) && <div className="wiki-story-callout" role={error ? 'alert' : 'status'}>
   {error ? <p>{error}</p> : <>
    {omitted.length > 0 && <p>앱에서 표시하지 못한 블록이 있어요: {omitted.map(([label, count]) => label + ' ' + count + '개').join(', ')}. 이 부분은 Notion 원본에서 확인할 수 있어요.</p>}
    {(body?.partial || !omitted.length) && <p>본문이 길거나 일부를 불러오지 못해 끝까지 표시하지 못했어요. 전체 내용은 Notion 원본에서 확인할 수 있어요.</p>}
   </>}
   <button className="button" type="button" onClick={retry}>본문 다시 불러오기</button>
  </div>}
  {headings.length > 1 && <nav className="wiki-story-callout" aria-label="본문 목차">
   <strong>목차</strong>
   <ol>{headings.map(heading => <li key={heading.id}><a href={'#section-' + heading.id}>{heading.text.map(item => item.text).join('')}</a></li>)}</ol>
  </nav>}
  {blocks.length > 0 ? <div className="wiki-story-body"><StoryBlocks blocks={blocks}/></div> :
   (error || body) && (summary.trim() ? <p className="preserve-lines">{summary}</p> : !error && !body?.truncated && <p>아직 본문이 없어요.</p>)}
  {newer > 0 && <p className="wiki-story-callout" role="status">
   회고가 마지막으로 수정된 뒤 이달의 기록 {newer}개가 추가됐어요. 반영할 내용은 아래 Notion 원본에서 검토할 수 있어요.
  </p>}
  {related.length > 0 && <section className="wiki-story-callout" aria-label="관련 기록">
   <h2>관련 기록</h2>
   <ul>{related.map(record => <li key={record.pageId}><Link href={record.href}>{record.title}</Link></li>)}</ul>
  </section>}
  {body?.activityLinksUnavailable && <p role="status">연결된 활동을 확인하지 못했어요.</p>}
  {Boolean(body?.activityIds?.length) && <section className="wiki-story-callout" aria-label="연결된 활동">
   <h2>연결된 활동</h2>
   <ul>{body?.activityIds?.map((id, index) => <li key={id}>
    <Link href={'/explore/linked-activity/' + id}>활동 기록 {index + 1}</Link>
   </li>)}</ul>
  </section>}
  {updated && Number.isFinite(updated.getTime()) && <p className="wiki-story-meta">
   최종 갱신 <time dateTime={body?.updatedAt}>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'Asia/Seoul' }).format(updated)}</time>
  </p>}
 </>;
}
