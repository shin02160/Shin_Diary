import type { Metadata } from 'next';
import Link from 'next/link';
import { ArchiveNotice } from '@/components/archive-notice';
import { Navigation } from '@/components/navigation';
import './globals.css';
export const metadata: Metadata = { title: 'My Little Universe · 작은 우주', description: '경험을 쌓고, 추억을 돌아보고, 나의 속도로 다시 시작하는 개인 아카이브.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><a className="skip" href="#main">본문으로 건너뛰기</a><div className="app-shell"><aside className="sidebar"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">✳</span><span>my little<br/><strong>universe</strong><small>나의 작은 우주</small></span></Link><Navigation/><div className="sidebar-note"><span aria-hidden="true">☾</span><p>완벽하지 않아도,<br/>모두 나의 이야기.</p></div><div className="sample-label">기록과 일정 · STEP 04</div></aside><div className="workspace"><header className="topbar"><span>MY PERSONAL ARCHIVE</span><Link href="/settings" className="profile" aria-label="설정 열기">나</Link></header><main id="main" tabIndex={-1}><ArchiveNotice/>{children}</main><footer>나의 속도로, 나의 우주를 채워가요. <span>My Little Universe</span></footer></div></div></body></html>;
}
