import { NotionArchiveHome } from '@/components/notion-archive-home';
import { NotionWiki } from '@/components/notion-wiki';

export default async function Wiki({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
 const { page } = await searchParams;
 if (!page && !process.env.NOTION_WIKI_PAGE_ID?.trim()) return <NotionArchiveHome/>;
 return <NotionWiki key={page ?? 'root'} pageId={page}/>;
}
