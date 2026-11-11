'use client';

import { useState } from 'react';
import { travelLabels, type TravelReferences } from '@/lib/entry-extras';
import { api } from '@/lib/notion-sync';

type Kind = keyof TravelReferences;
interface Option { name: string; url: string }
export function TravelReferencePicker({ onChoose }: { onChoose: (kind: Kind, url: string) => void }) {
 const [trips, setTrips] = useState<{ id: string; name: string }[]>();
 const [trip, setTrip] = useState('');
 const [resources, setResources] = useState<Record<Kind, Option[]>>();
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);

 async function load(id?: string) {
  setBusy(true);
  setError('');
  try {
   if (id) {
    const result = await api<{ resources: Record<Kind, Option[]> }>('travel?trip=' + encodeURIComponent(id));
    setResources(result.resources);
   } else {
    const result = await api<{ trips: { id: string; name: string }[] }>('travel');
    setTrips(result.trips);
   }
  } catch (failure) {
   setError(failure instanceof Error ? failure.message : '여행 자료를 읽지 못했습니다.');
  } finally { setBusy(false); }
 }

 return (
  <div>
   {!trips && <button className="button" type="button" disabled={busy} onClick={() => void load()}>Travel Hub 여행 불러오기</button>}
   {trips?.length === 0 && <p>연결된 여행이 없어요.</p>}
   {!!trips?.length && <>
    <label>Travel Hub 여행<select value={trip} disabled={busy} onChange={event => { setTrip(event.target.value); setResources(undefined); }}>
     <option value="">여행 선택</option>
     {trips.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <button className="button" type="button" disabled={busy || !trip} onClick={() => void load(trip)}>선택한 여행 자료 불러오기</button>
   </>}
   {busy && <p role="status">여행 자료를 불러오는 중…</p>}
   {error && <p role="alert" className="form-error">{error}</p>}
   {resources && (Object.entries(travelLabels) as [Kind, string][]).map(([kind, label]) => (
    <label key={kind}>{label} 선택<select value="" onChange={event => {
     if (event.target.value) onChoose(kind, event.target.value);
    }}>
     <option value="">{resources[kind].length ? '링크 칸에 넣기' : '자료 없음'}</option>
     {resources[kind].map(item => <option key={item.url} value={item.url}>{item.name}</option>)}
    </select></label>
   ))}
  </div>
 );
}
