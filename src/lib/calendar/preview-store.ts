"use client";
import { useSyncExternalStore } from 'react';
import type { ImportedEvent, PreviewResult } from './types';
interface State {events:ImportedEvent[];lastPreview?:string;latest?:PreviewResult}
const initial:State={events:[]};let snapshot=initial;const listeners=new Set<()=>void>();
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function useIcsPreview(){return useSyncExternalStore(subscribe,()=>snapshot,()=>initial);}
export function applyPreview(result:PreviewResult){
 const map=new Map(snapshot.events.map(e=>[e.id,e]));for(const event of result.events)map.set(event.id,event);
 if(map.size>5000)throw new Error('현재 미리보기는 최대 5,000개입니다. 미리보기를 비운 후 다시 가져와 주세요.');
 snapshot={events:[...map.values()],lastPreview:new Date().toISOString(),latest:result};listeners.forEach(fn=>fn());
}
export function clearPreview(){snapshot={events:[]};listeners.forEach(fn=>fn());}
