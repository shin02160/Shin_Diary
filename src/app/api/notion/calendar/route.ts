import { authorize, errorResponse, json, readJson } from '@/lib/server/auth';
import { CalendarRepository, calendarSource } from '@/lib/server/calendar-repository';
import { getConfig } from '@/lib/server/config';
import { service } from '@/lib/server/service';

export const runtime = 'nodejs';

let cached: { key: string; repository: CalendarRepository } | undefined;

function repository(request: Request) {
  const config = getConfig();
  authorize(request, config);
  const source = calendarSource(config);
  const { client, journal, key } = service();
  const cacheKey = key + ':' + source;
  if (cached?.key !== cacheKey) {
    cached = { key: cacheKey, repository: new CalendarRepository(source, client, journal) };
  }
  return cached.repository;
}

export async function GET(request: Request) {
  try {
    return json(await repository(request).read());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const target = repository(request);
    const body = await readJson(request) as { event?: unknown; expected?: unknown; batch?: unknown } | null;
    return json(await target.save(body?.event, body?.expected, body?.batch));
  } catch (error) {
    return errorResponse(error);
  }
}
