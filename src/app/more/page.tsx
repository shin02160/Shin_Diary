import Link from 'next/link';
import { Icon, type IconName } from '@/components/icon';

const links = [
 ['/wiki', 'wiki', '개인 WIKI'], ['/memories', 'memories', '추억 모아보기'],
 ['/collection', 'collection', '컬렉션'], ['/continue', 'resume', '이어서 하기'],
 ['/settings', 'settings', '설정 · Notion 연결 · 백업'],
] as const satisfies readonly (readonly [string, IconName, string])[];

export default function MorePage() {
 return <>
  <h1>전체 메뉴</h1>
  <nav className="universe-menu" aria-label="전체 메뉴">
   {links.map(([href, icon, label]) => <Link key={href} href={href}>
    <Icon name={icon}/><span>{label}</span><Icon name="next" size="small"/>
   </Link>)}
  </nav>
 </>;
}
