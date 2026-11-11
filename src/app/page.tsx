import { LocalHome } from '@/components/local-home';
import { NotionArchiveHome } from '@/components/notion-archive-home';

export const dynamic = 'force-dynamic';

export default function Home() {
 return process.env.DIARY_NOTION_READ_ONLY === 'true' ? <NotionArchiveHome/> : <LocalHome/>;
}
