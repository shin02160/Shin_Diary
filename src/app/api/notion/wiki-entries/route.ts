import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { archivePages } from '@/lib/server/life-calendar';
import { readText } from '@/lib/server/notion-mapping';
import { service } from '@/lib/server/service';
import { parseActivityDate } from '@/lib/activity-view';
import { isCalendarEntryLink } from '@/lib/calendar/entry-link';
import { validPhoto } from '@/lib/entry-extras';
import type { Entry } from '@/lib/types';

export async function GET(request: Request) {
 try {
  const config = getConfig();
  authorize(request, config);
  const pages = await archivePages(service().client, config.entriesId);
  const entries = pages.flatMap((page): Entry[] => {
   const p = page.properties;
   const category = p.Category?.select?.name;
   if (category !== 'Daily' && category !== 'Travel' && category !== 'Concert' && category !== 'Projects') return [];
   const start = p['Occurred At']?.date?.start;
   const kind = p['Date Kind']?.select?.name;
   const value = kind === 'date' ? start?.slice(0, 10) : kind === 'floating' ? start?.slice(0, 19) : start;
   const occurredAt = parseActivityDate(value, readText(p['Time Zone']) || undefined);
   if (!occurredAt) return [];
   let calendarEvent: Entry['calendarEvent'];
   try {
    const parsed: unknown = JSON.parse(readText(p['Calendar Event']));
    if (isCalendarEntryLink(parsed)) calendarEvent = parsed;
   } catch { /* The entry can be viewed without an optional calendar link. */ }
   const photo = readText(p['Diary Photo']);
   const key = readText(p['App ID']).trim() || page.id;
   return [{ id: key, title: readText(p.Name), content: readText(p.Content), occurredAt, updatedAt: page.last_edited_time,
    createdAt: p['Created At']?.date?.start ?? page.created_time ?? '', category, tags: p.Tags?.multi_select?.map(tag => tag.name) ?? [],
    place: readText(p.Place) || undefined, photo: validPhoto(photo) ? photo : undefined, calendarEvent,
    notion: { pageId: page.id, hash: '' },
   }];
  });
  return json({ entries });
 } catch (error) { return errorResponse(error); }
}
