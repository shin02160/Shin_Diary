import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineRows } from '../../src/lib/activity-timeline.ts';
import { parseActivityDate, type ActivityView } from '../../src/lib/activity-view.ts';

const base = { sourceType: 'trips', sourcePageId: 'id', title: '기록', category: 'travel', status: 'planned', interestIds: [] } satisfies ActivityView;

test('timeline includes overlapping periods and uses the experience timezone at month boundaries', () => {
 const rows = timelineRows([
  { ...base, title: '기간 여행', startAt: parseActivityDate('2026-12-30'), endAt: parseActivityDate('2027-01-02') },
  { ...base, title: '시간대 기록', startAt: parseActivityDate('2026-12-31T16:00:00Z', 'Asia/Seoul') },
  { ...base, title: '날짜 미상', updatedAt: '2027-01-01' },
  { ...base, title: '범위 밖', startAt: parseActivityDate('2027-02-01') },
 ], '2027-01-01', '2027-01-31');
 assert.deepEqual(rows.dated.map(row => [row.item.title, row.month]), [['시간대 기록', '2027-01'], ['기간 여행', '2027-01']]);
 assert.deepEqual(rows.undated.map(row => row.title), ['날짜 미상']);
});
