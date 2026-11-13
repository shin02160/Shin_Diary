import { notFound } from 'next/navigation';
import { WikiArchive } from '@/components/wiki-archive';

export default async function WikiReview({ params }: { params: Promise<{ month: string }> }) {
 const { month } = await params;
 if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(month)) notFound();
 return <WikiArchive key={month} month={month}/>;
}
