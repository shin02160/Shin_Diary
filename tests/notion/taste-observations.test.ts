import assert from 'node:assert/strict';
import test from 'node:test';
import { attractionSentences, blockText, entryObservations, staleReviews, traitGroups } from '../../src/lib/taste-observations.ts';
import type { Entry } from '../../src/lib/types.ts';

const entry = (id: string, title: string, date: string, content: string, category: Entry['category'] = 'Daily'): Entry =>
 ({ id, title, category, content, tags: [], createdAt: date, occurredAt: { kind: 'date', date: date as `${number}-${number}-${number}` },
  notion: { pageId: id.padEnd(32, '0'), hash: '' } });

test('only sentences that state an attraction are quoted, word for word', () => {
 const text = '서촌을 걷다가 서도호전에 들렀다. 집과 공간을 옮긴 듯한 작품이 인상적이었다.\n박노수미술관 전망도 좋았다! 음식은 별로였다. 자리는 좋지 않았다.\n하람이가 보여준 영상으로 원우를 처음 알게 되었다.';
 assert.deepEqual(attractionSentences(text), [
  { quote: '집과 공간을 옮긴 듯한 작품이 인상적이었다.', cue: '인상적' },
  { quote: '박노수미술관 전망도 좋았다!', cue: '좋았' },
 ]);
 assert.deepEqual(attractionSentences('빌딩 사이 구름이 예뻐 사진을 남겼다').map(row => row.cue), ['예뻐']);
 assert.deepEqual(attractionSentences('전시회와 스탬프 랠리도 즐거웠다. 전시회와 스탬프 랠리도 즐거웠다.').length, 1);
});

test('observations keep month precision, prefer the body and keep a stable id', () => {
 const daily = entry('a', '퇴근길, 빌딩 사이에 걸린 구름', '2026-11-12', '구름이 예뻐 사진을 남겼다.');
 const [fromSummary] = entryObservations(daily);
 assert.deepEqual([fromSummary.day, fromSummary.precision, fromSummary.quote], ['2026-11-12', 'day', '구름이 예뻐 사진을 남겼다.']);
 const fromBody = entryObservations(daily, '빌딩 사이에 걸린 구름이 예뻐 사진을 남겼다.\n집에 와서 쉬었다.');
 assert.deepEqual(fromBody.map(row => row.quote), ['빌딩 사이에 걸린 구름이 예뻐 사진을 남겼다.']);
 assert.equal(entryObservations(daily, '구름이 예뻐 사진을 남겼다.')[0].id, fromSummary.id);
 // A body without such a sentence falls back to the summary rather than dropping the record.
 assert.equal(entryObservations(daily, '집에 와서 쉬었다.')[0].id, fromSummary.id);
 const review = entryObservations(entry('b', '2026년 10월 통합 회고', '2026-10-31', '친구들과의 만남이 즐거웠다.'))[0];
 assert.deepEqual([review.day, review.precision], ['2026-10-01', 'month']);
 assert.deepEqual(entryObservations(entry('gpt-monthly-review-2026-10', 'GPT 회고', '2026-10-01', '즐거웠다고 한다.')), []);
 assert.deepEqual(entryObservations({ ...daily, notion: undefined }), []);
});

test('traits group confirmed sentences across areas and flag decisions whose sentence is gone', () => {
 const art = entryObservations(entry('c', '서도호전', '2026-09-05', '공간을 옮긴 듯한 작품이 인상적이었다.'))[0];
 const sky = entryObservations(entry('d', '퇴근길 구름', '2026-11-12', '구름이 예뻐 사진을 남겼다.'))[0];
 const show = entryObservations(entry('e', '공연', '2026-10-31', '무대가 멋있었다.', 'Concert'))[0];
 const review = (traits: string[], status?: 'confirmed' | 'rejected') => ({ traits, status, quote: '', title: '', day: '' });
 const reviews = { [art.id]: review(['공간성']), [show.id]: review(['공간성', '현장감'], 'confirmed'), [sky.id]: review(['색감'], 'rejected'), gone: review(['분위기']), empty: review([]) };
 assert.deepEqual(traitGroups([art, sky, show], reviews).map(group => [group.trait, group.rows.length, group.categories]),
  [['공간성', 2, ['Daily', 'Concert']], ['현장감', 1, ['Concert']]]);
 assert.deepEqual(staleReviews([art, sky, show], reviews).map(row => row.id), ['gone']);
});

test('body text keeps prose in order and leaves out code and tables', () => {
 const block = (id: string, kind: string, text: string, children: ReturnType<typeof Object>[] = []) => ({ id, kind, text: [{ text }], children });
 assert.equal(blockText([block('1', 'heading_2', 'Day 1'), block('2', 'paragraph', '좋았다.', [block('3', 'bulleted_list_item', '하나')]),
  block('4', 'code', 'x = 1'), block('5', 'table', '', [block('6', 'table_row', '칸')])] as never), 'Day 1\n좋았다.\n하나');
});
