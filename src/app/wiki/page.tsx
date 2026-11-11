import { NotionWiki } from '@/components/notion-wiki';

export default async function Wiki({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
 const { page } = await searchParams;
 return <NotionWiki key={page ?? 'root'} pageId={page}/>;
}
