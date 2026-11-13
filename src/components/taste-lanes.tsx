'use client';

import Link from 'next/link';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { dayLabel } from '@/lib/dates';
import type { Interest } from '@/lib/interests';
import { catalogLabels, type CatalogItem } from '@/lib/universe-catalog';

const PAD = 14, HEAD = 26, ROW = 76;
const narrowScreen = '(max-width: 760px)';
function watchNarrow(notify: () => void) {
 const media = matchMedia(narrowScreen);
 media.addEventListener('change', notify);
 return () => media.removeEventListener('change', notify);
}

export interface Lane { interest: Interest; rows: { item: CatalogItem; day: string; confirmed: boolean }[] }

function Mark({ item, x, y, confirmed }: { item: CatalogItem; x: number; y: number; confirmed: boolean }) {
 const paint = { fill: confirmed ? 'var(--universe-accent)' : 'var(--surface)', stroke: 'var(--universe-accent)', strokeWidth: 2 };
 if (item.kind === 'travel') return <rect x={x - 6} y={y - 6} width={12} height={12} rx={2} {...paint}/>;
 return <circle cx={x} cy={y} r={item.kind === 'concert' ? 7 : 4} {...paint}/>;
}

// One row per interest, one mark per record. Bands join years that have records; a year without any stays empty.
export function TasteLanes({ lanes, today, interestHref }: { lanes: Lane[]; today: string; interestHref: (id: string) => string }) {
 const scroller = useRef<HTMLDivElement>(null);
 // A phone shows less of each year so more than one fits on screen.
 const YEAR = useSyncExternalStore(watchNarrow, () => matchMedia(narrowScreen).matches, () => false) ? 150 : 230;
 const days = lanes.flatMap(lane => lane.rows.map(row => row.day));
 const first = Number((days.sort()[0] ?? today).slice(0, 4));
 const last = Number(today.slice(0, 4));
 const years = Array.from({ length: last - first + 1 }, (_, index) => first + index);
 const start = Date.UTC(first, 0, 1), span = Date.UTC(last + 1, 0, 1) - start;
 const width = years.length * YEAR + PAD * 2;
 const height = HEAD + lanes.length * ROW;
 const x = (day: string) => PAD + (Date.parse(day + 'T00:00:00Z') - start) / span * years.length * YEAR;
 // Start at the most recent years; earlier ones are a scroll away.
 useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, [width]);

 return <>
  <div className="taste-lanes">
   <div className="taste-lane-names" style={{ paddingTop: HEAD }}>
    {lanes.map(({ interest }) => <Link key={interest.id} href={interestHref(interest.id)} style={{ height: ROW }}>{interest.name}</Link>)}
   </div>
   <div className="taste-lane-scroll" ref={scroller} tabIndex={0} role="group" aria-label="관심사별 기록 흐름, 가로로 스크롤">
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
     aria-label={lanes.map(({ interest, rows }) => interest.name + ' ' + (rows.length ? rows[0].day.slice(0, 4) + '년부터 기록 ' + rows.length + '건' : '이어지는 기록 없음')).join(', ')}>
     {years.map((year, index) => <g key={year}>
      <line x1={PAD + index * YEAR} x2={PAD + index * YEAR} y1={HEAD - 6} y2={height} className="taste-lane-grid"/>
      <text x={PAD + index * YEAR + 6} y={14} className="taste-lane-label">{year}</text>
     </g>)}
     {lanes.map(({ interest, rows }, lane) => {
      const y = HEAD + lane * ROW + ROW / 2 + 8;
      if (!rows.length) return <g key={interest.id}>
       <line x1={PAD} x2={width - PAD} y1={y} y2={y} className="taste-lane-empty"/>
       <text x={width - PAD - 6} y={y - 8} textAnchor="end" className="taste-lane-label">이어지는 기록 없음</text>
      </g>;
      // A run is a stretch of consecutive years with records.
      const runs: (typeof rows)[] = [];
      for (const row of rows) {
       const run = runs.at(-1);
       if (run && Number(row.day.slice(0, 4)) - Number(run.at(-1)!.day.slice(0, 4)) <= 1) run.push(row);
       else runs.push([row]);
      }
      let previous = -100, step = 0;
      return <g key={interest.id}>
       {runs.map((run, index) => {
        const from = x(run[0].day), to = x(run.at(-1)!.day);
        const gap = runs[index + 1] && (to + x(runs[index + 1][0].day)) / 2;
        const note = (index ? '다시 나타남 · ' : '처음 확인 · ') + Number(run[0].day.slice(0, 4)) + '.' + Number(run[0].day.slice(5, 7));
        const end = from > width - 130;
        return <g key={run[0].day}>
         <rect x={from - 10} y={y - 9} width={to - from + 20} height={18} rx={9} className="taste-lane-band"/>
         <text x={end ? to + 10 : from - 10} y={y - 28} textAnchor={end ? 'end' : 'start'} className="taste-lane-label">{note}</text>
         {gap && <text x={gap} y={y + 4} textAnchor="middle" className="taste-lane-label">기록 없음</text>}
        </g>;
       })}
       {rows.map(({ item, day, confirmed }) => {
        const at = x(day);
        // Records on nearby days fan out vertically so each stays visible and clickable.
        step = at - previous < 13 ? step + 1 : 0;
        if (!step) previous = at;
        const offset = [0, -13, 13][step % 3];
        const shift = Math.floor(step / 3) * 6;
        const href = item.detailHref ?? item.originalUrl;
        const label = dayLabel(day) + ' · ' + catalogLabels[item.kind] + ' · ' + item.title + ' · ' + (confirmed ? '확정 연결' : '추천 연결');
        const mark = <g className={'universe-tone-' + item.kind}>
         <title>{label}</title>
         <circle cx={at + shift} cy={y + offset} r={11} fill="transparent"/>
         <Mark item={item} x={at + shift} y={y + offset} confirmed={confirmed}/>
        </g>;
        return href ? <a key={item.key} href={href} aria-label={label} {...(item.detailHref ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>{mark}</a>
         : <g key={item.key}>{mark}</g>;
       })}
      </g>;
     })}
    </svg>
   </div>
  </div>
  <ul className="taste-lane-legend" aria-label="범례">
   <li className="universe-tone-concert"><svg width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="var(--universe-accent)"/></svg> 공연</li>
   <li className="universe-tone-travel"><svg width="18" height="18" aria-hidden="true"><rect x="3" y="3" width="12" height="12" rx="2" fill="var(--universe-accent)"/></svg> 여행</li>
   <li className="universe-tone-daily"><svg width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="4" fill="var(--universe-accent)"/></svg> 일상·기타</li>
   <li>채움 = 확정 연결 · 테두리 = 추천 연결</li>
  </ul>
 </>;
}
