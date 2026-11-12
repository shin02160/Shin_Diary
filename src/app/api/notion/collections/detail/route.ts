import { authorize, errorResponse, json } from '@/lib/server/auth';
import { AppError, getConfig } from '@/lib/server/config';
import { readCollectionDetail } from '@/lib/server/notion-collections';
import { service } from '@/lib/server/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
 try {
  authorize(request, getConfig());
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind');
  if (kind !== 'trips' && kind !== 'performances') throw new AppError(400, '컬렉션을 다시 선택해 주세요.');
  return json(await readCollectionDetail(service().client, {
   trips: process.env.NOTION_TRAVEL_TRIPS_SOURCE_ID,
   performances: process.env.NOTION_PERFORMANCES_SOURCE_ID,
  }, kind, params.get('id') ?? ''));
 } catch (error) { return errorResponse(error); }
}
