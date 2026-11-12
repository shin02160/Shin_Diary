import { NotionArchiveHome } from '@/components/notion-archive-home';

export const dynamic = 'force-dynamic';

export default function TimelinePage() {
 return <NotionArchiveHome mode="timeline" remote={process.env.DIARY_NOTION_READ_ONLY === 'true'}/>;
}
