"use client";
import { useLastCalendarImport } from '@/lib/calendar/last-import';
import Link from 'next/link';
import { useIcsPreview } from '@/lib/calendar/preview-store';
export function CalendarSettings(){const saved = useLastCalendarImport(); const {lastPreview,latest}=useIcsPreview();return <section className="resume-panel"><div className="eyebrow">NAVER CALENDAR</div><h2>수동 ICS 미리보기</h2><p>네이버에서 내보낸 파일을 달력에서 직접 열어보세요. 실시간 동기화 없이 이 탭에서만 표시합니다.</p><p className="muted">최근 미리보기: {lastPreview?`${new Date(lastPreview).toLocaleString('ko-KR')} · ${latest?.events.length ?? 0}개`:'없음'}</p><p className="muted">이 브라우저의 최근 Notion 반영: {saved ? new Date(saved.at).toLocaleString('ko-KR') + ' · ' + saved.source + ' · ' + saved.count + '개' : '없음'}</p><Link className="button" href="/calendar#ics-import">ICS 가져오기 또는 다시 가져오기</Link></section>;}
