import type { ImportedEvent, PreviewResult, SavedEvent } from './types';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const midnight = (value: string) => value.length === 10 ? value+'T00:00:00' : value;
export function overlaps(event: ImportedEvent,from: string,to: string) {
 const start=midnight(event.wallStart);const end=midnight(event.wallEnd);
 if(end<=start)return event.wallStart.slice(0,10)>=from&&event.wallStart.slice(0,10)<=to;
 return event.wallStart.slice(0,10)<=to&&end>from+'T00:00:00';
}
export function previewDiff(result: PreviewResult, current: ImportedEvent[]) {
 const old=new Map(current.filter(e=>e.sourceCalendarId===result.sourceCalendarId).map(e=>[e.id,e]));
 const ids=new Set(result.events.map(e=>e.id));const counts={added:0,unchanged:0,changed:0,retained:0};
 for(const event of result.events){const before=old.get(event.id);if(!before)counts.added++;else if(calendarContent(before)===calendarContent(event))counts.unchanged++;else counts.changed++;}
 for(const event of old.values())if(!ids.has(event.id)&&overlaps(event,result.from,result.to))counts.retained++;
 return counts;
}
export function wallLabel(value:string){const [y,m,d]=value.slice(0,10).split('-');return `${y}년 ${Number(m)}월 ${Number(d)}일${value.length>10?' '+value.slice(11,16):''}`;}
export function eventPeriod(event: ImportedEvent) {
 if(event.start.kind==='date'){
  const last=new Date(Date.parse(event.wallEnd+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  return event.wallStart===last?`${wallLabel(event.wallStart)} · 종일`:`${wallLabel(event.wallStart)} ~ ${wallLabel(last)} · 종일`;
 }
 return `${wallLabel(event.wallStart)}${event.wallEnd!==event.wallStart?' ~ '+wallLabel(event.wallEnd):''} · ${event.originalTimezone || '현지 시각(시간대 없음)'}`;
}

export function calendarContent(event: ImportedEvent) {
 const absolute = (value: ImportedEvent['start'] | undefined) =>
   value?.kind === 'zoned' ? new Date(value.instant).toISOString() : undefined;
 return JSON.stringify([
   event.id, event.title, event.sourceName, event.wallStart, event.wallEnd,
   absolute(event.start), absolute(event.end), event.originalTimezone ?? '',
   event.description, event.location ?? '', event.status,
 ]);
}

export function reviewImport(result: PreviewResult, saved: SavedEvent[]) {
  const matchingSource = saved.filter(item => item.event.sourceCalendarId === result.sourceCalendarId);
  const byId = new Map(matchingSource.map(item => [item.event.id, item]));
  const present = new Set(result.events.map(event => event.id));
  const remaining = result.events.flatMap(event => {
    const previous = byId.get(event.id);
    if (previous && calendarContent(previous.event) === calendarContent(event)) return [];
    return [{ event, previous }];
  });
  const omitted = result.partial ? [] : matchingSource.filter(({ event }) =>
    !present.has(event.id) && overlaps(event, result.from, result.to));
  return { remaining, omitted, unchanged: result.events.length - remaining.length };
}
