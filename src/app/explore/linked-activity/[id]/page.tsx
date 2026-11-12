import Link from 'next/link';
import { notFound } from 'next/navigation';
import { notionRelationId } from '@/lib/server/notion-relations';
import { LinkedActivity } from '@/components/linked-activity';

export default async function LinkedActivityPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 if (!notionRelationId.test(id)) notFound();
 return <><Link className="text-link" href="/calendar">캘린더</Link><LinkedActivity id={id.replaceAll('-', '').toLowerCase()}/></>;
}
