'use client';

import { Icon } from '@/components/icon';
import Link from 'next/link';
import { useArchive } from '@/lib/local-store';

export function ArchiveNotice() {
 const { error } = useArchive();
 if (!error) return null;
 return <div className="notice error-notice" role="alert">
  <p><Icon name="alert" size="small"/> {error}</p>
  <Link className="text-link" href="/settings">저장 설정 <Icon name="open" size="small"/></Link>
 </div>;
}
