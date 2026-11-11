import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { service } from '@/lib/server/service';
import { travelChoices } from '@/lib/server/travel-references';

export const runtime = 'nodejs';
export async function GET(request: Request) {
 try {
  authorize(request, getConfig());
  const { client } = service();
  const trip = new URL(request.url).searchParams.get('trip') || undefined;
  return json(await travelChoices(client, {
   trips: process.env.NOTION_TRAVEL_TRIPS_SOURCE_ID || '',
   booking: process.env.NOTION_TRAVEL_BOOKINGS_SOURCE_ID || '',
   expense: process.env.NOTION_TRAVEL_EXPENSES_SOURCE_ID || '',
   receipt: process.env.NOTION_TRAVEL_RECEIPTS_SOURCE_ID || '',
  }, trip));
 } catch (error) { return errorResponse(error); }
}
