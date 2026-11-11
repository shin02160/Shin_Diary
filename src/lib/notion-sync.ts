"use client";
import { contentOf, decode, pending, type ArchiveRecord, type RecordKind, type RemoteRecord } from './archive-schema';
import { mutate, type Archive } from './local-store';
import type { Activity, Entry } from './types';
export class SyncError extends Error {
 constructor(message: string, public status: number, public retryAfter?: number, public conflict?: RemoteRecord) { super(message); }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
 let response: Response;
 try { response = await fetch('/api/notion/'+path,{method,credentials:'same-origin',cache:'no-store',headers:body === undefined ? undefined : {'Content-Type':'application/json'},body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(90_000)}); } catch { throw new SyncError('서버에 연결하지 못했습니다. 브라우저 기록은 유지됩니다.',0); }
 let value: {error?:string;conflict?:RemoteRecord};
 try { value = await response.json(); } catch { throw new SyncError('서버 응답을 확인할 수 없습니다. 브라우저 기록은 유지됩니다.',502); }
 if (!response.ok) throw new SyncError(value.error || 'Notion 요청을 완료하지 못했습니다.',response.status,Number(response.headers.get('retry-after')) || undefined,value.conflict);
 return value as T;
}
export function uploadPlan(archive: Archive): RemoteRecord[] {
 const ownEntries = archive.entries.filter(pending);
 const needed = new Set(ownEntries.map(e=>e.activityId).filter(Boolean));
 const ownActivities = archive.activities.filter(a=>pending(a) || (a.isSample && needed.has(a.id))).map(a=>({...a,isSample:false}));
 return [...ownActivities.map(record=>({kind:'activity' as const,record})),...ownEntries.map(record=>({kind:'entry' as const,record}))];
}
export async function acknowledge(source: RemoteRecord, result: RemoteRecord) {
 await mutate(current=>{
  if (result.kind !== source.kind || result.record.id !== source.record.id || !result.record.notion) throw new Error('Notion 저장 응답의 식별자가 다릅니다.');
  if (result.kind === 'activity') return {...current,activities:current.activities.map(a=>a.id !== source.record.id ? a : contentOf(a) === contentOf(source.record) ? result.record as Activity : {...a,notion:result.record.notion,syncPending:true})};
  return {...current,entries:current.entries.map(e=>e.id !== source.record.id ? e : contentOf(e) === contentOf(source.record) ? result.record as Entry : {...e,notion:result.record.notion,syncPending:true})};
 });
}
export async function pushOne(item: RemoteRecord) { const result = await api<RemoteRecord>('archive','POST',item); await acknowledge(item,result); }
export async function pullRemote(): Promise<RemoteRecord[]> {
 const remote = await api<{activities:Activity[];entries:Entry[]}>('archive');
 decode(JSON.stringify({version:1,revision:0,...remote}));
 const conflicts: RemoteRecord[] = [];
 await mutate(current=>{
  function merge<T extends ArchiveRecord>(local: T[], incoming: T[], kind: RecordKind): T[] {
   const map = new Map(local.map(item=>[item.id,item]));
   for (const item of incoming) {
    const old = map.get(item.id);
    if (old && pending(old) && contentOf(old) !== contentOf(item)) {
     if (!old.notion || old.notion.hash !== item.notion?.hash) conflicts.push({kind,record:item});
     continue;
    }
    map.set(item.id,item);
   }
   return [...map.values()];
  }
  return {...current,activities:merge(current.activities,remote.activities,'activity'),entries:merge(current.entries,remote.entries,'entry')};
 });
 return conflicts;
}
export async function acceptRemote(item: RemoteRecord, expected?: ArchiveRecord) {
 await mutate(current=>{
  const present = item.kind === 'activity' ? current.activities.find(a=>a.id === item.record.id) : current.entries.find(e=>e.id === item.record.id);
  if (!present || (expected && contentOf(present) !== contentOf(expected))) throw new Error('브라우저 기록이 변경되었습니다. 최신 내용을 다시 확인해 주세요.');
  if (item.kind === 'activity') return {...current,activities:current.activities.map(a=>a.id === item.record.id ? item.record as Activity : a)};
  return {...current,entries:current.entries.map(e=>e.id === item.record.id ? item.record as Entry : e)};
 });
}
export async function keepLocal(item: RemoteRecord, expected?: ArchiveRecord) {
 let source: RemoteRecord | undefined;
 await mutate(current=>{
  const record = item.kind === 'activity' ? current.activities.find(a=>a.id === item.record.id) : current.entries.find(e=>e.id === item.record.id);
  if (!record) throw new Error('브라우저 기록을 찾을 수 없습니다.');
  if (expected && contentOf(record) !== contentOf(expected)) throw new Error('브라우저 기록이 변경되었습니다. 최신 내용을 다시 확인해 주세요.');
  source = {kind:item.kind,record:{...record,notion:item.record.notion,isSample:false,syncPending:true}};
  return current;
 });
 if (source) await pushOne(source);
}
