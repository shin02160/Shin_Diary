import test from 'node:test';
import assert from 'node:assert/strict';
import { wikiDirectory } from '../../src/lib/wiki-directory.ts';
import type { WikiBlock } from '../../src/lib/wiki.ts';

function block(id: string, kind: string, text: string, children: WikiBlock[] = []): WikiBlock {
 return { id, kind, text: [{ text }], children, page: kind === 'child_page' ? id : undefined };
}

test('wiki directory counts real child pages once and groups by explicit labels', () => {
 const result = wikiDirectory([
  block('a', 'child_page', '안내 문서'),
  block('b', 'heading_2', '여행'),
  block('c', 'toggle', '준비', [block('d', 'child_page', '준비 문서')]),
  block('e', 'heading_3', '교통'),
  block('f', 'child_page', '[공연] 티켓 안내'),
  block('g', 'heading_2', '참고'),
  block('h', 'child_page', '공연을 본 이야기'),
  block('d', 'child_page', '중복 링크'),
  block('i', 'paragraph', '일상'),
 ]);
 assert.deepEqual(result.groups, [
  { key: 'travel', label: '여행', count: 1 },
  { key: 'concert', label: '공연', count: 1 },
  { key: 'uncategorized', label: '미분류', count: 2 },
 ]);
 assert.deepEqual(result.all.map(document => document.id), ['a', 'd', 'f', 'h']);
 assert.deepEqual(wikiDirectory([]), { all: [], groups: [] });
});

test('wiki directory separates system docs and media analyses without guessing unrelated titles', () => {
 const result = wikiDirectory([
  block('a', 'child_page', 'Shin_Diary · 설정 가이드'),
  block('b', 'child_page', '2026 YouTube · YouTube Music 아카이브 분석'),
  block('c', 'child_page', '제목만 있는 문서'),
 ]);
 assert.deepEqual(result.all.map(document => document.category), ['system', 'collection', 'uncategorized']);
});
