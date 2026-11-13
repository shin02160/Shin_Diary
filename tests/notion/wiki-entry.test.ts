import assert from 'node:assert/strict';
import test from 'node:test';
import { readWikiEntry } from '../../src/lib/server/notion-wiki-entry.ts';
import type { Transport } from '../../src/lib/server/notion-client.ts';

const source = 'a'.repeat(32);
const page = 'b'.repeat(32);
const nested = 'c'.repeat(32);
const foreign = 'd'.repeat(32);
const item = (id: string, type: string, value: object, children = false) =>
 ({ id, type, [type]: value, has_children: children });
const allowedPage = { object: 'page', id: page, parent: { type: 'data_source_id', data_source_id: source } };

function transport(handler: (path: string) => unknown): Transport {
 return { async call<T>(path: string, method = 'GET') {
  assert.equal(method, 'GET');
  return handler(path) as T;
 } };
}

test('entry reader validates UUID and source before reading any blocks', async () => {
 for (const overrides of [{ archived: true }, { in_trash: true }, { parent: { type: 'data_source_id', data_source_id: foreign } }]) {
  const api = transport(path => {
   assert.equal(path, '/pages/' + page);
   return { ...allowedPage, ...overrides };
  });
  await assert.rejects(readWikiEntry(api, source, page), { status: 404 });
 }
 await assert.rejects(readWikiEntry(transport(assert.fail), source, '../invalid'), { status: 400 });
});

test('entry reader preserves nested order and annotations, and excludes unsafe links and page boundaries', async () => {
 const api = transport(path => {
  if (path === '/pages/' + page) return allowedPage;
  if (path.includes(nested)) return { results: [item('1'.repeat(32), 'paragraph', {
   rich_text: [{ plain_text: 'line 1\nline 2', href: 'javascript:alert(1)', annotations: { bold: true } }],
  })], has_more: false };
  assert.ok(path.includes(page));
  if (path.includes('start_cursor=next')) return { results: [item('2'.repeat(32), 'image', {
   external: { url: 'https://example.com/photo.png' }, caption: [{ plain_text: 'Caption' }],
  })], has_more: false };
  assert.ok(!path.includes(foreign));
  return { results: [item(nested, 'numbered_list_item', {}, true),
   item(foreign, 'child_page', { title: 'restricted' }, true)], has_more: true, next_cursor: 'next' };
 });
 const result = await readWikiEntry(api, source, page);
 assert.equal(result.truncated, true);
 assert.deepEqual(result.blocks.map(block => block.kind), ['numbered_list_item', 'image']);
 const text = result.blocks[0].children[0].text[0];
 assert.equal(text.text, 'line 1\nline 2');
 assert.equal(text.bold, true);
 assert.equal(text.url, undefined);
 assert.equal(result.blocks[1].caption?.[0].text, 'Caption');
});

test('entry reader signals partial data and distinguishes empty and failed bodies', async () => {
 for (const next of [false, true]) {
  const api = transport(path => {
   if (path === '/pages/' + page) return allowedPage;
   if (path.includes('start_cursor=')) throw new Error('upstream unavailable');
   return { results: [], has_more: next, next_cursor: next ? 'next' : undefined };
  });
  assert.deepEqual(await readWikiEntry(api, source, page), { blocks: [], truncated: next, updatedAt: undefined });
 }
 await assert.rejects(readWikiEntry(transport(path => {
  if (path === '/pages/' + page) return allowedPage;
  throw new Error('upstream unavailable');
 }), source, page), /upstream unavailable/);
});
