import { createHash } from 'node:crypto';
import { calendarContent } from '../calendar/event-utils.ts';
import type { ImportedEvent, SavedEvent } from '../calendar/types.ts';
import type { ExperienceDate, LocalDate } from '../types.ts';
import { AppError, type Config } from './config.ts';
import type { Journal } from './journal.ts';
import { NotionError, type Transport } from './notion-client.ts';
import { readText, type NotionPage } from './notion-mapping.ts';

const schema = {
  Name: 'title', 'Import Key': 'rich_text', Source: 'select',
  'Source Calendar ID': 'rich_text', 'Source Calendar Name': 'rich_text',
  UID: 'rich_text', 'Original Instance ID': 'rich_text', Start: 'date', End: 'date',
  'Wall Start': 'rich_text', 'Wall End': 'rich_text', 'Original Time Zone': 'rich_text',
  'All Day': 'checkbox', 'End Exclusive': 'checkbox', Location: 'rich_text',
  Description: 'rich_text', Status: 'select', 'Imported At': 'date', 'Batch ID': 'rich_text',
} as const;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const uuid = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
const compact = (id: string) => id.replaceAll('-', '').toLowerCase();

export function calendarSource(config: Config) {
  const id = process.env.NOTION_CALENDAR_DATA_SOURCE_ID?.trim() || '';
  if (!uuid.test(id) || [config.activitiesId, config.entriesId].some(other => compact(other) === compact(id))) {
    throw new AppError(503, '별도의 Calendar Events 데이터 소스 ID를 설정해 주세요.');
  }
  return compact(id);
}

function invalid(): never {
  throw new AppError(400, '일정 데이터의 날짜 또는 필드를 확인해 주세요.');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function field(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) return invalid();
  return value;
}

function date(value: unknown): LocalDate {
  const text = field(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text))
    || new Date(text).toISOString().slice(0, 10) !== text) return invalid();
  return text as LocalDate;
}

function wall(value: unknown, allDay: boolean) {
  if (allDay) return date(value);
  const text = field(value, 19);
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(text)) return invalid();
  date(text.slice(0, 10));
  return text;
}

function instant(value: unknown) {
  const text = field(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)
    || !Number.isFinite(Date.parse(text))) return invalid();
  return new Date(text).toISOString();
}

function readTime(value: unknown, wallTime: string, zone: string, allDay: boolean): ExperienceDate {
  const input = record(value);
  if (allDay && input.kind === 'date') return { kind: 'date', date: date(input.date) };
  if (!allDay && !zone && input.kind === 'floating' && input.local === wallTime) {
    return { kind: 'floating', local: wallTime };
  }
  if (!allDay && zone && input.kind === 'zoned') {
    const timezone = field(input.timezone, 128, true);
    try { new Intl.DateTimeFormat('ko', { timeZone: timezone }); } catch { return invalid(); }
    return { kind: 'zoned', instant: instant(input.instant), timezone };
  }
  return invalid();
}

function dateValue(value: ExperienceDate) {
  if (value.kind === 'date') return value.date;
  if (value.kind === 'floating') return value.local + 'Z';
  return value.instant;
}

