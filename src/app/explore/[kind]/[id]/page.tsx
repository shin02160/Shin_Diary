import { notFound } from 'next/navigation';
import { CollectionRecord } from '@/components/collection-record';

export default async function CollectionDetailPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
 const { kind, id } = await params;
 if (kind !== 'trips' && kind !== 'performances') notFound();
 return <CollectionRecord key={kind + ':' + id} kind={kind} id={id} remote={process.env.DIARY_NOTION_READ_ONLY === 'true'}/>;
}
