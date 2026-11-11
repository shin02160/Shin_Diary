import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { readNotionCollections } from '@/lib/server/notion-collections';
import { service } from '@/lib/server/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
 try {
  authorize(request, getConfig());
  return json(await readNotionCollections(service().client, {
   trips: process.env.NOTION_TRAVEL_TRIPS_SOURCE_ID,
   itinerary: process.env.NOTION_TRAVEL_SCHEDULE_SOURCE_ID,
   performances: process.env.NOTION_PERFORMANCES_SOURCE_ID,
  }));
 } catch (error) { return errorResponse(error); }
}
