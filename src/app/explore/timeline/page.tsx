import { redirect } from 'next/navigation';
import { NotionArchiveHome } from '@/components/notion-archive-home';

export const dynamic = 'force-dynamic';

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
 // Older links opened the report as a tab of this page.
 if ((await searchParams).view === 'activity') redirect('/report');
 return <NotionArchiveHome mode="timeline" remote={process.env.DIARY_NOTION_READ_ONLY === 'true'}/>;
}
