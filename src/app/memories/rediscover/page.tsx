import Link from 'next/link';
import { PageHeading } from '@/components/cards';
import { RediscoverMemories } from '@/components/rediscover-memories';

export default function RediscoverPage() {
  return (
    <>
      <Link href="/memories" className="text-link">← 추억 모아보기</Link>
      <PageHeading eyebrow="MEMORIES" title="추억 다시 보기">{null}</PageHeading>
      <RediscoverMemories />
    </>
  );
}
