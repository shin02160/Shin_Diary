import { NotionArchiveHome } from '@/components/notion-archive-home';

export const dynamic = 'force-dynamic';

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
 const { view } = await searchParams;
 return <NotionArchiveHome mode="timeline" timelineStats={view === 'activity'} remote={process.env.DIARY_NOTION_READ_ONLY === 'true'}/>;
}
