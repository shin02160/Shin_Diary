"use client";
import { useEffect, useRef, useState } from 'react';
import { MAX_FILE_BYTES, previewDiff, wallLabel } from '@/lib/calendar/event-utils';
import { applyPreview, clearPreview, useIcsPreview } from '@/lib/calendar/preview-store';
import type { PreviewOptions, PreviewResult, WorkerReply } from '@/lib/calendar/types';
const mimeTypes = new Set(['','text/calendar','text/plain','application/octet-stream','application/ics','application/x-icalendar']);
export function IcsImport({ from:initialFrom,to:initialTo,onApply }: {from:string;to:string;onApply:(date:string)=>void}) {
 const {events,lastPreview}=useIcsPreview(); const [open,setOpen]=useState(false);const [file,setFile]=useState<File|null>(null);
 const [source,setSource]=useState('네이버 개인');const [from,setFrom]=useState(initialFrom);const [to,setTo]=useState(initialTo);
 const [busy,setBusy]=useState(false);const [result,setResult]=useState<PreviewResult|null>(null);const [ack,setAck]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const worker=useRef<Worker|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;worker.current?.terminate();if(timer.current)clearTimeout(timer.current);},[]);
 function stop(){generation.current++;worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;setBusy(false);}
 function reset(){setResult(null);setAck(false);setError('');setMessage('');}
 function toggle(){if(open){stop();reset();setFile(null);setOpen(false);}else{setFrom(initialFrom);setTo(initialTo);setOpen(true);}}
 async function parse(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;reset();
  if(!file||!file.name.toLowerCase().endsWith('.ics')||!mimeTypes.has(file.type.toLowerCase().split(';')[0])){setError('올바른 .ics 파일을 선택해 주세요.');return;}
  if(!file.size||file.size>MAX_FILE_BYTES){setError(file.size?'파일은 5MB 이하로 선택해 주세요.':'빈 파일입니다. 다른 ICS 파일을 선택해 주세요.');return;}
  if(!source.trim()||!from||!to||from>to||Date.parse(to)-Date.parse(from)>365*86400000){setError('캘린더 이름과 최대 366일의 날짜 범위를 확인해 주세요.');return;}
  const options:PreviewOptions={sourceCalendarId:source.trim(),sourceName:source.trim(),from,to};
  const job=++generation.current;setBusy(true);
  try {
   let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}catch{throw new Error('UTF-8 ICS 파일을 읽지 못했습니다. 다시 내보낸 파일을 선택해 주세요.');}
   if(job!==generation.current)return;
   const task=new Worker(new URL('../lib/calendar/ics-worker.mjs',import.meta.url),{type:'module'});worker.current=task;
   timer.current=setTimeout(()=>{if(job===generation.current){stop();setError('처리 시간이 초과됐습니다. 파일 기간을 줄여 다시 시도해 주세요.');}},6000);
   task.onmessage=(event:MessageEvent<WorkerReply>)=>{if(job!==generation.current)return;stop();if(event.data.ok)setResult(event.data.result);else setError(event.data.error);};
   task.onerror=()=>{if(job!==generation.current)return;stop();setError('파일을 처리하지 못했습니다. 다시 시도해 주세요.');};
   task.postMessage({text,options});
  }catch(e){if(job===generation.current){stop();setError(e instanceof Error?e.message:'ICS 파일을 읽지 못했습니다.');}}
 }
 function apply(){if(!result||(result.partial&&(!result.events.length||!ack)))return;try{applyPreview(result);const date=result.events[0]?.wallStart.slice(0,10) ?? result.from;onApply(date<result.from?result.from:date);setMessage(result.events.length ? `${result.events.length}개 일정을 달력 미리보기에 표시했습니다.` : '빈 기간을 Notion 저장본과 비교할 수 있습니다.');setOpen(false);setFile(null);setResult(null);setAck(false);setError('');}catch(e){setError(e instanceof Error?e.message:'미리보기에 표시하지 못했습니다.');}}
 const diff=result?previewDiff(result,events):null;
 return <section id="ics-import" className="ics-import-panel" aria-labelledby="ics-heading"><div className="ics-heading"><div><div className="eyebrow">NAVER CALENDAR · ICS</div><h2 id="ics-heading">외부 일정 미리보기</h2><p>네이버 PC 캘린더에서 내보낸 .ics 파일을 열어보세요. 파일은 이 탭에서만 처리됩니다.</p></div><button className="button primary" type="button" aria-expanded={open} aria-controls="ics-form-area" onClick={toggle}>{open?'가져오기 닫기':'외부 일정 가져오기'}</button></div>{lastPreview && <div className="form-actions"><span className="status status-active">현재 탭 · {events.length}개 일정</span><button type="button" className="text-button" onClick={()=>{clearPreview();setMessage('현재 탭의 가져온 일정 미리보기를 비웠습니다.');}}>미리보기 비우기</button></div>}{message&&<p role="status" className="ics-status">{message}</p>}{open&&<div id="ics-form-area"><form className="editor-form ics-form" onSubmit={parse}><label>네이버 캘린더 파일 (.ics)<input type="file" accept=".ics,text/calendar" disabled={busy} required onChange={e=>{setFile(e.target.files?.[0]||null);reset();}}/></label><label>캘린더 구분 이름<input value={source} disabled={busy} maxLength={80} required onChange={e=>{setSource(e.target.value);reset();}}/></label><p className="muted">같은 캘린더를 다시 확인할 때는 같은 이름을 써 주세요.</p><div className="form-grid"><label>미리보기 시작일<input type="date" value={from} required disabled={busy} onChange={e=>{setFrom(e.target.value);reset();}}/></label><label>미리보기 종료일<input type="date" value={to} required disabled={busy} onChange={e=>{setTo(e.target.value);reset();}}/></label></div><p className="muted">파일당 5MB, 날짜 범위 최대 366일. 첨부파일과 범주 색상은 표시되지 않습니다.</p><div className="form-actions"><button className="button primary" type="submit" disabled={busy}>{busy?'파일 처리 중…':'파일 미리보기'}</button>{busy&&<button type="button" className="button" onClick={()=>{stop();setMessage('파일 처리를 중단했습니다.');}}>처리 중단</button>}</div></form>{error&&<p className="form-error" role="alert">{error}</p>}{result&&diff&&<div className="ics-result" aria-live="polite"><h3>가져오기 미리보기</h3><p>{result.sourceName} · {result.from} ~ {result.to} · 파일 일정 정의 {result.componentCount}개</p><div className="ics-counts"><span>표시 {result.events.length}개</span><span>신규 {diff.added}개</span><span>동일 {diff.unchanged}개</span><span>변경 {diff.changed}개</span><span>이번 파일에 없는 기존 일정 {diff.retained}개 유지</span></div>{result.warnings.length>0&&<ul className="ics-warnings">{result.warnings.map(w=><li key={w.code}>{w.message} ({w.count}건)</li>)}</ul>}{result.partial&&<label className="checkbox-label"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>일부 일정이 제외됐음을 확인했어요</label>}{result.events.length>0?<ul className="ics-preview-list">{result.events.slice(0,5).map(e=><li key={e.id}><strong>{e.title}</strong><span>{wallLabel(e.wallStart)}</span></li>)}{result.events.length>5&&<li>외 {result.events.length-5}개 · 달력에서 확인</li>}</ul>:<p>선택한 기간에 표시할 일정이 없습니다. 날짜 범위를 확인해 주세요.</p>}<button className="button primary" type="button" disabled={result.partial&&(!result.events.length||!ack)} onClick={apply}>{result.events.length ? '달력에 표시' : '빈 기간 비교 준비'}</button><p className="muted">새로고침하거나 탭을 닫으면 미리보기는 사라집니다.</p></div>}</div>}</section>;
}
