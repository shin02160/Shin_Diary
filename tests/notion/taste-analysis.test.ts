import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisBatch, analysisPrompt, readSuggestions, validAnalysisRequest, type AnalysisSentence } from '../../src/lib/taste-analysis.ts';

const sentence = (id: string, record: string, quote: string, area = '일상'): AnalysisSentence =>
 ({ id, record, date: '2026-09-05', area, title: '기록 ' + record, quote });
const sentences = [
 sentence('a', 'art', '집과 공간을 옮긴 듯한 작품이 인상적이었다.'),
 sentence('b', 'art', '박노수미술관 전망도 좋았다.'),
 sentence('c', 'sky', '빌딩 사이 구름이 예뻐 사진을 남겼다.'),
 sentence('d', 'show', '무대 구성이 멋있었다.', '공연'),
];

test('a batch takes sentences record by record and a request carries only the agreed fields', () => {
 const rows = ['r1', 'r1', 'r1', 'r2', 'r3'].map((pageId, index) => ({ pageId, index }));
 assert.deepEqual(analysisBatch(rows, 4).map(row => row.index), [0, 3, 4, 1]);
 assert.equal(validAnalysisRequest({ sentences, vocabulary: ['공간성'] }), true);
 assert.equal(validAnalysisRequest({ sentences: [{ ...sentences[0], content: '일기 전문' }], vocabulary: [] }), false);
 assert.equal(validAnalysisRequest({ sentences: [sentences[0], sentences[0]], vocabulary: [] }), false);
 assert.equal(validAnalysisRequest({ sentences: [], vocabulary: [] }), false);
 assert.equal(validAnalysisRequest({ sentences: Array.from({ length: 81 }, (_, index) => sentence('s' + index, 'r', '좋았다 정말로.')), vocabulary: [] }), false);
 const prompt = JSON.parse(analysisPrompt(sentences, ['공간성']));
 assert.deepEqual(Object.keys(prompt.sentences[0]), ['n', 'record', 'date', 'area', 'title', 'quote']);
 assert.equal(prompt.sentences[3].n, 4);
});

test('suggestions are kept only when they point at sent sentences and connections span records', () => {
 const answer = '```json\n' + JSON.stringify({
  traits: [
   { n: 1, traits: ['공간성', '공간성', 'x', '아주아주아주 긴 이름의 특성이라 안 됨'], reason: '집과 공간을 옮긴 듯한 작품' },
   { n: 2, traits: ['공간성'] }, { n: 3, traits: ['색감', '공간성'] }, { n: 4, traits: [] },
   { n: 9, traits: ['없는 문장'] }, { n: 1, traits: ['덮어쓰기'] }, { n: '2', traits: ['문자 번호'] },
  ],
  connections: [
   { trait: '공간성', items: [1, 2, 3, 9], explanation: '공간을 다룬 장면에 끌리는 것일 수 있어요.' },
   { trait: '공간성', items: [1, 3], explanation: '같은 특성의 두 번째 가설' },
   { trait: '색감', items: [3], explanation: '기록 하나뿐' },
   { trait: '공간성', items: [1, 2], explanation: '' },
   { trait: '현장감', items: [1, 4], explanation: '제안되지 않은 특성' },
  ],
 }) + '\n```';
 assert.deepEqual(readSuggestions(answer, sentences), {
  traits: { a: { traits: ['공간성'], reason: '집과 공간을 옮긴 듯한 작품' }, b: { traits: ['공간성'] }, c: { traits: ['색감', '공간성'] } },
  connections: [{ trait: '공간성', ids: ['a', 'b', 'c'], explanation: '공간을 다룬 장면에 끌리는 것일 수 있어요.' }],
 });
 // One record on its own is not a connection.
 assert.deepEqual(readSuggestions(JSON.stringify({ traits: [{ n: 1, traits: ['공간성'] }, { n: 2, traits: ['공간성'] }],
  connections: [{ trait: '공간성', items: [1, 2], explanation: '같은 기록' }] }), sentences).connections, []);
 assert.deepEqual(readSuggestions('죄송하지만 답할 수 없어요.', sentences), { traits: {}, connections: [] });
});
