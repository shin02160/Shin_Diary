import { Icon } from '@/components/icon';
import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArchiveNotice } from '@/components/archive-notice';
import { Navigation } from '@/components/navigation';
import './globals.css';

export const metadata: Metadata = {
 title: "Youngshin's Universe",
 description: '여행, 공연, 일상과 프로젝트를 모아 보는 개인 위키.',
 icons: { icon: '/favicon.ico', apple: '/youngshin-universe.png' },
};
export const viewport: Viewport = { viewportFit: 'cover', themeColor: '#FAF9F7' };

function Brand() {
 return <Link className="universe-brand" href="/">
  <Image src="/youngshin-universe.png" width={38} height={38} alt="" priority/>
  <span>Youngshin&apos;s Universe</span>
 </Link>;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return (
  <html lang="ko">
   <body>
    <a className="skip" href="#main">본문으로 건너뛰기</a>
    <div className="app-shell universe-shell">
     <aside className="sidebar"><Brand/><Navigation/></aside>
     <div className="workspace">
      <header className="topbar universe-topbar">
       <div className="mobile-brand"><Brand/></div>
       <div className="topbar-tools">
        <Link href="/explore?search=1" className="shell-action" aria-label="기록과 문서 검색"><Icon name="search"/></Link>
        <Link href="/settings" className="shell-action" aria-label="설정 및 연결 상태"><Icon name="profile"/></Link>
       </div>
      </header>
      <main id="main" tabIndex={-1}><ArchiveNotice/>{children}</main>
      <footer>Youngshin&apos;s Universe</footer>
     </div>
     <Navigation compact/>
    </div>
   </body>
  </html>
 );
}
