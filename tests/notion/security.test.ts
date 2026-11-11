import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticated, authorize, issueSession, passwordMatches, readJson, sameOrigin } from '../../src/lib/server/auth.ts';
import { NotionClient, NotionError } from '../../src/lib/server/notion-client.ts';
import { Journal } from '../../src/lib/server/journal.ts';
import { config } from './fixtures.ts';
const request = (cookie:string,origin=config.origin) => new Request(config.origin+'/api/notion/archive',{method:'POST',headers:{cookie:'diary_session='+cookie,origin}});
test('signed sessions reject forgery, expiry, secret rotation and password rotation',()=>{
 const now=Date.now();const token=issueSession(config,now);assert(authenticated(request(token),config,now));assert(!authenticated(request(token+'x'),config,now));assert(!authenticated(request(token),config,now+9*60*60_000));assert(!authenticated(request(token),{...config,secret:'another secret'},now));assert(!authenticated(request(token),{...config,password:'changed password'},now));assert(passwordMatches(config.password,config));assert(!passwordMatches('wrong',config));
});
test('unauthenticated access and cross-origin mutations are blocked',()=>{
 assert.throws(()=>authorize(request(''),config));const signed=issueSession(config);assert.throws(()=>authorize(request(signed,'https://evil.example'),config));assert.throws(()=>sameOrigin(new Request(config.origin+'/api/notion/session',{method:'POST'}),config));authorize(request(signed),config);
});
test('request body is bounded even without Content-Length and malformed JSON is rejected',async()=>{
 await assert.rejects(readJson(new Request(config.origin,{method:'POST',headers:{'content-type':'application/json'},body:'"'+'x'.repeat(100)+'"'}),20));await assert.rejects(readJson(new Request(config.origin,{method:'POST',headers:{'content-type':'application/json'},body:'{broken'})));await assert.rejects(readJson(new Request(config.origin,{method:'POST',body:'{}'})));
});
test('Notion transport pins API version, keeps token in headers, and respects Retry-After without busy retry',async()=>{
 let count=0;const fetcher:typeof fetch=async (_url,init)=>{count++;const headers=new Headers(init?.headers);assert.equal(headers.get('notion-version'),'2026-03-11');assert.equal(headers.get('authorization'),'Bearer test-secret');return new Response('{}',{status:429,headers:{'Retry-After':'10'}});};
 const client=new NotionClient('test-secret',fetcher);await assert.rejects(client.call('/data_sources/test'),(e:unknown)=>e instanceof NotionError && e.retryAfter===10);await assert.rejects(client.call('/data_sources/test'));assert.equal(count,1);
});
test('Notion overload and authentication errors surface as failures without response-body leakage',async()=>{
 const overload=new NotionClient('secret',async()=>new Response('{"secret":"never log me"}',{status:529,headers:{'Retry-After':'3'}}));await assert.rejects(overload.call('/pages'),(e:unknown)=>e instanceof NotionError && e.status===529 && e.retryAfter===3 && !e.message.includes('never log me'));
 const unauthorized=new NotionClient('secret',async()=>new Response('private upstream error',{status:401}));await assert.rejects(unauthorized.call('/pages'),(e:unknown)=>e instanceof NotionError && e.upstreamStatus===401 && !e.message.includes('private'));
});
test('persistent login limiter rejects sustained guessing',()=>{
 const journal=new Journal(':memory:');try{for(let i=0;i<10;i++)journal.allowLogin('owner');assert.throws(()=>journal.allowLogin('owner'));}finally{journal.close();}
});

test('canonical localhost request URL accepts correct Host and rejects forged Host',()=>{
 const mapped={...config,origin:'http://127.0.0.1:3102'};const token=issueSession(mapped);const proxied=new Request('http://localhost:3102/api/notion/archive',{method:'POST',headers:{Host:'127.0.0.1:3102',Origin:mapped.origin,Cookie:'diary_session='+token}});authorize(proxied,mapped);
 const foreign=new Request(config.origin+'/api/notion/archive',{method:'POST',headers:{Host:'evil.example',Origin:config.origin,Cookie:'diary_session='+token}});assert.throws(()=>authorize(foreign,config));
});
