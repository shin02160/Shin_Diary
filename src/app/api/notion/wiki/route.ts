import { authorize, errorResponse, json } from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { readWiki, wikiRootId } from '@/lib/server/notion-wiki';
import { service } from '@/lib/server/service';

export const runtime = 'nodejs';
export async function GET(request: Request) {
 try {
  authorize(request, getConfig());
  const root = wikiRootId(process.env.NOTION_WIKI_PAGE_ID);
  const { client } = service();
  const page = new URL(request.url).searchParams.get('page') ?? undefined;
  return json(await readWiki(client, root, page));
 } catch (error) { return errorResponse(error); }
}
