import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { archivePages } from '@/lib/server/life-calendar';
import { readText } from '@/lib/server/notion-mapping';
import { service } from '@/lib/server/service';

export async function GET(request: Request) {
 try {
  authorize(request, getConfig());
  const source = process.env.NOTION_TIMELINE_SOURCE_ID?.trim();
  if (!source) return json({ events: [], configured: false });
  const pages = await archivePages(service().client, source);
  const events = pages.flatMap(page => {
   const p = page.properties;
   const title = readText(p['이벤트명']).trim();
   return title ? [{
    id: page.id.replaceAll('-', '').toLowerCase(), title,
    start: p['날짜']?.date?.start, end: p['날짜']?.date?.end, timezone: p['날짜']?.date?.time_zone,
    category: p['카테고리']?.select?.name, description: readText(p['설명']),
    interestLabel: readText(p['관련 관심사']),
   }] : [];
  });
  return json({ configured: true, events });
 } catch (error) { return errorResponse(error); }
}
