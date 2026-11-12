import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, COOKIE, issueSession } from '../../src/lib/server/auth.ts';
import { NotionError } from '../../src/lib/server/notion-client.ts';
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

test('wiki distinguishes missing configuration, invalid IDs and upstream access errors', async () => {
 const root = '1'.repeat(32);
 function failingApi(upstreamStatus: number) {
  return { async call<T>(): Promise<T> { throw new NotionError(502, 'upstream detail', undefined, upstreamStatus); } };
 }
 await assert.rejects(readWiki(failingApi(404), ' '), { status: 503, message: /설정되지 않았습니다/ });
 await assert.rejects(readWiki(failingApi(404), 'bad-id'), { status: 503, message: /형식이 올바르지 않습니다/ });
 await assert.rejects(readWiki(failingApi(404), root, ''), { status: 400 });
 await assert.rejects(readWiki(failingApi(401), root), { status: 502, message: /인증에 실패했습니다/ });
 await assert.rejects(readWiki(failingApi(403), root), { status: 502, message: /읽기 권한/ });
 await assert.rejects(readWiki(failingApi(404), ' ' + root + ' '), { status: 503, message: /시작 페이지를 열 수 없습니다/ });
 await assert.rejects(readWiki(failingApi(404), root, '2'.repeat(32)), { status: 404, message: /이 위키 페이지를 열 수 없습니다/ });
});

test('shared read-only wiki requires a session and blocks authenticated writes', () => {
 const settings = { ...config, origin: 'https://diary.example.org', readOnly: true, readOnlyRequiresLogin: true };
 const url = settings.origin + '/api/notion/wiki';
 assert.throws(() => authorize(new Request(url), settings), { status: 401 });
 const headers = { Cookie: COOKIE + '=' + issueSession(settings) };
 assert.doesNotThrow(() => authorize(new Request(url, { headers }), settings));
 assert.throws(() => authorize(new Request(url, { method: 'POST', headers }), settings), { status: 405 });
});
