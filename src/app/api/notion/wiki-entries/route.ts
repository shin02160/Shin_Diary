import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { archivePages } from '@/lib/server/life-calendar';
import { readText } from '@/lib/server/notion-mapping';
import { service } from '@/lib/server/service';
import { parseActivityDate } from '@/lib/activity-view';
import { isCalendarEntryLink } from '@/lib/calendar/entry-link';
import { validPhoto } from '@/lib/entry-extras';
import { sourceLinksProperty, validSourceLinks } from '@/lib/source-links';
import type { Entry } from '@/lib/types';
import type { UndatedEntry } from '@/lib/universe-catalog';

export async function GET(request: Request) {
 try {
  const config = getConfig();
  authorize(request, config);
  const pages = await archivePages(service().client, config.entriesId);
  const undated: UndatedEntry[] = [];
  let uncategorized = 0;
  const entries = pages.flatMap((page): Entry[] => {
   const p = page.properties;
   const category = p.Category?.select?.name;
   if (category !== 'Daily' && category !== 'Travel' && category !== 'Concert' && category !== 'Projects') { uncategorized++; return []; }
   const start = p['Occurred At']?.date?.start;
   const kind = p['Date Kind']?.select?.name;
   const value = kind === 'date' ? start?.slice(0, 10) : kind === 'floating' ? start?.slice(0, 19) : start;
   const occurredAt = parseActivityDate(value, readText(p['Time Zone']) || undefined);
   if (!occurredAt) {
    undated.push({ pageId: page.id, title: readText(p.Name).trim() || readText(p.Content).trim().slice(0, 64), category,
     updatedAt: page.last_edited_time, tags: p.Tags?.multi_select?.map(tag => tag.name) ?? [] });
    return [];
   }
   let calendarEvent: Entry['calendarEvent'];
   try {
    const parsed: unknown = JSON.parse(readText(p['Calendar Event']));
    if (isCalendarEntryLink(parsed)) calendarEvent = parsed;
   } catch { /* The entry can be viewed without an optional calendar link. */ }
   const links = [...new Set(readText(p[sourceLinksProperty]).split(/\r?\n/).map(value => value.trim()).filter(Boolean))];
   const photo = readText(p['Diary Photo']);
   const key = readText(p['App ID']).trim() || page.id;
   return [{ id: key, title: readText(p.Name), content: readText(p.Content), occurredAt, updatedAt: page.last_edited_time,
    createdAt: p['Created At']?.date?.start ?? page.created_time ?? '', category, tags: p.Tags?.multi_select?.map(tag => tag.name) ?? [],
    place: readText(p.Place) || undefined, photo: validPhoto(photo) ? photo : undefined, calendarEvent,
    sourceLinks: validSourceLinks(links) ? links : undefined,
    notion: { pageId: page.id, hash: '' },
   }];
  });
  return json({ entries, undated, uncategorized });
 } catch (error) { return errorResponse(error); }
}
