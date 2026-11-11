import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3104';
const filename='http-test-'+randomUUID()+'.sqlite';
const password='isolated-test-password-12345';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3104','--hostname','127.0.0.1'],{cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,DIARY_NOTION_READ_ONLY:'false',NOTION_TOKEN:'fake-token-no-network-calls',NOTION_ACTIVITIES_DATA_SOURCE_ID:'11111111-1111-4111-8111-111111111111',NOTION_ENTRIES_DATA_SOURCE_ID:'22222222-2222-4222-8222-222222222222',DIARY_PASSWORD:password,DIARY_SESSION_SECRET:'isolated-http-test-secret-more-than-32-characters',DIARY_APP_ORIGIN:origin,DIARY_STATE_FILE:filename}});
let output='';let ready=false;
const checks=[];const check=(ok,name)=>{assert(ok,name);checks.push(name);};
const timeout=setTimeout(()=>{console.error('HTTP verification server readiness timeout');process.exitCode=1;child.kill();},20000);
child.stderr.on('data',()=>{});
child.stdout.on('data',async chunk=>{
 output+=chunk.toString();if(ready||!output.includes('Ready'))return;ready=true;clearTimeout(timeout);
 try{
 const status=await fetch(origin+'/api/notion/status');const state=await status.json();check(state.configured&&!state.authenticated,'Configured status without authentication');check(!JSON.stringify(state).includes('fake-token'),'No credential in public status');
 const anonymous=await fetch(origin+'/api/notion/archive');const anonymousBody=await anonymous.json();check(anonymous.status===401,'Actual GET route rejects anonymous request: '+anonymous.status+' '+JSON.stringify(anonymousBody));
 const post=(path,body,cookie='',source=origin)=>fetch(origin+'/api/notion/'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:source,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 check((await post('session',{password},'','https://evil.example')).status===403,'Actual login rejects cross-origin request');
 check((await post('session',{password:'wrong'})).status===401,'Actual login rejects wrong password');
 const logged=await post('session',{password});check(logged.status===200,'Actual login succeeds');const setCookie=logged.headers.get('set-cookie')||'';check(setCookie.includes('HttpOnly')&&setCookie.includes('SameSite=Strict')&&setCookie.includes('Path=/api/notion'),'Session cookie security flags');const cookie=setCookie.split(';')[0];
 const loggedStatus=await (await fetch(origin+'/api/notion/status',{headers:{Cookie:cookie}})).json();check(loggedStatus.authenticated,'Actual status verifies signed cookie');
 check((await post('archive',{kind:'invalid'},cookie)).status===400,'Authenticated malformed record blocked before Notion request');
 check((await post('archive',{kind:'invalid'},cookie,'https://evil.example')).status===403,'Actual archive mutation rejects cross-origin request');
 const oversized=await post('archive',{data:'x'.repeat(257000)},cookie);check(oversized.status===413,'Actual route enforces request size cap');
 check((await fetch(origin+'/api/notion/archive',{headers:{Cookie:cookie+'bad'}})).status===401,'Forged cookie rejected by actual route');
 const travel=await fetch(origin+'/api/notion/travel');
 check(travel.status===401,'Travel source lookup rejects anonymous access');
 check((await post('link-preview',{url:'https://127.0.0.1/'})).status===400,'Link preview rejects loopback before opening a connection');
 check((await post('link-preview',{url:'https://example.org/'},'','https://evil.example')).status===403,'Link preview rejects cross-origin requests');
 const logout=await fetch(origin+'/api/notion/session',{method:'DELETE',headers:{Origin:origin,Cookie:cookie}});check(logout.status===200&&(logout.headers.get('set-cookie')||'').includes('Max-Age=0'),'Logout expires browser cookie');
 console.log(JSON.stringify({passed:checks.length,checks}));
 }catch(error){console.error(error.message);process.exitCode=1;}finally{child.kill();}
});
await once(child,'exit');clearTimeout(timeout);
// Remove only files from this run; the app's regular journal is never touched.
for(const suffix of ['', '-wal', '-shm']){try{unlinkSync(join(process.cwd(),'.data',filename+suffix));}catch(error){if(error.code!=='ENOENT')throw error;}}
