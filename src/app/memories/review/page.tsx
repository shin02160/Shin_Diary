import Link from 'next/link';
import { PageHeading } from '@/components/cards';
import { MonthlyReview } from '@/components/monthly-review';

export default function MonthlyReviewPage() {
  return (
    <>
      <Link href="/memories" className="text-link">← 추억 모아보기</Link>
      <PageHeading eyebrow="MEMORIES" title="월별 회고">
        한 달 동안 남긴 기록을 날짜와 활동별로 돌아보세요.
      </PageHeading>
      <MonthlyReview />
    </>
  );
}
