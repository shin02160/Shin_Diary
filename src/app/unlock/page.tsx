import { notFound } from 'next/navigation';
import { SiteUnlock } from '@/components/site-unlock';
import { safeSitePath } from '@/lib/site-path';

export const dynamic = 'force-dynamic';

export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
 if (process.env.DIARY_SITE_LOCK !== 'true') notFound();
 const { next } = await searchParams;
 return <div className="site-lock-shell"><SiteUnlock next={safeSitePath(typeof next === 'string' ? next : undefined)}
  numeric={/^\d{4}$/.test(process.env.DIARY_PASSWORD || '')}/></div>;
}
