import { WikiArchive } from '@/components/wiki-archive';
import { NotionWiki } from '@/components/notion-wiki';

export default async function Wiki({ searchParams }: { searchParams: Promise<{ page?: string; entry?: string }> }) {
 const { page, entry } = await searchParams;
 if (typeof entry === 'string') return <WikiArchive key={entry} entryId={entry}/>;
 return <NotionWiki key={page ?? 'root'} pageId={page}/>;
}
