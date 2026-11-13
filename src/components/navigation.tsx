'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icon';

type MenuItem = readonly [href: string, icon: IconName, label: string];
const desktop: readonly MenuItem[] = [
 ['/', 'home', '홈'], ['/explore', 'explore', '탐색'], ['/explore/interests', 'interested', '관심사'],
 ['/explore/timeline', 'taste', '취향 연대기'], ['/memories', 'memories', '추억'], ['/wiki', 'wiki', '개인 WIKI'],
 ['/calendar', 'calendar', '캘린더'], ['/report', 'report', '활동 리포트'], ['/continue', 'resume', '이어서 하기'],
 ['/collection', 'collection', '컬렉션'], ['/capture', 'edit', '기록'], ['/settings', 'settings', '설정'],
];
const mobile: readonly MenuItem[] = [
 ['/', 'home', '홈'], ['/wiki', 'wiki', '기억'], ['/explore/interests', 'interested', '관심사'],
 ['/explore/timeline', 'taste', '취향'], ['/more', 'menu', '전체'],
];
const morePaths = ['/explore', '/calendar', '/report', '/capture', '/continue', '/collection', '/settings', '/memories', '/activities'];

export function Navigation({ compact = false }: { compact?: boolean }) {
 const path = usePathname();
 const matches = (href: string) => path === href || (href !== '/' && path.startsWith(href + '/'));
 const items = compact ? mobile : desktop;
 // The most specific menu path wins, so /explore/interests does not also light up /explore.
 const current = [...items.map(([href]) => href), ...(compact ? morePaths : [])]
  .filter(matches).sort((a, b) => b.length - a.length)[0];
 const target = compact && current && morePaths.includes(current) ? '/more' : current;
 return (
  <nav className={compact ? 'mobile-tabs' : 'desktop-nav'} aria-label={compact ? '하단 메뉴' : '주요 메뉴'}>
   {items.map(([href, icon, label]) => {
    return <Link key={href} href={href} aria-current={href === target ? (href === current ? 'page' : 'location') : undefined}>
     <span className={'nav-icon nav-icon-' + icon}><Icon name={icon}/></span>
     <span>{label}</span>
    </Link>;
   })}
  </nav>
 );
}
