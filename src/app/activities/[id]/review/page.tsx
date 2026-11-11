import { ActivityReview } from '@/components/activity-review';

export default async function ActivityReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityReview key={id} id={id}/>;
}
