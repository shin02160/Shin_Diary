"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const items = [['/', '⌂', '나의 우주', 'Home'], ['/memories', '◷', '추억 모아보기', 'Memories'], ['/continue', '↗', '이어서 하기', 'Continue'], ['/collection', '▦', '좋아하는 것들', 'Collection'], ['/calendar', '▤', '달력', 'Calendar'], ['/wiki', '▣', '개인 위키', 'Wiki'], ['/settings', '⚙', '설정', 'Settings']];
export function Navigation() { const path = usePathname(); return <nav aria-label="주요 메뉴">{items.map(([href, icon, label, en]) => <Link key={href} href={href} aria-current={(href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}<small>{en}</small></span></Link>)}</nav>; }
