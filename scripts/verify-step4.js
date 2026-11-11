/* eslint-disable @typescript-eslint/no-unused-expressions -- Function evaluated by playwright-cli. */
async page => {
 page.setDefaultTimeout(10000);
 const origin=await page.evaluate(()=>location.origin);const checks=[];const errors=[];const writes=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());});
 const check=(ok,name)=>{if(!ok)throw new Error(name);checks.push(name);};
 const button=name=>page.getByRole('button',{name,exact:true});
 const file=()=>page.getByLabel('네이버 캘린더 파일 (.ics)');
 const heading=name=>page.getByRole('heading',{name,exact:true});
 const imported=()=>page.locator('.calendar-list-item').filter({has:page.getByText('네이버 ICS · 미리보기',{exact:true})});
 const open=async(source='네이버 개인')=>{await button('외부 일정 가져오기').click();await page.getByLabel('캘린더 구분 이름').fill(source);await page.getByLabel('미리보기 시작일').fill('2026-11-01');await page.getByLabel('미리보기 종료일').fill('2026-11-30');};
 const choose=name=>file().setInputFiles('D:/Shin/Diary/tests/calendar/fixtures/'+name);
 const preview=async name=>{await choose(name);await button('파일 미리보기').click();await heading('가져오기 미리보기').waitFor();};
 const apply=async()=>{await button('달력에 표시').click();await button('외부 일정 가져오기').waitFor();};
 const newFile=(name,type,size)=>page.evaluate(({name,type,size})=>{const input=document.querySelector('input[type=file]');const data=new DataTransfer();data.items.add(new File([new Uint8Array(size)],name,{type}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));},{name,type,size});
 try {
 await page.goto(origin+'/calendar');await button('외부 일정 가져오기').waitFor();const before=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
 await open();await preview('november.ics');check(await page.getByText('신규 5개',{exact:true}).isVisible(),'Actual Web Worker parses five synthetic occurrences');
 check(await imported().count()===0,'Preview does not change calendar before Apply');
 check(await page.locator('.ics-preview-list').getByText('옮긴 산책',{exact:true}).isVisible(),'Moved recurrence visible in preview');
 for(const width of [360,375,390,430,768,1024,1440]){await page.setViewportSize({width,height:920});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px import preview has no horizontal overflow`);}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:'D:/Shin/Diary/artifacts/calendar-ics-preview-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await apply();check(await imported().count()===5,'Apply shows five imported events');
 await button('외부 일정').click();await button('2026년 11월 11일, 1건').click();check(await heading('종일 여행').isVisible(),'All-day span includes second day');
 await button('2026년 11월 12일, 0건').click();check(await heading('표시할 일정이나 기록이 없어요').isVisible(),'Exclusive end date not marked');
 await button('월 전체 보기').click();await button('목록').click();check(await page.locator('.calendar-grid').count()===0&&await imported().count()===5,'Month/list toggle preserves events');await button('월').click();
 const literal=imported().filter({has:heading('설명 검증 일정')});await literal.getByText('일정 상세 보기',{exact:true}).click();
 check(await literal.getByText('<img src=x onerror="window.__icsXss=true">',{exact:true}).isVisible(),'Untrusted description remains visible literal text');
 check(await page.evaluate(()=>!window.__icsXss&&!document.querySelector('.event-details img')),'No imported HTML execution');
 check(await imported().filter({has:heading('서울 오전 약속')}).getByText(/09:00.*Asia\/Seoul/).isVisible(),'Source wall time and timezone label visible');
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:'D:/Shin/Diary/artifacts/calendar-ics-desktop.png',fullPage:true});
 await page.locator('nav a[href="/settings"]').click();await page.waitForURL('**/settings');await page.getByText(/최근 미리보기:.*5개/).waitFor();check(true,'Settings shows last in-tab preview');
 await page.locator('nav a[href="/calendar"]').click();await page.waitForURL('**/calendar');await imported().first().waitFor();check(await imported().count()===5,'Client-side navigation retains in-memory preview');
 await open();await preview('november.ics');check(await page.getByText('동일 5개',{exact:true}).isVisible(),'Same file recognized as unchanged');await apply();check(await imported().count()===5,'No duplicate events after repeated Apply');
 await open();await preview('november-changed.ics');check(await page.getByText('변경 1개',{exact:true}).isVisible(),'Changed UID occurrence detected');check(await page.getByText('이번 파일에 없는 기존 일정 4개 유지',{exact:true}).isVisible(),'Missing events are marked as retained');await apply();
 check(await heading('시간을 바꾼 약속').isVisible()&&await imported().count()===5,'Change updates one event without deleting omitted events');
 await open('공연');await preview('november-changed.ics');check(await page.getByText('신규 1개',{exact:true}).isVisible(),'Same UID in another calendar is separate');await apply();check(await imported().count()===6,'Calendar source isolation holds');
 await open();await choose('malformed.ics');await button('파일 미리보기').click();await page.getByRole('alert').filter({hasText:'VCALENDAR'}).waitFor();check(await imported().count()===6,'Malformed content rejected without clearing existing preview');
 await newFile('fake.txt','text/calendar',10);await button('파일 미리보기').click();await page.getByRole('alert').filter({hasText:'올바른 .ics 파일'}).waitFor();check(true,'Wrong filename extension rejected');
 await newFile('wrong.ics','image/png',10);await button('파일 미리보기').click();await page.getByRole('alert').filter({hasText:'올바른 .ics 파일'}).waitFor();check(true,'Unexpected MIME type rejected');
 await newFile('empty.ics','text/calendar',0);await button('파일 미리보기').click();await page.getByRole('alert').filter({hasText:'빈 파일'}).waitFor();check(true,'Empty file rejected');
 await newFile('large.ics','text/calendar',5*1024*1024+1);await button('파일 미리보기').click();await page.getByRole('alert').filter({hasText:'5MB 이하'}).waitFor();check(true,'Oversized file rejected');
 await preview('partial.ics');check(await button('달력에 표시').isDisabled(),'Partial result needs acknowledgement');await page.getByLabel('일부 일정이 제외됐음을 확인했어요').check();await apply();check(await heading('정상 일정').isVisible()&&await heading('제외 일정').count()===0,'Partial result displays valid events only');
 await open();await choose('november.ics');await page.evaluate(()=>{window.__realWorker=window.Worker;window.__stoppedWorkers=0;window.Worker=class{postMessage(){}terminate(){window.__stoppedWorkers++;}};});
 await button('파일 미리보기').click();await button('처리 중단').click();await page.getByRole('status').filter({hasText:'파일 처리를 중단했습니다.'}).waitFor();check(await page.evaluate(()=>window.__stoppedWorkers===1),'Cancel terminates active worker');
 await button('파일 미리보기').click();await page.getByRole('alert').filter({hasText:'처리 시간이 초과'}).waitFor({timeout:8500});check(await page.evaluate(()=>window.__stoppedWorkers===2),'Watchdog terminates stalled worker');await page.evaluate(()=>{window.Worker=window.__realWorker;});
 await button('가져오기 닫기').click();await button('미리보기 비우기').click();check(await imported().count()===0,'Clear affects only imported preview');
 await open();await preview('november.ics');await apply();await page.reload();await button('외부 일정 가져오기').waitFor();check(await imported().count()===0,'Full refresh clears imported preview');
 check(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)))===before,'ICS preview never writes localStorage');check(writes.length===0,'ICS preview never uploads or writes to server');check(errors.length===0,'No browser runtime errors');
 return {passed:checks.length,checks};
 }catch(error){throw new Error('After '+checks.slice(-3).join(' | ')+': '+error.message);}
}
