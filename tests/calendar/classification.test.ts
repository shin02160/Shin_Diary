import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarType, confirmedLesson } from '../../src/lib/calendar/classification.ts';

test('calendar category uses title, source, then description and keeps conflicting clues unclassified', () => {
 assert.equal(calendarType({ title: '공연 관람', sourceName: '여행' }), 'concert');
 assert.equal(calendarType({ title: '도쿄', sourceName: '여행' }), 'travel');
 assert.equal(calendarType({ title: '저녁', sourceName: '친구' }), 'appointment');
 assert.equal(calendarType({ title: '블록', description: '업무 마감' }), 'work');
 assert.equal(calendarType({ title: '기타 일정' }), 'other');
 assert.equal(calendarType({ title: '공연과 여행', sourceName: '운동' }), 'unknown');
 assert.equal(calendarType({ title: '메모' }), 'unknown');
});

test('only the verified non-cancelled Pilates days are marked complete, never before their dates', () => {
 const lesson = { title: '필라테스', wallStart: '2026-10-07T12:00', status: 'unknown' };
 assert.equal(confirmedLesson(lesson, '2026-11-12'), true);
 assert.equal(confirmedLesson(lesson, '2026-10-06'), false);
 assert.equal(confirmedLesson({ ...lesson, status: 'cancelled' }, '2026-11-12'), false);
 assert.equal(confirmedLesson({ ...lesson, wallStart: '2026-10-08T12:00' }, '2026-11-12'), false);
});
