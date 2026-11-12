import { authorize, errorResponse, json } from '@/lib/server/auth';
import { calendarSource } from '@/lib/server/calendar-repository';
import { getConfig } from '@/lib/server/config';
import { readLifeCalendar } from '@/lib/server/life-calendar';
import { service } from '@/lib/server/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
 try {
  const config = getConfig();
  authorize(request, config);
  const params = new URL(request.url).searchParams;
  return json(await readLifeCalendar(service().client, calendarSource(config), params.get('from') ?? '', params.get('to') ?? '', params.get('interest') ?? undefined));
 } catch (error) { return errorResponse(error); }
}
