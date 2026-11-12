import { NotionArchiveHome } from '@/components/notion-archive-home';

export const dynamic = 'force-dynamic';

export default async function InterestsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
 const { id } = await searchParams;
 const interestId = typeof id === 'string' ? id : undefined;
 return <NotionArchiveHome key={interestId ?? 'interests'} mode="interests" interestId={interestId}
  remote={process.env.DIARY_NOTION_READ_ONLY === 'true'}/>;
}
