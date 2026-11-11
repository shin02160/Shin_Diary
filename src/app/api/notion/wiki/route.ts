import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { readWiki } from '@/lib/server/notion-wiki';
import { service } from '@/lib/server/service';

export const runtime = 'nodejs';
export async function GET(request: Request) {
 try {
  authorize(request, getConfig());
  const { client } = service();
  const page = new URL(request.url).searchParams.get('page') || undefined;
  return json(await readWiki(client, process.env.NOTION_WIKI_PAGE_ID || '', page));
 } catch (error) { return errorResponse(error); }
}
