/* eslint-disable @typescript-eslint/no-unused-expressions -- playwright-cli evaluates a function expression. */
async page => {
 const origin = await page.evaluate(() => location.origin);
 const checks = []; const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
 await page.goto(origin);
 await page.getByRole('heading', { level: 1 }).waitFor();
 await page.getByRole('link', { name: '추억 모아보기 Memories' }).click();
 await page.waitForURL('**/memories');
 check(await page.locator('.entry-card').count() === 4, 'Memories: four samples');
 await page.getByRole('button', { name: '여행', exact: true }).click();
 check(await page.locator('.entry-card').count() === 1, 'Category filter: travel');
 await page.getByRole('searchbox').fill('없는검색어');
 check(await page.getByText('아직 이곳은 비어 있어요').isVisible(), 'Search empty state');
 await page.getByRole('button', { name: '전체 보기', exact: true }).click();
 check(await page.locator('.entry-card').count() === 4, 'Reset filters');
 await page.getByRole('searchbox').fill('교토');
 check(await page.locator('.entry-card').count() === 1, 'Search by place');
 await page.getByRole('link', { name: '연결된 활동 보기' }).click();
 await page.waitForURL('**/activities/a-kyoto');
 check(await page.getByRole('heading', { level: 1, name: '교토에서 느리게 걷기' }).isVisible(), 'Linked activity detail');
 await page.getByRole('link', { name: '이어서 하기 Continue' }).click();
 await page.waitForURL('**/continue');
 check(await page.locator('.activity-card').count() === 2, 'Continue: active and parked only');
 await page.getByRole('link', { name: /필름 사진 산책/ }).click();
 await page.waitForURL('**/activities/a-photo');
 await page.getByText('2026-11-05', { exact: true }).waitFor();
 check(await page.getByText('2026-11-05', { exact: true }).isVisible(), 'Parked context visible');
 await page.getByRole('link', { name: '달력 Calendar' }).click();
 await page.waitForURL('**/calendar');
 check(await page.locator('.calendar-list-item').count() === 5, 'November: entries and events');
 await page.getByRole('button', { name: '외부 일정', exact: true }).click();
 check(await page.locator('.calendar-list-item').count() === 2, 'Calendar type filter');
 await page.getByRole('button', { name: '2026년 11월 14일, 1건', exact: true }).click();
 check(await page.locator('.calendar-list-item').count() === 1, 'Calendar day selection');
 await page.getByRole('button', { name: '다음 달' }).click();
 check(await page.getByRole('heading', { name: '2026년 12월', exact: true }).isVisible(), 'Calendar next month');
 check(await page.getByText('표시할 일정이나 기록이 없어요').isVisible(), 'Empty month');
 await page.getByRole('button', { name: '이전 달' }).click();
 await page.getByRole('button', { name: '전체', exact: true }).click();
 check(await page.locator('.calendar-list-item').count() === 5, 'Restore month and filter');
 const routes = ['/', '/memories', '/continue', '/collection', '/calendar', '/settings', '/capture', '/activities/a-photo'];
 for (const width of [360, 375, 390, 430, 768, 1024, 1440]) {
   await page.setViewportSize({ width, height: 900 });
   for (const route of routes) {
     const response = await page.goto(origin + route);
     check(response.status() === 200, `${width}px ${route}: HTTP 200`);
     await page.locator('h1').waitFor();
     const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
     check(!overflow, `${width}px ${route}: no horizontal overflow`);
     const active = page.locator('nav a[aria-current="page"]');
     if (route !== '/capture' && !route.startsWith('/activities/')) check(await active.count() === 1, `${width}px ${route}: active navigation`);
   }
 }
 const missing = await page.goto(origin + '/activities/does-not-exist');
 check(missing.status() === 200, 'Local activity route resolves before client lookup');
 await page.getByRole('link', { name: '활동 목록으로' }).waitFor();
 check(await page.getByRole('link', { name: '활동 목록으로' }).isVisible(), 'Unknown activity recovery');
 await page.setViewportSize({ width: 1440, height: 1080 });
 await page.goto(origin);
 await page.screenshot({ path: 'D:/Shin/Diary/artifacts/home-desktop.png', fullPage: true });
 await page.setViewportSize({ width: 390, height: 844 });
 await page.screenshot({ path: 'D:/Shin/Diary/artifacts/home-mobile.png', fullPage: true });
 await page.goto(origin + '/calendar');
 await page.screenshot({ path: 'D:/Shin/Diary/artifacts/calendar-mobile.png', fullPage: true });
 check(errors.length === 0, `No browser runtime errors: ${errors.join('; ')}`);
 return { passed: checks.length, checks, runtimeErrors: errors, screenshots: ['home-desktop.png', 'home-mobile.png', 'calendar-mobile.png'] };
}
