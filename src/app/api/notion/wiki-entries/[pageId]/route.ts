import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { readWikiEntry } from '@/lib/server/notion-wiki-entry';
import { service } from '@/lib/server/service';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
 try {
  const config = getConfig();
  authorize(request, config);
  const { pageId } = await params;
  return json(await readWikiEntry(service().client, config.entriesId, pageId));
 } catch (error) {
  return errorResponse(error);
 }
}
