import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs } from '../../src/lib/calendar/ics-parser.mjs';
import { eventPeriod, overlaps, previewDiff, reviewImport } from '../../src/lib/calendar/event-utils.ts';
const options={sourceCalendarId:'개인',sourceName:'개인',from:'2026-11-01',to:'2026-11-30'};
const calendar=(...events:string[])=>['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//My Little Universe//Fixture//KO',...events,'END:VCALENDAR',''].join('\r\n');
const event=(uid:string,...fields:string[])=>['BEGIN:VEVENT','UID:'+uid,'DTSTAMP:20261101T000000Z',...fields,'END:VEVENT'].join('\r\n');
test('all-day end is exclusive, defaults to one day, and spans month boundary',()=>{
 const result=parseIcs(calendar(event('multi','DTSTART;VALUE=DATE:20261031','DTEND;VALUE=DATE:20261103','SUMMARY:여행'),event('single','DTSTART;VALUE=DATE:20261112','SUMMARY:휴일')),options);
 assert.equal(result.events.length,2);const multi=result.events[0];assert.equal(multi.wallStart,'2026-10-31');assert.equal(multi.wallEnd,'2026-11-03');assert(overlaps(multi,'2026-11-01','2026-11-01'));assert(overlaps(multi,'2026-11-02','2026-11-02'));assert(!overlaps(multi,'2026-11-03','2026-11-03'));assert.match(eventPeriod(multi),/11월 2일 · 종일$/);assert.equal(result.events[1].wallEnd,'2026-11-13');
});
test('IANA fallbacks preserve Seoul, Shanghai and Tokyo offsets and local wall time',()=>{
 const list=['Asia/Seoul','Asia/Shanghai','Asia/Tokyo'].map(z=>event(z,'DTSTART;TZID='+z+':20261111T090000','DTEND;TZID='+z+':20261111T100000'));
 const result=parseIcs(calendar(...list),options);assert.equal(result.events.length,3);const byZone=new Map(result.events.map(e=>[e.originalTimezone,e]));
 for(const [zone,hour] of [['Asia/Seoul','00'],['Asia/Shanghai','01'],['Asia/Tokyo','00']]){const e=byZone.get(zone)!;assert.equal(e.wallStart,'2026-11-11T09:00:00');assert.equal(e.start.kind,'zoned');if(e.start.kind==='zoned')assert.equal(Date.parse(e.start.instant),Date.parse(`2026-11-11T${hour}:00:00Z`));}
});
test('UTC and floating values stay distinct; timed end at midnight excludes following date',()=>{
 const result=parseIcs(calendar(event('z','DTSTART:20261111T230000Z','DTEND:20261112T000000Z'),event('float','DTSTART:20261111T090000')),options);
 const z=result.events.find(e=>e.uid==='z')!;const f=result.events.find(e=>e.uid==='float')!;assert.equal(z.originalTimezone,'UTC');assert.equal(f.start.kind,'floating');assert(!overlaps(z,'2026-11-12','2026-11-12'));
});
test('weekly RRULE, RDATE, EXDATE and moved recurrence use original instance identity',()=>{
 const master=event('series','DTSTART;TZID=Asia/Seoul:20261101T090000','DTEND;TZID=Asia/Seoul:20261101T100000','RRULE:FREQ=WEEKLY;COUNT=4','EXDATE;TZID=Asia/Seoul:20261108T090000','RDATE;TZID=Asia/Seoul:20261128T090000','SUMMARY:산책');
 const moved=event('series','RECURRENCE-ID:20261115T000000Z','DTSTART;TZID=Asia/Seoul:20261116T100000','DTEND;TZID=Asia/Seoul:20261116T110000','SUMMARY:변경 산책');
 const result=parseIcs(calendar(master,moved),options);assert.deepEqual(result.events.map(e=>e.wallStart.slice(0,10)),['2026-11-01','2026-11-16','2026-11-22','2026-11-28']);
 const original=parseIcs(calendar(master),options).events.find(e=>e.wallStart.startsWith('2026-11-15'))!;assert.equal(result.events[1].id,original.id);assert.equal(result.events[1].title,'변경 산책');
});
test('detached override moved into range is included; cancellation may omit DTSTART',()=>{
 const master=event('s','DTSTART:20261101T090000Z','RRULE:FREQ=WEEKLY;COUNT=8','SUMMARY:기본');
 const moved=event('s','RECURRENCE-ID:20261206T090000Z','DTSTART:20261130T100000Z','SUMMARY:이동');
 const cancelled=event('s','RECURRENCE-ID:20261108T090000Z','STATUS:CANCELLED');
 const result=parseIcs(calendar(master,moved,cancelled),options);assert(result.events.some(e=>e.title==='이동'&&e.wallStart.startsWith('2026-11-30')));assert(result.events.some(e=>e.status==='cancelled'&&e.wallStart.startsWith('2026-11-08')&&e.title==='기본'));
});
test('DST weekly recurrence keeps local time and changes UTC offset',()=>{
 const result=parseIcs(calendar(event('dst','DTSTART;TZID=America/New_York:20261025T090000','DTEND;TZID=America/New_York:20261025T100000','RRULE:FREQ=WEEKLY;COUNT=3')),{...options,from:'2026-10-25'});
 assert.equal(result.events.length,3);const dates=result.events.map(e=>e.start.kind==='zoned'?new Date(e.start.instant).toISOString():'');assert.deepEqual(dates,['2026-10-25T13:00:00.000Z','2026-11-01T14:00:00.000Z','2026-11-08T14:00:00.000Z']);
});
test('embedded custom VTIMEZONE is honored without treating the original wall clock as UTC',()=>{
 const tz=['BEGIN:VTIMEZONE','TZID:Custom/Desk','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0530','TZOFFSETTO:+0530','END:STANDARD','END:VTIMEZONE'].join('\r\n');
 const result=parseIcs(calendar(tz,event('custom','DTSTART;TZID=Custom/Desk:20261111T090000')),options);const e=result.events[0];assert.equal(e.originalTimezone,'Custom/Desk');assert.equal(e.wallStart,'2026-11-11T09:00:00');assert.equal(e.start.kind,'zoned');if(e.start.kind==='zoned')assert.equal(new Date(e.start.instant).toISOString(),'2026-11-11T03:30:00.000Z');
});
test('duplicates choose highest sequence; reimport distinguishes identical and changed; sources remain isolated',()=>{
 const base=event('same','DTSTART:20261111T090000Z','SEQUENCE:1','SUMMARY:예전');const updated=event('same','DTSTART:20261111T090000Z','SEQUENCE:2','SUMMARY:수정');
 const a=parseIcs(calendar(base),options);const b=parseIcs(calendar(updated,base),options);assert.equal(b.events.length,1);assert.equal(b.events[0].title,'수정');assert.equal(b.duplicateComponents,1);assert.equal(previewDiff(b,a.events).changed,1);assert.equal(previewDiff(b,b.events).unchanged,1);
 const c=parseIcs(calendar(updated),{...options,sourceCalendarId:'공연',sourceName:'공연'});assert.notEqual(c.events[0].id,b.events[0].id);assert.equal(previewDiff(c,b.events).added,1);const missing=parseIcs(calendar(),options);assert.equal(previewDiff(missing,b.events).retained,1);
});
test('unbounded recurrences and unknown/invalid dates produce partial warnings',()=>{
 const many=parseIcs(calendar(event('many','DTSTART:20261101T090000Z','RRULE:FREQ=SECONDLY')),{...options,maxOccurrences:10});assert.equal(many.events.length,10);assert(many.partial);assert(many.warnings.some(w=>w.code==='LIMIT'));
 const mixed=parseIcs(calendar(event('bad','DTSTART;TZID=Unknown/Zone:20261111T090000'),event('bad-day','DTSTART;VALUE=DATE:20260230'),event('ok','DTSTART:20261111T090000Z')),options);assert.equal(mixed.events.length,1);assert(mixed.partial);assert.equal(mixed.skipped,2);
});
test('empty, malformed, too-large and invalid range inputs are rejected',()=>{
 assert.throws(()=>parseIcs('',options));assert.throws(()=>parseIcs('<html></html>',options));assert.throws(()=>parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nEND:VCALENDAR',options));assert.throws(()=>parseIcs('x'.repeat(5*1024*1024+1),options));assert.throws(()=>parseIcs(calendar(),{...options,to:'2028-11-30'}));
});
test('description folding, escapes and external HTML remain literal text',()=>{
 const result=parseIcs(calendar(event('text','DTSTART:20261111T090000Z','SUMMARY:안녕\\, 세상','DESCRIPTION:<img src=x onerror="alert(1)">\\n첫 줄','  이어짐','LOCATION:서울\\; 한국')),options);const e=result.events[0];assert.equal(e.title,'안녕, 세상');assert.equal(e.description,'<img src=x onerror="alert(1)">\n첫 줄 이어짐');assert.equal(e.location,'서울; 한국');
});

test('RDATE-only recurrence includes DTSTART unless EXDATE excludes it',()=>{
 const start='DTSTART;VALUE=DATE:20261103';const extra='RDATE;VALUE=DATE:20261120,20261125';
 assert.deepEqual(parseIcs(calendar(event('r',start,extra)),options).events.map(e=>e.wallStart),['2026-11-03','2026-11-20','2026-11-25']);
 assert.deepEqual(parseIcs(calendar(event('r',start,extra,'EXDATE;VALUE=DATE:20261103')),options).events.map(e=>e.wallStart),['2026-11-20','2026-11-25']);
});
test('THISANDFUTURE moves later occurrences but keeps their original IDs',()=>{
 const start=event('shift','DTSTART:20261108T090000Z','DTEND:20261108T100000Z','RRULE:FREQ=DAILY;COUNT=3');
 const override=event('shift','RECURRENCE-ID;RANGE=THISANDFUTURE:20261109T090000Z','DTSTART:20261109T110000Z','DTEND:20261109T120000Z');
 const original=parseIcs(calendar(start),options).events;const moved=parseIcs(calendar(start,override),options).events;
 assert.deepEqual(moved.map(e=>e.wallStart.slice(11,16)),['09:00','11:00','11:00']);assert.deepEqual(moved.map(e=>e.id),original.map(e=>e.id));
});

test('Notion reimport only reviews the selected file and finds omissions in its source and dates', () => {
 const saved = parseIcs(calendar(
  event('same','DTSTART;VALUE=DATE:20261102','SUMMARY:Same'),
  event('changed','DTSTART;VALUE=DATE:20261103','SUMMARY:Before'),
  event('missing','DTSTART;VALUE=DATE:20261104','SUMMARY:Missing'),
  event('outside','DTSTART;VALUE=DATE:20261127','SUMMARY:Outside'),
 ),options).events;
 const other = parseIcs(calendar(event('other','DTSTART;VALUE=DATE:20261104','SUMMARY:Other')),{
  ...options,sourceCalendarId:'다른 캘린더',sourceName:'다른 캘린더',
 }).events;
 const incoming = parseIcs(calendar(
  event('same','DTSTART;VALUE=DATE:20261102','SUMMARY:Same'),
  event('changed','DTSTART;VALUE=DATE:20261103','SUMMARY:After'),
  event('new','DTSTART;VALUE=DATE:20261106','SUMMARY:New'),
 ),{...options,to:'2026-11-10'});
 const stored = [...saved,...other].map(event=>({event,revision:event.uid}));
 const review = reviewImport(incoming,stored);
 assert.equal(review.unchanged,1);
 assert.deepEqual(review.remaining.map(item=>[item.event.uid,item.previous?.revision]),[['changed','changed'],['new',undefined]]);
 assert.deepEqual(review.omitted.map(item=>item.event.uid),['missing']);
 assert.deepEqual(reviewImport({...incoming,partial:true},stored).omitted,[]);
 const empty = reviewImport({...incoming,events:[]},stored);
 assert.equal(empty.remaining.length,0);
 assert.deepEqual(empty.omitted.map(item=>item.event.uid),['same','changed','missing']);
});
