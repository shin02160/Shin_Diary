import ICAL from 'ical.js';
import { Temporal } from '@js-temporal/polyfill';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DAY = 86400000;
const wall = time => time.toString().replace(/Z$/,'');
const isIana = name => {try {Temporal.Now.zonedDateTimeISO(name);return true;}catch{return false;}};
const asLocal = time => Temporal.PlainDateTime.from(wall(time));
function keyOf(time) {
 if(time.isDate)return 'DATE:'+wall(time);
 if(!time.zone||time.zone.tzid==='floating')return 'FLOAT:'+wall(time);
 return 'INSTANT:'+new Date(time.toUnixTime()*1000).toISOString();
}
function normalize(time) {
 if(!time || time.year<1000 || time.year>9999)throw new Error('INVALID_TIME');
 const local=wall(time);
 if(time.isDate){Temporal.PlainDate.from(local);return {value:{kind:'date',date:local},wall:local};}
 const zone=time.zone?.tzid;
 if(!zone || zone==='floating')return {value:{kind:'floating',local},wall:local};
 // Embedded VTIMEZONE definitions stay authoritative; IANA fallbacks are registered below.
 if(time.zone._diaryIana){const plain=asLocal(time);const zoned=plain.toZonedDateTime(zone,{disambiguation:'compatible'});if(!zoned.toPlainDateTime().equals(plain))throw new Error('DST_GAP');return {value:{kind:'zoned',instant:zoned.toInstant().toString(),timezone:zone},wall:local,zone};}
 const instant=new Date(time.toUnixTime()*1000).toISOString();
 return {value:{kind:'zoned',instant,timezone:isIana(zone)?zone:'UTC'},wall:local,zone:zone==='Z'?'UTC':zone};
}
/** @param {string} text @param {import('./types').PreviewOptions} options @returns {import('./types').PreviewResult} */
export function parseIcs(text,options) {
 if(typeof text!=='string'||!text.trim())throw new Error('빈 파일입니다. 일정을 내보낸 ICS 파일을 선택해 주세요.');
 if(new TextEncoder().encode(text).length>MAX_FILE_BYTES)throw new Error('파일은 5MB 이하로 선택해 주세요.');
 if(!/^\s*BEGIN:VCALENDAR(?:\r?\n)/i.test(text.replace(/^\uFEFF/,''))||!/END:VCALENDAR\s*$/i.test(text))throw new Error('올바른 VCALENDAR 형식의 ICS 파일이 아닙니다.');
 let from,to;try{if(!/^\d{4}-\d{2}-\d{2}$/.test(options.from)||!/^\d{4}-\d{2}-\d{2}$/.test(options.to))throw new Error();from=Temporal.PlainDate.from(options.from);to=Temporal.PlainDate.from(options.to);}catch{throw new Error('미리보기 날짜 범위를 확인해 주세요.');}
 if(from.year<1000||to.year>9999||Temporal.PlainDate.compare(from,to)>0||from.until(to,{largestUnit:'days'}).days>365)throw new Error('날짜 범위는 시작일부터 최대 366일로 선택해 주세요.');
 if(!options.sourceCalendarId?.trim()||options.sourceCalendarId.length>80||!options.sourceName?.trim()||options.sourceName.length>80)throw new Error('캘린더 이름을 80자 이내로 입력해 주세요.');
 let calendar;try{const raw=ICAL.parse(text.replace(/^\uFEFF/,''));if(raw[0]!=='vcalendar')throw new Error();calendar=new ICAL.Component(raw);}catch{throw new Error('파일 구조를 읽지 못했습니다. 한 캘린더씩 UTF-8 ICS로 다시 내보내 주세요.');}
 const components=calendar.getAllSubcomponents('vevent');
 if(components.length>5000)throw new Error('한 파일의 VEVENT는 최대 5,000개까지 처리합니다. 내보내기 기간을 줄여 주세요.');
 const warnings=new Map();let skipped=0,duplicateComponents=0,partial=false,iterations=0,characters=0;
 const warn=(code,message)=>{const current=warnings.get(code);warnings.set(code,{code,message,count:(current?.count||0)+1});};
 const limit=Math.min(2000,Math.max(1,options.maxOccurrences||2000));const iterationLimit=Math.min(40000,Math.max(1,options.maxIterations||40000));
 const started=Date.now();const deadline=()=>{if(Date.now()-started>2500)throw new Error('BUDGET');};
 const output=new Map();const importedAt=new Date().toISOString();
 ICAL.TimezoneService.reset();
 try {
  const embedded=new Set();for(const component of calendar.getAllSubcomponents('vtimezone')){const id=component.getFirstPropertyValue('tzid');if(id){embedded.add(id);ICAL.TimezoneService.register(component);}}
  for(const component of components)for(const property of component.getAllProperties()){
   const tzid=property.getParameter('tzid');
   if(typeof tzid!=='string'||ICAL.TimezoneService.has(tzid)||!isIana(tzid))continue;
   const zone=new ICAL.Timezone({tzid});zone._diaryIana=true;
   zone.utcOffset=time=>asLocal(time).toZonedDateTime(tzid,{disambiguation:'compatible'}).offsetNanoseconds/1e9;
   ICAL.TimezoneService.register(zone);
  }
  const groups=new Map();
  for(const component of components){
   deadline();const uid=component.getFirstPropertyValue('uid');if(typeof uid!=='string'||!uid.trim()||uid.length>1024){skipped++;warn('UID','UID가 없거나 너무 긴 일정은 제외했습니다.');continue;}
   let group=groups.get(uid);if(!group){group=[];groups.set(uid,group);}group.push(component);
  }
  const value=(component,name,fallback)=>component.hasProperty(name)?String(component.getFirstPropertyValue(name)??''):fallback;
  function validateZones(component){for(const p of component.getAllProperties()){
   const id=p.getParameter('tzid');if(id&&!ICAL.TimezoneService.has(id)&&!embedded.has(id))throw new Error('ZONE');
   if(['dtstart','dtend','recurrence-id','exdate','rdate'].includes(p.name)&&['date','date-time'].includes(p.type)){
    for(const raw of p.jCal.slice(3)){if(typeof raw!=='string')throw new Error('INVALID_TIME');if(p.type==='date')Temporal.PlainDate.from(raw);else Temporal.PlainDateTime.from(raw.replace(/Z$/,''));}
   }
  }}
  function add(event,master,start,end,instance){
   deadline();if(!start||!end||start.isDate!==end.isDate)throw new Error('INVALID_TIME');
   const a=normalize(start);const actualEnd=normalize(end);const order=end.compare(start);if(order<0||(start.isDate&&order===0)||a.value.kind!==actualEnd.value.kind)throw new Error('INVALID_TIME');
   const endDisplay=start.zone?._diaryIana&&end.zone!==start.zone&&actualEnd.value.kind==='zoned'?Temporal.Instant.from(actualEnd.value.instant).toZonedDateTimeISO(start.zone.tzid).toPlainDateTime().toString({smallestUnit:'second'}):wall(end.isDate||end.zone===start.zone?end:end.convertToZone(start.zone));
   const startDay=a.wall.slice(0,10);const endWall=endDisplay.length===10?endDisplay+'T00:00:00':endDisplay;
   if(startDay>options.to||endWall<options.from+'T00:00:00')return;
   const props=event.component;const base=master.component;
   const status=value(props,'status',value(base,'status','unknown')).toLowerCase();
   const id=JSON.stringify([options.sourceCalendarId,master.uid,instance]);
   const normalized={id,source:'NAVER_ICS',sourceCalendarId:options.sourceCalendarId,sourceName:options.sourceName,uid:master.uid,originalInstanceId:instance||undefined,title:value(props,'summary',value(base,'summary','제목 없는 일정')).slice(0,500)||'제목 없는 일정',start:a.value,end:actualEnd.value,endExclusive:true,location:value(props,'location',value(base,'location','')).slice(0,2000)||undefined,description:value(props,'description',value(base,'description','')).slice(0,20000),wallStart:a.wall,wallEnd:endDisplay,originalTimezone:a.zone,status:String(calendar.getFirstPropertyValue('method')||'').toUpperCase()==='CANCEL'?'cancelled':['confirmed','tentative','cancelled'].includes(status)?status:'unknown',isSample:false,importedAt};
   if(endWall===options.from+'T00:00:00'&&startDay<options.from)return;
   if(!output.has(id)&&output.size>=limit)throw new Error('LIMIT');
   const size=item=>item?item.title.length+item.description.length+(item.location?.length||0):0;
   const nextSize=characters-size(output.get(id))+size(normalized);if(nextSize>2000000)throw new Error('LIMIT');characters=nextSize;
   output.set(id,normalized);
  }
  function latest(list){return [...list].sort((a,b)=>Number(a.getFirstPropertyValue('sequence')||0)-Number(b.getFirstPropertyValue('sequence')||0)||String(a.getFirstPropertyValue('dtstamp')||'').localeCompare(String(b.getFirstPropertyValue('dtstamp')||''))).at(-1);}
  for(const [,group] of groups){
   let master;
   try{
    deadline();const originals=group.filter(c=>!c.hasProperty('recurrence-id'));const exceptions=group.filter(c=>c.hasProperty('recurrence-id'));
    if(!originals.length){warn('ORPHAN','반복 원본 없이 내보낸 수정 인스턴스는 독립 미리보기로 표시합니다.');for(const c of exceptions){validateZones(c);const item=new ICAL.Event(c,{exceptions:[]});if(!item.startDate)item.startDate=item.recurrenceId.clone();add(item,item,item.startDate,item.endDate,keyOf(item.recurrenceId));}continue;}
    duplicateComponents+=Math.max(0,originals.length-1);const component=latest(originals);validateZones(component);
    if(component.getAllProperties('rdate').some(p=>p.type==='period'))throw new Error('PERIOD');
    master=new ICAL.Event(component,{exceptions:[],strictExceptions:true});if(!master.startDate)throw new Error('INVALID_TIME');normalize(master.startDate);
    const chosen=new Map();
    for(const c of exceptions){validateZones(c);const rid=c.getFirstPropertyValue('recurrence-id');if(!rid)throw new Error('INVALID_TIME');const key=keyOf(rid);if(chosen.has(key)){duplicateComponents++;chosen.set(key,latest([chosen.get(key),c]));}else chosen.set(key,c);}
    const overrides=[];let lookahead=2;let durationDays=Math.ceil(Math.abs(master.duration.toSeconds())/86400)+2;
    for(const [key,c] of chosen){const exception=new ICAL.Event(c,{exceptions:[]});if(!exception.startDate){exception.startDate=exception.recurrenceId.clone();exception.duration=master.duration.clone();}master.relateException(exception);overrides.push([key,exception]);durationDays=Math.max(durationDays,Math.ceil(Math.abs(exception.duration.toSeconds())/86400)+2);if(exception.modifiesFuture())lookahead=Math.max(lookahead,Math.ceil(Math.abs(exception.startDate.toUnixTime()-exception.recurrenceId.toUnixTime())*1000/DAY)+2);}
    const seen=new Set();
    if(master.isRecurring()){
     const iterator=master.iterator();const until=to.add({days:lookahead}).toString();const earliest=from.subtract({days:lookahead+durationDays}).toString();const exactOverrides=new Map(overrides);let next;
     while((next=iterator.next())){
      iterations++;if(iterations>iterationLimit)throw new Error('ITERATIONS');deadline();
      const day=wall(next).slice(0,10);if(day>until)break;if(day<earliest)continue;
      const key=keyOf(next);const exact=exactOverrides.get(key);const detail=exact?{item:exact,startDate:exact.startDate,endDate:exact.endDate}:master.getOccurrenceDetails(next);seen.add(key);
      try{add(detail.item,master,detail.startDate,detail.endDate,key);}catch(error){if(['LIMIT','BUDGET'].includes(error.message))throw error;skipped++;warn(error.message==='DST_GAP'?'DST_GAP':'OCCURRENCE','존재하지 않는 현지 시각 또는 잘못된 반복 인스턴스는 제외했습니다.');}
     }
     // RecurExpansion starts from RDATE when there is no RRULE; RFC 5545 also includes DTSTART.
     if(!component.hasProperty('rrule')){
      const key=keyOf(master.startDate);const excluded=component.getAllProperties('exdate').some(p=>p.getValues().some(t=>keyOf(t)===key));
      if(!seen.has(key)&&!excluded){const first=exactOverrides.get(key)||master;add(first,master,first.startDate,first.endDate,key);seen.add(key);}
     }
    }else add(master,master,master.startDate,master.endDate,'');
    for(const [key,exception] of overrides)if(!seen.has(key))add(exception,master,exception.startDate,exception.endDate,key);
   }catch(error){
    partial=true;if(['LIMIT','ITERATIONS','BUDGET'].includes(error.message)){warn('LIMIT','처리 시간·반복 횟수·결과 수 상한에 도달했습니다. 일부 결과만 표시됩니다.');break;}
    skipped++;warn(error.message==='ZONE'?'ZONE':error.message==='PERIOD'?'PERIOD':'EVENT','시간대·날짜·반복 정의를 확인할 수 없는 일정은 제외했습니다. RDATE 기간형은 이번 단계에서 지원하지 않습니다.');
   }
  }
 }catch(error){if(error.message==='BUDGET'){partial=true;warn('LIMIT','처리 시간 상한에 도달했습니다. 일부 결과만 표시됩니다.');}else throw new Error('일정 정의를 처리하지 못했습니다. 파일을 다시 내보내 주세요.');}
 finally{ICAL.TimezoneService.reset();}
 if(duplicateComponents)warn('DUPLICATE','같은 UID·인스턴스가 중복되어 SEQUENCE와 DTSTAMP 기준의 최신 버전을 사용했습니다.');
 return {events:[...output.values()].sort((a,b)=>a.wallStart.localeCompare(b.wallStart)||a.id.localeCompare(b.id)),sourceCalendarId:options.sourceCalendarId,sourceName:options.sourceName,from:options.from,to:options.to,componentCount:components.length,duplicateComponents,skipped,partial:partial||skipped>0,warnings:[...warnings.values()]};
}
