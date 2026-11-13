import Link from 'next/link';
import { Icon, type IconName } from '@/components/icon';

const links = [
 ['/explore', 'explore', '전체 기록 탐색'], ['/calendar', 'calendar', '캘린더'],
 ['/report', 'report', '활동 리포트'], ['/capture', 'edit', '기록하기'],
 ['/memories', 'memories', '추억 모아보기'], ['/continue', 'resume', '이어서 하기'],
 ['/collection', 'collection', '컬렉션'], ['/settings', 'settings', '설정 · Notion 연결 · 백업'],
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