export function normalizeCalendarEvent(value: unknown): ImportedEvent {
  const input = record(value);
  const sourceCalendarId = field(input.sourceCalendarId, 80, true);
  const sourceName = field(input.sourceName, 80, true);
  const uid = field(input.uid, 1024, true);
  const originalInstanceId = field(input.originalInstanceId ?? '', 128) || undefined;
  const originalTimezone = field(input.originalTimezone ?? '', 128) || undefined;
  const allDay = record(input.start).kind === 'date';
  const wallStart = wall(input.wallStart, allDay);
  const wallEnd = wall(input.wallEnd, allDay);
  const start = readTime(input.start, wallStart, originalTimezone ?? '', allDay);
  const end = readTime(input.end, wallEnd, originalTimezone ?? '', allDay);
  const status = input.status;
  if (status !== 'confirmed' && status !== 'tentative' && status !== 'cancelled' && status !== 'unknown') return invalid();
  if (input.source !== 'NAVER_ICS' || input.isSample !== false || input.endExclusive !== true) return invalid();
  if (start.kind === 'date' && (start.date !== wallStart || end.kind !== 'date' || end.date !== wallEnd || wallStart >= wallEnd)) return invalid();
  if (start.kind === 'floating' && wallStart > wallEnd) return invalid();
  if (start.kind === 'zoned' && end.kind === 'zoned' && start.instant > end.instant) return invalid();
  return {
    id: JSON.stringify([sourceCalendarId, uid, originalInstanceId ?? '']),
    source: 'NAVER_ICS', sourceCalendarId, sourceName, uid, originalInstanceId,
    title: field(input.title, 500, true), start, end, wallStart, wallEnd, originalTimezone,
    description: field(input.description, 20000), location: field(input.location ?? '', 2000) || undefined,
    status, importedAt: instant(input.importedAt), endExclusive: true, isSample: false,
  };
}

const rich = (value = '') => ({
  rich_text: (value.match(/[\s\S]{1,900}/gu) ?? []).map(content => ({ type: 'text', text: { content } })),
});

function properties(event: ImportedEvent, batch: string) {
  return {
    Name: { title: [{ type: 'text', text: { content: event.title } }] },
    'Import Key': rich(hash(event.id)), Source: { select: { name: event.source } },
    'Source Calendar ID': rich(event.sourceCalendarId), 'Source Calendar Name': rich(event.sourceName),
    UID: rich(event.uid), 'Original Instance ID': rich(event.originalInstanceId),
    Start: { date: { start: dateValue(event.start) } }, End: { date: { start: dateValue(event.end!) } },
    'Wall Start': rich(event.wallStart), 'Wall End': rich(event.wallEnd), 'Original Time Zone': rich(event.originalTimezone),
    'All Day': { checkbox: event.start.kind === 'date' }, 'End Exclusive': { checkbox: true },
    Location: rich(event.location), Description: rich(event.description), Status: { select: { name: event.status } },
    'Imported At': { date: { start: event.importedAt } }, 'Batch ID': rich(batch),
  };
}

function fromPage(page: NotionPage): SavedEvent {
  const p = page.properties;
  const text = (name: string) => readText(p[name]);
  const wallStart = text('Wall Start');
  const wallEnd = text('Wall End');
  const zone = text('Original Time Zone');
  const time = (name: string, local: string) => {
    const start = p[name]?.date?.start;
    if (p['All Day']?.checkbox) return { kind: 'date', date: start };
    if (!zone) return { kind: 'floating', local };
    let timezone = zone;
    try { new Intl.DateTimeFormat('ko', { timeZone: zone }); } catch { timezone = 'UTC'; }
    return { kind: 'zoned', instant: start, timezone };
  };
  try {
    const event = normalizeCalendarEvent({
      source: p.Source?.select?.name, sourceCalendarId: text('Source Calendar ID'),
      sourceName: text('Source Calendar Name'), uid: text('UID'), originalInstanceId: text('Original Instance ID'),
      title: text('Name'), start: time('Start', wallStart), end: time('End', wallEnd),
      wallStart, wallEnd, originalTimezone: zone, description: text('Description'), location: text('Location'),
      status: p.Status?.select?.name, importedAt: p['Imported At']?.date?.start,
      endExclusive: p['End Exclusive']?.checkbox, isSample: false,
    });
    if (hash(event.id) !== text('Import Key')) return invalid();
    return { event, revision: hash(JSON.stringify(event)) };
  } catch {
    throw new AppError(422, 'Notion 일정의 필드 또는 가져오기 식별자가 올바르지 않습니다.');
  }
}

export class CalendarRepository {
  private checkedUntil = 0;

  constructor(private source: string, private client: Transport, private journal: Journal) {}

