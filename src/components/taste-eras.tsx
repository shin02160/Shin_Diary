'use client';

import Link from 'next/link';
import { timelineDay } from '@/lib/activity-timeline';
import { dayLabel } from '@/lib/dates';
import type { EraSubject, TasteEra } from '@/lib/taste-eras';
import type { CatalogItem } from '@/lib/universe-catalog';

const period = (era: TasteEra) => era.from === era.to ? era.from + '년' : era.from + '~' + era.to + '년';
const interestHref = (id: string) => '/explore/interests?id=' + encodeURIComponent(id);
// Subjects that share the lead: anything recorded at least half as often as the first.
const leaders = (era: TasteEra) => era.subjects.filter(subject => subject.days * 2 >= era.subjects[0].days).slice(0, 2);

function Subject({ subject }: { subject: EraSubject }) {
 return subject.interestId ? <Link href={interestHref(subject.interestId)}>{subject.name}</Link> : <>{subject.name}</>;
}

// Written reviews make the best way back into a period; database rows stand in when there are none.
function highlights(subject: EraSubject) {
 const seen = new Set<string>();
 const records = subject.records.filter(item => {
  const day = timelineDay(item.startAt)!;
  if (seen.has(day)) return false;
  seen.add(day);
  return true;
 });
 const reviews = subject.records.filter(item => item.entry);
 return (reviews.length ? reviews : records).slice(-3).reverse();
}

function Counts({ label, rows }: { label: string; rows: [string, number][] }) {
 if (!rows.length) return null;
 return <div><dt>{label}</dt><dd>{rows.slice(0, 5).map(([name, count]) => name + (count > 1 ? ' ' + count : '')).join(' · ')}</dd></div>;
}

export function TasteEras({ eras }: { eras: TasteEra[] }) {
 if (!eras.length) return <p>시기를 나눌 만큼 날짜가 있는 기록이 아직 없어요.</p>;
 return <>
  <ol className="taste-era-strip" aria-label="시기별로 가장 많이 기록된 대상">
   {eras.map(era => <li key={era.from}>
    <a href={'#era-' + era.from}>
     <span>{period(era)}</span>
     <strong>{era.subjects.length ? leaders(era).map(subject => subject.name).join(' · ') : '기록 ' + era.records + '건'}</strong>
    </a>
   </li>)}
  </ol>
  <p className="universe-meta">각 시기에 가장 여러 날 기록된 대상이에요. 공연 DB의 아티스트와 기록 제목·태그로 셌고, 기록이 많다고 더 좋아했다는 뜻은 아니에요.</p>
  <ol className="taste-eras">
   {eras.map((era, index) => {
    const previous = eras[index - 1];
    const gone = previous?.subjects.filter(subject => subject.days >= 2 && !era.subjects.some(item => item.key === subject.key)).slice(0, 3) ?? [];
    // One-off appearances are left to the list below; a change is someone recorded on several days.
    const arrived = era.subjects.filter(subject => subject.firstSeen && subject.days >= 2).slice(0, 4);
    return <li key={era.from} id={'era-' + era.from}>
     <p className="taste-era-period">{period(era)}</p>
     {era.subjects.length ? <h3>{leaders(era).map((subject, order) => <span key={subject.key}>{order > 0 && ' · '}<Subject subject={subject}/></span>)}</h3> :
      <h3>대상을 알 수 있는 기록이 없어요</h3>}
     {index > 0 && (arrived.length > 0 || gone.length > 0) && <p className="taste-era-change">
      {arrived.length > 0 && <>처음 기록됨 · {arrived.map(subject => subject.name).join(', ')}</>}
      {arrived.length > 0 && gone.length > 0 && ' / '}
      {gone.length > 0 && <>이 시기 기록 없음 · {gone.map(subject => subject.name).join(', ')}</>}
     </p>}
     <dl>
      {era.subjects.length > 0 && <div><dt>기록된 대상</dt><dd className="taste-era-subjects">{era.subjects.slice(0, 6).map(subject =>
       <span key={subject.key} className={subject.firstSeen ? 'new' : undefined}><Subject subject={subject}/> {subject.days}일</span>)}</dd></div>}
      <Counts label="여행지" rows={era.places}/>
      <Counts label="공연 도시" rows={era.cities}/>
      <Counts label="키워드" rows={era.keywords}/>
     </dl>
     {leaders(era).map(subject => <div key={subject.key} className="taste-era-records">
      <p className="universe-meta">{subject.name}의 기록</p>
      <ul>{highlights(subject).map((item: CatalogItem) => <li key={item.key}>
       <Link href={item.detailHref ?? item.originalUrl ?? '/explore'}>{item.title}</Link>
       <span className="universe-meta"> · {dayLabel(timelineDay(item.startAt)!)}</span>
      </li>)}</ul>
     </div>)}
     <p className="universe-meta">이 시기의 날짜 있는 기록 {era.records}건</p>
    </li>;
   })}
  </ol>
 </>;
}
