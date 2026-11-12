import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { readInterests } from '@/lib/server/notion-interests';
import { service } from '@/lib/server/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
 try {
  const config = getConfig();
  authorize(request, config);
  const id = new URL(request.url).searchParams.get('id') ?? undefined;
  return json(await readInterests(service().client, process.env.NOTION_INTERESTS_SOURCE_ID, id, config.activitiesId));
 } catch (error) { return errorResponse(error); }
}
