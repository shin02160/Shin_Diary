"use client";
import Link from 'next/link';
import { pending } from '@/lib/archive-schema';
import { useArchive } from '@/lib/local-store';
export function ArchiveNotice() { const { error, ready, activities, entries } = useArchive(); return <div className={`notice ${error ? 'error-notice' : ''}`} role={error ? 'alert' : 'status'}><p>{!ready ? '기록을 불러오는 중…' : error || `브라우저에 저장됩니다. Notion 미반영 ${[...activities,...entries].filter(pending).length}개 · Notion 저장과 불러오기는 설정에서 직접 실행합니다.`}</p><Link className="text-link" href="/settings">저장 설정 ↗</Link></div>; }