  private async checkSchema() {
    if (Date.now() < this.checkedUntil) return;
    const source = await this.client.call<{ properties: Record<string, { type: string }> }>('/data_sources/' + this.source);
    const missing = Object.entries(schema).filter(([name, type]) => source.properties?.[name]?.type !== type);
    if (missing.length) throw new AppError(422, 'Calendar Events 속성을 확인해 주세요. ' + missing.map(([name]) => name).join(', '));
    this.checkedUntil = Date.now() + 60_000;
  }

  private async query(key?: string) {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const response: { results: NotionPage[]; has_more: boolean; next_cursor?: string } = await this.client.call(
        '/data_sources/' + this.source + '/query', 'POST', {
          page_size: key ? 2 : 100,
          filter: { property: 'Import Key', rich_text: key ? { equals: key } : { is_not_empty: true } },
          ...(cursor ? { start_cursor: cursor } : {}),
        },
      );
      if (!Array.isArray(response.results) || (response.has_more && (!response.next_cursor || response.next_cursor === cursor))) {
        throw new AppError(502, 'Notion 일정 목록을 확인할 수 없습니다.');
      }
      pages.push(...response.results.filter(page => page.object === 'page' && !page.in_trash && !page.archived));
      if (key && (pages.length > 1 || response.has_more)) throw new AppError(409, 'Notion에 같은 일정 식별자가 여러 개 있습니다.');
      if (pages.length > 5000 || (pages.length === 5000 && response.has_more)) throw new AppError(413, '한 번에 읽을 수 있는 Notion 일정은 최대 5,000개입니다.');
      cursor = response.has_more ? response.next_cursor : undefined;
      if (cursor) {
        if (seen.has(cursor) || seen.size >= 50) throw new AppError(502, 'Notion 일정 목록의 페이지 범위를 확인해 주세요.');
        seen.add(cursor);
      }
    } while (cursor);
    return pages;
  }

  async read() {
    await this.checkSchema();
    const events = (await this.query()).map(fromPage);
    if (new Set(events.map(item => item.event.id)).size !== events.length) {
      throw new AppError(409, 'Notion에 같은 일정 식별자가 여러 개 있습니다.');
    }
    return events;
  }

  async save(value: unknown, expected: unknown, batch: unknown): Promise<SavedEvent> {
    const event = normalizeCalendarEvent(value);
    if (expected !== null && (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected))) return invalid();
    if (typeof batch !== 'string' || !uuid.test(batch)) return invalid();
    const importKey = hash(event.id);
    const journalKey = 'calendar:' + this.source + ':' + importKey;

    return this.journal.locked(journalKey, async () => {
      await this.checkSchema();
      const [page] = await this.query(importKey);
      if (page) {
        const current = fromPage(page);
        this.journal.known(journalKey, page.id);
        if (calendarContent(current.event) === calendarContent(event)) return current;
        if (current.revision !== expected) throw new AppError(409, 'Notion 일정이 바뀌었습니다. 다시 비교해 주세요.');
        const updated = await this.client.call<NotionPage>('/pages/' + page.id, 'PATCH', {
          properties: properties({ ...event, importedAt: new Date().toISOString() }, batch),
        });
        return fromPage(updated);
      }
      if (expected !== null || this.journal.creation(journalKey)) {
        throw new AppError(409, '이전 저장 결과 또는 삭제된 일정을 확인해 주세요. 중복 생성 방지를 위해 다시 만들 수 없습니다.');
      }
      this.journal.reserve(journalKey);
      let created: NotionPage;
      try {
        created = await this.client.call('/pages', 'POST', {
          parent: { type: 'data_source_id', data_source_id: this.source },
          properties: properties({ ...event, importedAt: new Date().toISOString() }, batch),
        });
      } catch (error) {
        if (error instanceof NotionError && ((error.upstreamStatus >= 400 && error.upstreamStatus < 500) || error.upstreamStatus === 529)) {
          this.journal.rejected(journalKey);
        }
        throw error;
      }
      if (!created.id) throw new AppError(502, 'Notion 일정 저장 결과를 확인할 수 없습니다.');
      this.journal.known(journalKey, created.id);
      return fromPage(created);
    });
  }
}
