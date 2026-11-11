import { NotionArchiveHome } from '@/components/notion-archive-home';
import { catalogLabels, type CatalogKind } from '@/lib/universe-catalog';

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ category?: string; search?: string }> }) {
 const { category, search } = await searchParams;
 const kind = typeof category === 'string' && Object.hasOwn(catalogLabels, category) ? category as CatalogKind : 'all';
 return <NotionArchiveHome key={kind + ':' + search} mode="explore" initialKind={kind} focusSearch={search === '1'}
  remote={process.env.DIARY_NOTION_READ_ONLY === 'true'}/>;
}
