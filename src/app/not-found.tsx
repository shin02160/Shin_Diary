import { Icon } from '@/components/icon';
import Link from 'next/link';
export default function NotFound() { return <div className="empty"><span className="empty-icon"><Icon name="empty" size="large"/></span><h1>아직 발견하지 못한 공간이에요</h1><p>활동이나 페이지를 찾을 수 없어요.</p><Link className="button primary" href="/">나의 우주로 돌아가기</Link></div>; }
