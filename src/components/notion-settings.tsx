"use client";
import { useEffect, useRef, useState } from 'react';
import { useArchive } from '@/lib/local-store';
import { api, keepLocal, pullRemote, pushOne, SyncError, uploadPlan, acceptRemote } from '@/lib/notion-sync';
import { dateLabel } from '@/lib/dates';
import { statusLabels, categoryLabels } from '@/lib/sample-data';
import type { ArchiveRecord, RemoteRecord } from '@/lib/archive-schema';
function VersionPreview({record}:{record?:ArchiveRecord}) {
 if(!record) return <p>브라우저에 기록이 없습니다.</p>;
 return <div className="version-preview"><h4>{'name' in record ? record.name : record.title || '제목 없는 기록'}</h4><p>{categoryLabels[record.category]} · {'lifecycleStatus' in record ? statusLabels[record.lifecycleStatus] + (record.isArchived ? ' · 아카이브' : '') : dateLabel(record.occurredAt)}</p><p className="preserve-lines">{'content' in record ? record.content : record.summary}</p>{'lastProgress' in record && record.lastProgress && <p>마지막 진행: {record.lastProgress}</p>}{'nextStep' in record && record.nextStep && <p>다음 행동: {record.nextStep}</p>}{'resumeNotes' in record && record.resumeNotes && <p className="preserve-lines">재개 메모: {record.resumeNotes}</p>}{'satisfactionNote' in record && record.satisfactionNote && <p>만족 메모: {record.satisfactionNote}</p>}{'parkedAt' in record && record.parkedAt && <p>최근 중단: {record.parkedAt}</p>}{'createdAt' in record && <p>작성 시각: {record.createdAt}</p>}{'references' in record && record.references?.map(url=><p key={url}>{url}</p>)}{'sourceLinks' in record && record.sourceLinks?.map(url=><p key={url}>{url}</p>)}{'mood' in record && record.mood && <p>감정: {record.mood}</p>}{'place' in record && record.place && <p>장소: {record.place}</p>}<p>{record.tags.map(t=>'#'+t).join(' ')}</p></div>;
}
export function NotionSettings() {
 const archive = useArchive();
 const [status,setStatus] = useState<{configured:boolean;authenticated:boolean;readOnly?:boolean;readOnlyRequiresLogin?:boolean;siteLocked?:boolean} | null>(null);
 const [password,setPassword] = useState(''); const [busy,setBusy] = useState(false); const lock = useRef(false);
 const [message,setMessage] = useState(''); const [failed,setFailed] = useState(false); const [conflicts,setConflicts] = useState<RemoteRecord[]>([]); const [retryAt,setRetryAt] = useState(0);
 useEffect(()=>{ let alive=true; api<{configured:boolean;authenticated:boolean;readOnly?:boolean;readOnlyRequiresLogin?:boolean;siteLocked?:boolean}>('status').then(value=>{if(alive)setStatus(value);}).catch(()=>{if(alive){setFailed(true);setMessage('서버 연결 상태를 확인하지 못했습니다. 다시 확인해 주세요.');}}); return ()=>{alive=false;}; },[]);
 const plan = uploadPlan(archive);
 async function perform(action:()=>Promise<string>) {
  if (lock.current) return;
  if (Date.now()<retryAt) {setMessage(`${Math.ceil((retryAt-Date.now())/1000)}초 후 다시 시도해 주세요.`);setFailed(true);return;}
  lock.current=true;setBusy(true);setFailed(false);setMessage('처리 중…');
  try {setMessage(await action());} catch(error) {
   setFailed(true); setMessage(error instanceof Error ? error.message : '처리하지 못했습니다.');
   if(error instanceof SyncError) {
    if(error.retryAfter){setRetryAt(Date.now()+error.retryAfter*1000);setMessage(error.message+` ${error.retryAfter}초 후 다시 시도해 주세요.`);}
    if(error.status===401) setStatus(s=>s ? {...s,authenticated:false}:s);
    if(error.conflict) { const item=error.conflict;setConflicts(current=>[...current.filter(c=>c.kind!==item.kind || c.record.id!==item.record.id),item]); }
   }
  } finally {lock.current=false;setBusy(false);}
 }
 async function login(event:React.FormEvent<HTMLFormElement>){event.preventDefault();await perform(async()=>{await api('session','POST',{password});setPassword('');setStatus(current=>current ? {...current,authenticated:true} : current);return '로그인했습니다.';});}
 return <section className="resume-panel notion-panel"><div className="eyebrow">NOTION</div><h2>{status?.readOnly ? 'Notion 기록 불러오기' : 'Notion에 보관하기'}</h2>{!status?.readOnly && <p>브라우저에서 남긴 변경은 아래 버튼으로 직접 반영합니다. 샘플 기록은 보내지 않으며, 내 기록에 연결된 샘플 활동은 함께 저장합니다.</p>}{status===null ? <p>연결 상태 확인 중…</p> : !status.configured ? <div className="connection-empty"><strong>서버 연결 설정이 필요해요</strong><p>앱 전용 Activities·Entries와 서버 환경변수를 준비한 뒤 서버를 재시작하세요. 설정 전에도 브라우저 기록은 계속 사용할 수 있습니다.</p></div> : status.readOnly && (!status.readOnlyRequiresLogin || status.authenticated) ? <><p>{status.readOnlyRequiresLogin ? '읽기 전용 · 로그인됨' : '읽기 전용 · 이 PC'}</p><div className="form-actions"><button className="button primary" disabled={busy || !!archive.error} onClick={()=>void perform(async()=>{
   const found=await pullRemote();
   setConflicts(found);
   return found.length ? 'Notion 기록을 불러왔습니다. 내용이 다른 항목은 아래에서 확인하세요.' : 'Notion 기록을 불러왔습니다.';
  })}>Notion에서 불러오기</button>{status.readOnlyRequiresLogin && <button className="text-button" disabled={busy} onClick={()=>void perform(async()=>{
   if (status.siteLocked) {
    const response = await fetch('/api/site/session', { method: 'DELETE' });
    if (!response.ok) throw new Error('사이트 잠금을 다시 설정하지 못했습니다.');
    location.replace('/unlock');
    return '';
   }
   await api('session','DELETE');
   setStatus(current=>current ? {...current,authenticated:false} : current);
   setConflicts([]);
   return '로그아웃했습니다.';
  })}>로그아웃</button>}</div></> : !status.authenticated ? <form className="editor-form" onSubmit={login}><label>앱 비밀번호<input type="password" autoComplete="current-password" required maxLength={1000} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary" disabled={busy} type="submit">연결 로그인</button></form> : <><span className="status status-active">로그인됨 · 수동 반영</span><p>반영 대기: 활동 {plan.filter(i=>i.kind==='activity').length}개 · 기록 {plan.filter(i=>i.kind==='entry').length}개</p><div className="form-actions"><button className="button primary" disabled={busy || !!archive.error || !archive.ready || plan.length===0} onClick={()=>void perform(async()=>{let saved=0;for(const item of plan){setMessage(`${saved+1}/${plan.length} Notion에 저장 중…`);await pushOne(item);saved++;}return `${saved}개를 Notion에 반영했습니다.`;})}>브라우저 기록 Notion에 저장</button><button className="button" disabled={busy || !!archive.error} onClick={()=>void perform(async()=>{const found=await pullRemote();setConflicts(found);return found.length ? `충돌 ${found.length}건은 브라우저 내용을 유지했습니다. 아래에서 확인하세요.` : 'Notion 기록을 불러왔습니다. 미반영 로컬 변경은 유지됩니다.';})}>Notion에서 불러오기</button><button className="text-button" disabled={busy} onClick={()=>void perform(async()=>{await api('session','DELETE');setStatus({configured:true,authenticated:false});setConflicts([]);return '로그아웃했습니다. 브라우저 기록은 유지됩니다.';})}>로그아웃</button></div></>}{(!status || !status.configured) && <button className="button" disabled={busy} onClick={()=>void perform(async()=>{setStatus(await api('status'));return '서버 설정 상태를 확인했습니다.';})}>연결 상태 다시 확인</button>}{message && <p role={failed ? 'alert' : 'status'} className={failed?'form-error':''}>{message}</p>}{conflicts.map(item=>{const local=item.kind==='activity'?archive.activities.find(a=>a.id===item.record.id):archive.entries.find(e=>e.id===item.record.id);return <div className="sync-conflict" key={item.kind+item.record.id}><h3>같은 기록의 두 버전</h3><div className="form-grid"><div><h4>이 브라우저</h4><VersionPreview record={local}/></div><div><h4>Notion</h4><VersionPreview record={item.record}/></div></div><div className="form-actions"><button className="button" disabled={busy} onClick={()=>void perform(async()=>{await acceptRemote(item,local);setConflicts(c=>c.filter(v=>v!==item));return 'Notion 내용을 브라우저에 적용했습니다.';})}>Notion 내용 사용</button>{!status?.readOnly && <button className="button" disabled={busy} onClick={()=>void perform(async()=>{await keepLocal(item,local);setConflicts(c=>c.filter(v=>v!==item));return '내 내용을 Notion에 반영했습니다.';})}>내 내용으로 Notion에 반영</button>}</div></div>;})}<p className="muted">Notion 토큰은 서버에서만 사용합니다. 삭제·휴지통 이동을 자동 반영하지 않으며, 부분 실패 시 완료된 항목은 유지하고 남은 항목을 다시 시도합니다.</p></section>;
}
