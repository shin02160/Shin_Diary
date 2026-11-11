import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, COOKIE, issueSession } from '../../src/lib/server/auth.ts';
import { readWiki } from '../../src/lib/server/notion-wiki.ts';
import { config } from './fixtures.ts';

test('passwordless wiki mode permits local reads and rejects writes and cross-site requests', () => {
 const settings = { ...config, readOnly: true, password: '', secret: '' };
 const url = config.origin + '/api/notion/wiki';
 assert.doesNotThrow(() => authorize(new Request(url), settings));
 assert.throws(() => authorize(new Request(url, { method: 'POST' }), settings), { status: 405 });
 assert.throws(() => authorize(new Request(url, { headers: { 'Sec-Fetch-Site': 'cross-site' } }), settings), { status: 403 });
 assert.throws(() => authorize(new Request(url, { headers: { 'X-Forwarded-For': '192.0.2.5' } }), settings), { status: 403 });
});

test('wiki allows only the configured root and its descendants and omits unsafe links', async () => {
 const root = '1'.repeat(32), child = '2'.repeat(32), outside = '3'.repeat(32), block = '4'.repeat(32);
 const calls: string[] = [];
 const api = { async call<T>(path: string): Promise<T> {
  calls.push(path);
  const id = path.split('/')[2];
  if (path.startsWith('/pages/')) return {
   id, object: 'page', parent: id === child ? { type: 'page_id', page_id: root } : { type: 'workspace' },
   properties: { title: { type: 'title', title: [{ plain_text: '제목' }] } },
  } as T;
  return { has_more: false, results: [{ id: block, type: 'paragraph', has_children: false,
   paragraph: { rich_text: [{ plain_text: '내용', href: 'javascript:alert(1)' }] } }] } as T;
 } };
 const result = await readWiki(api, root, child);
 assert.equal(result.parent, root);
 assert.deepEqual(result.blocks[0].text, [{ text: '내용', url: undefined }]);
 await assert.rejects(readWiki(api, root, outside), { status: 404 });
 assert.ok(!calls.some(path => path.startsWith('/blocks/' + outside)));
});

test('shared read-only wiki requires a session and blocks authenticated writes', () => {
 const settings = { ...config, origin: 'https://diary.example.org', readOnly: true, readOnlyRequiresLogin: true };
 const url = settings.origin + '/api/notion/wiki';
 assert.throws(() => authorize(new Request(url), settings), { status: 401 });
 const headers = { Cookie: COOKIE + '=' + issueSession(settings) };
 assert.doesNotThrow(() => authorize(new Request(url, { headers }), settings));
 assert.throws(() => authorize(new Request(url, { method: 'POST', headers }), settings), { status: 405 });
});
