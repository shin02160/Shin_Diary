'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icon';

type MenuItem = readonly [href: string, icon: IconName, label: string];
const desktop: readonly MenuItem[] = [
 ['/', 'home', '홈'], ['/explore', 'explore', '탐색'], ['/memories', 'memories', '추억'],
 ['/wiki', 'wiki', '개인 WIKI'], ['/continue', 'resume', '이어서 하기'], ['/collection', 'collection', '컬렉션'],
 ['/calendar', 'calendar', '캘린더'], ['/capture', 'edit', '기록'], ['/settings', 'settings', '설정'],
];
const mobile: readonly MenuItem[] = [
 ['/', 'home', '홈'], ['/explore', 'explore', '탐색'], ['/capture', 'edit', '기록'],
 ['/calendar', 'calendar', '캘린더'], ['/more', 'menu', '전체'],
];
const morePaths = ['/wiki', '/continue', '/collection', '/settings', '/memories', '/activities'];

export function Navigation({ compact = false }: { compact?: boolean }) {
 const path = usePathname();
 const matches = (href: string) => path === href || (href !== '/' && path.startsWith(href + '/'));
 return (
  <nav className={compact ? 'mobile-tabs' : 'desktop-nav'} aria-label={compact ? '하단 메뉴' : '주요 메뉴'}>
   {(compact ? mobile : desktop).map(([href, icon, label]) => {
    const active = matches(href) || (compact && href === '/more' && morePaths.some(matches));
    return <Link key={href} href={href} aria-current={active ? (matches(href) ? 'page' : 'location') : undefined}>
     <span className={'nav-icon nav-icon-' + icon}><Icon name={icon}/></span>
     <span>{label}</span>
    </Link>;
   })}
  </nav>
 );
}
