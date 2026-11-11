/* eslint-disable @typescript-eslint/no-unused-expressions -- Function evaluated by playwright-cli. */
async page => {
 page.setDefaultTimeout(10000);
 const origin=await page.evaluate(()=>location.origin);const checks=[];const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const check=(ok,name)=>{if(!ok)throw new Error(name);checks.push(name);};
 const go=async path=>{await page.goto(origin+path);await page.locator('main h1').waitFor();};
 const data=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mlu.archive.v1')));
 const activityId='33333333-3333-4333-8333-333333333333';const entryId='44444444-4444-4444-8444-444444444444';
 const activity={id:activityId,name:'브라우저 활동',category:'Daily',lifecycleStatus:'active',isArchived:false,summary:'로컬에서 시작',tags:[],isSample:false};
 const entry={id:entryId,content:'브라우저 기록',category:'Daily',occurredAt:{kind:'date',date:'2026-11-11'},createdAt:'2026-11-11T00:00:00.000Z',tags:[],activityId,isSample:false};
 let loggedIn=false;let failEntry=true;let serial=0;const remote=new Map();const attempts={activity:0,entry:0};
 try {
 await go('/settings');await page.getByText('서버 연결 설정이 필요해요',{exact:true}).waitFor();check(true,'Unconfigured state is explicit');
 const real=await page.request.get(origin+'/api/notion/archive');check(real.status()===503,'Unconfigured server refuses archive access');
 const status=await (await page.request.get(origin+'/api/notion/status')).json();check(Object.keys(status).sort().join(',')==='authenticated,configured','Status exposes no secrets');
 await page.evaluate(({activity,entry})=>{localStorage.setItem('mlu.archive.v1',JSON.stringify({version:1,revision:0,activities:[activity],entries:[entry]}));sessionStorage.removeItem('mlu.capture.draft.v1');},{activity,entry});
 await page.route('**/api/notion/**',async route=>{
  const request=route.request();const path=request.url().split('/api/notion/')[1];const method=request.method();
  const reply=(status,json)=>route.fulfill({status,json,headers:{'Cache-Control':'no-store'}});
  if(path==='status')return reply(200,{configured:true,authenticated:loggedIn});
  if(path==='session'&&method==='POST'){if(request.postDataJSON().password!=='test-owner-password')return reply(401,{error:'비밀번호가 일치하지 않습니다.'});loggedIn=true;return reply(200,{authenticated:true});}
  if(path==='session'&&method==='DELETE'){loggedIn=false;return reply(200,{authenticated:false});}
  if(!loggedIn)return reply(401,{error:'설정에서 다시 로그인해 주세요.'});
  if(path==='archive'&&method==='GET')return reply(200,{activities:[...remote.values()].filter(i=>i.kind==='activity').map(i=>i.record),entries:[...remote.values()].filter(i=>i.kind==='entry').map(i=>i.record)});
  const input=request.postDataJSON();attempts[input.kind]++;
  if(input.kind==='entry'&&failEntry){failEntry=false;return reply(500,{error:'테스트 일시 실패: 남은 기록을 다시 시도해 주세요.'});}
  const previous=remote.get(input.record.id);
  if(previous&&input.record.notion?.hash!==previous.record.notion.hash)return reply(409,{error:'Notion에서도 내용이 바뀌었습니다.',conflict:previous});
  serial++;const result={kind:input.kind,record:{...input.record,isSample:false,syncPending:false,notion:{pageId:input.record.id,hash:(serial%10).toString().repeat(64)}}};remote.set(input.record.id,result);return reply(200,result);
 });
 await go('/settings');await page.getByLabel('앱 비밀번호').fill('wrong');await page.getByRole('button',{name:'연결 로그인',exact:true}).click();await page.getByRole('alert').filter({hasText:'비밀번호가 일치하지 않습니다'}).waitFor();check(true,'Login failure is visible');
 await page.getByLabel('앱 비밀번호').fill('test-owner-password');await page.getByRole('button',{name:'연결 로그인',exact:true}).click();await page.getByText('로그인됨 · 수동 반영',{exact:true}).waitFor();
 check(attempts.activity===0&&attempts.entry===0,'Login does not auto-upload local data');
 await page.getByRole('button',{name:'브라우저 기록 Notion에 저장',exact:true}).click();await page.getByRole('alert').filter({hasText:'테스트 일시 실패'}).waitFor();
 let local=await data();check(!!local.activities[0].notion&&!local.entries[0].notion,'Partial failure acknowledges only committed activity');check(local.entries[0].content==='브라우저 기록','Failed remote save retains local entry');
 await page.getByRole('button',{name:'브라우저 기록 Notion에 저장',exact:true}).click();await page.getByRole('status').filter({hasText:'1개를 Notion에 반영했습니다.'}).waitFor();
 check(attempts.activity===1&&attempts.entry===2,'Retry sends pending items only');check(remote.size===2,'No duplicate remote records');
 await page.reload();await page.getByText('로그인됨 · 수동 반영',{exact:true}).waitFor();check((await data()).entries[0].notion.hash.length===64,'Acknowledgement survives refresh');
 const importedId='55555555-5555-4555-8555-555555555555';remote.set(importedId,{kind:'activity',record:{...activity,id:importedId,name:'Notion에서 온 활동',notion:{pageId:importedId,hash:'a'.repeat(64)},syncPending:false}});
 await page.getByRole('button',{name:'Notion에서 불러오기',exact:true}).click();await page.getByRole('status').filter({hasText:'Notion 기록을 불러왔습니다.'}).waitFor();check((await data()).activities.some(a=>a.id===importedId),'Remote records imported into local shared store');
 await go('/collection');await page.getByRole('heading',{name:'Notion에서 온 활동',exact:true}).waitFor();check(true,'Imported activity visible in Collection');
 const edit=async name=>{await go('/activities/'+activityId+'/edit');await page.getByLabel('활동 이름').fill(name);await page.getByRole('button',{name:'활동 저장',exact:true}).click();await page.waitForURL(origin+'/activities/'+activityId);};
 await edit('로컬 수정본');let old=remote.get(activityId);remote.set(activityId,{...old,record:{...old.record,name:'Notion 수정본',notion:{...old.record.notion,hash:'f'.repeat(64)}}});
 await go('/settings');await page.getByRole('button',{name:'브라우저 기록 Notion에 저장',exact:true}).click();await page.getByRole('heading',{name:'같은 기록의 두 버전'}).waitFor();
 check((await data()).activities.find(a=>a.id===activityId).name==='로컬 수정본','Conflict preserves unsynced local changes');
 check(await page.locator('.version-preview').filter({hasText:'로컬 수정본'}).count()===1&&await page.locator('.version-preview').filter({hasText:'Notion 수정본'}).count()===1,'Human-readable conflict comparison');
 await page.getByRole('button',{name:'Notion 내용 사용',exact:true}).click();await page.getByRole('status').filter({hasText:'Notion 내용을 브라우저에 적용했습니다.'}).waitFor();check((await data()).activities.find(a=>a.id===activityId).name==='Notion 수정본','Explicit remote conflict resolution');
 await edit('내 내용 우선');old=remote.get(activityId);remote.set(activityId,{...old,record:{...old.record,name:'두 번째 원격 변경',notion:{...old.record.notion,hash:'e'.repeat(64)}}});
 await go('/settings');await page.getByRole('button',{name:'브라우저 기록 Notion에 저장',exact:true}).click();await page.getByRole('button',{name:'내 내용으로 Notion에 반영',exact:true}).click();await page.getByRole('status').filter({hasText:'내 내용을 Notion에 반영했습니다.'}).waitFor();check(remote.get(activityId).record.name==='내 내용 우선','Explicit local conflict resolution updates latest remote base');
 await edit('불러오기 전 로컬 변경');await go('/settings');await page.getByRole('button',{name:'Notion에서 불러오기',exact:true}).click();await page.getByRole('status').filter({hasText:'미반영 로컬 변경은 유지됩니다.'}).waitFor();check((await data()).activities.find(a=>a.id===activityId).name==='불러오기 전 로컬 변경','Pull preserves pending local changes when remote base is unchanged');
 old=remote.get(activityId);remote.set(activityId,{...old,record:{...old.record,name:'불러오기 충돌 원격',notion:{...old.record.notion,hash:'d'.repeat(64)}}});await page.getByRole('button',{name:'Notion에서 불러오기',exact:true}).click();await page.getByRole('heading',{name:'같은 기록의 두 버전'}).waitFor();check(true,'Pull detects divergent remote changes');
 for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:950});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px settings and conflict: no horizontal overflow`);}
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:'D:/Shin/Diary/artifacts/notion-conflict-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:'D:/Shin/Diary/artifacts/notion-settings-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByLabel('앱 비밀번호').waitFor();check((await data()).entries[0].content==='브라우저 기록','Logout preserves local data');
 check(errors.length===0,'No browser runtime errors');return {passed:checks.length,checks};
 }catch(error){throw new Error('After '+checks.slice(-3).join(' | ')+': '+error.message);}
}
