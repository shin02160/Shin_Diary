import test from 'node:test';
import assert from 'node:assert/strict';
import { CalendarRepository } from '../../src/lib/server/calendar-repository.ts';
import { Journal } from '../../src/lib/server/journal.ts';
import { AppError } from '../../src/lib/server/config.ts';
import type { Transport } from '../../src/lib/server/notion-client.ts';
import { parseIcs } from '../../src/lib/calendar/ics-parser.mjs';

const batch = '11111111-1111-4111-8111-111111111111';
const event = parseIcs(
  'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:fixture\nDTSTART;VALUE=DATE:20261103\nDTEND;VALUE=DATE:20261105\nSUMMARY:Fixture\nEND:VEVENT\nEND:VCALENDAR',
  { from: '2026-11-01', to: '2026-11-30', sourceName: '개인', sourceCalendarId: '개인' },
).events[0];

const schema = {
  Name:'title', 'Import Key':'rich_text', Source:'select', 'Source Calendar ID':'rich_text',
  'Source Calendar Name':'rich_text', UID:'rich_text', 'Original Instance ID':'rich_text', Start:'date', End:'date',
  'Wall Start':'rich_text', 'Wall End':'rich_text', 'Original Time Zone':'rich_text', 'All Day':'checkbox',
  'End Exclusive':'checkbox', Location:'rich_text', Description:'rich_text', Status:'select', 'Imported At':'date', 'Batch ID':'rich_text',
};

function fixture(t: { after: (action: () => void) => void }) {
  const journal = new Journal(':memory:');
  t.after(() => journal.close());
  let page: { id: string; object: string; properties: unknown } | undefined;
  let writes = 0;
  let loseResponse = false;
  const client: Transport = {
    async call<T>(path: string, method?: string, body?: unknown): Promise<T> {
      if (path.endsWith('/query')) return { results: page ? [page] : [], has_more: false } as T;
      if (path.startsWith('/data_sources/')) {
        return { properties: Object.fromEntries(Object.entries(schema).map(([name, type]) => [name, { type }])) } as T;
      }
      const input = body as { properties: unknown };
      assert(method === 'POST' || method === 'PATCH');
      page = { id:'test-page', object:'page', properties:input.properties };
      writes++;
      if (loseResponse) throw new AppError(502, 'lost response');
      return page as T;
    },
  };
  return { repo:new CalendarRepository('calendar-source',client,journal), writes:()=>writes, lose:()=>{loseResponse=true;} };
}

test('calendar saves exclusive all-day dates and repeats without duplicate writes', async t => {
  const { repo, writes } = fixture(t);
  const first = await repo.save(event, null, batch);
  const retry = await repo.save(event, null, batch);
  assert.deepEqual(first, retry);
  assert.deepEqual(first.event.end, { kind:'date', date:'2026-11-05' });
  assert.deepEqual(await repo.read(), [first]);
  assert.equal(writes(), 1);
});

test('calendar updates require the reviewed revision', async t => {
  const { repo, writes } = fixture(t);
  const first = await repo.save(event, null, batch);
  const updated = await repo.save({ ...event, title:'Updated' }, first.revision, batch);
  assert.notEqual(updated.revision,first.revision);
  await assert.rejects(repo.save({ ...event, title:'Stale' }, first.revision, batch), { status:409 });
  assert.equal(writes(), 2);
});

test('calendar recovers a committed create after a lost response', async t => {
  const { repo, writes, lose } = fixture(t);
  lose();
  await assert.rejects(repo.save(event, null, batch), { status:502 });
  const recovered = await repo.save(event, null, batch);
  assert.equal(recovered.event.id,event.id);
  assert.equal(writes(),1);
});

test('calendar rejects malformed dates before any write', async t => {
  const { repo, writes } = fixture(t);
  await assert.rejects(repo.save({ ...event, wallEnd:'2026-02-30' }, null, batch), { status:400 });
  assert.equal(writes(),0);
});
