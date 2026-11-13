import { NotionArchiveHome } from '@/components/notion-archive-home';

export const dynamic = 'force-dynamic';

export default function ReportPage() {
 return <NotionArchiveHome mode="timeline" timelineStats remote={process.env.DIARY_NOTION_READ_ONLY === 'true'}/>;
}
