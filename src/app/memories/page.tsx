import { DuplicateRecords } from '@/components/duplicate-records';
import Link from 'next/link';
import { PageHeading } from '@/components/cards';
import { Explorer } from '@/components/explorer';
export default function Memories() { return <><PageHeading eyebrow="MEMORIES" title="그때의 마음을, 다시">작지만 선명했던 순간들을 천천히 펼쳐보세요.</PageHeading><div className="form-actions"><Link href="/memories/review" className="button">월별 회고 보기</Link><Link href="/memories/rediscover" className="button">추억 다시 보기</Link></div><DuplicateRecords/><Explorer mode="memories"/></>; }
