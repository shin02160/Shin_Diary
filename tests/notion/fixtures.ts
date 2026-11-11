import { randomUUID } from 'node:crypto';
import type { Config } from '../../src/lib/server/config.ts';
import { AppError } from '../../src/lib/server/config.ts';
import { NotionError, type Transport } from '../../src/lib/server/notion-client.ts';
import { schemas, readText, type NotionPage, type Property } from '../../src/lib/server/notion-mapping.ts';
import type { Activity, Entry } from '../../src/lib/types.ts';
export const config: Config = {token:'test-token-never-sent',activitiesId:'11111111-1111-4111-8111-111111111111',entriesId:'22222222-2222-4222-8222-222222222222',password:'test-password-123456',secret:'test-session-secret-that-is-at-least-32-characters',origin:'http://localhost:3102',statePath:':memory:'};
export const activity = (): Activity => ({id:randomUUID(),name:'산책',category:'Daily',lifecycleStatus:'active',isArchived:false,summary:'느리게 걷기',tags:[],references:[],isSample:false});
export const entry = (activityId?:string): Entry => ({id:randomUUID(),content:'오늘도 좋았다',occurredAt:{kind:'date',date:'2026-11-11'},createdAt:'2026-11-11T00:00:00.000Z',category:'Daily',tags:[],activityId,isSample:false});
export class FakeNotion implements Transport {
 pages = new Map<string,NotionPage>(); parents = new Map<string,string>(); creates = 0; patches = 0;
 mode: 'normal'|'committed-timeout'|'lost-timeout'|'rate-limit' = 'normal'; schemaBroken = false;
 async call<T>(path:string,method='GET',body?:unknown):Promise<T> {
  const b = body as {parent?:{data_source_id:string};properties?:Record<string,Property>;filter?:{rich_text?:{equals?:string}}};
  if(path === '/data_sources/'+config.activitiesId || path === '/data_sources/'+config.entriesId) {
   const kind = path.endsWith(config.activitiesId)?'activity':'entry';
   const properties = Object.fromEntries(Object.entries(schemas[kind]).map(([name,type])=>[name,{type,...(name==='Activity'?{relation:{data_source_id:config.activitiesId}}:{})}]));
   if(this.schemaBroken) delete properties['App ID'];
   return {properties} as T;
  }
  if(path.endsWith('/query')) {
   const parent = path.split('/')[2]; const id=b?.filter?.rich_text?.equals;
   return {results:[...this.pages.values()].filter(p=>this.parents.get(p.id)===parent && (!id || readText(p.properties['App ID'])===id)),has_more:false} as T;
  }
  if(path==='/pages' && method==='POST') {
   this.creates++;
   if(this.mode==='rate-limit') throw new NotionError(429,'test limited',2);
   if(this.mode==='lost-timeout') throw new AppError(502,'test timeout before response');
   const page:NotionPage={id:randomUUID(),object:'page',properties:b.properties!};this.pages.set(page.id,page);this.parents.set(page.id,b.parent!.data_source_id);
   if(this.mode==='committed-timeout') throw new AppError(502,'test committed but response lost');
   return page as T;
  }
  const id=path.split('/')[2]; const page=this.pages.get(id);
  if(!page) throw new Error('Unexpected fake path '+path);
  if(method==='PATCH'){this.patches++;page.properties={...page.properties,...b.properties};}
  return page as T;
 }
}
