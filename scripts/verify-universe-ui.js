/* eslint-disable @typescript-eslint/no-unused-expressions -- Function evaluated by playwright-cli. */
async page => {
 const origin = await page.evaluate(() => location.origin);
 const trips = { state: 'ready', items: [{ id: 'trip', title: '테스트 여행', start: '2027-02-05', end: '2027-02-08', location: '상하이', url: 'https://www.notion.so/trip' }], truncated: false };
 const performances = { state: 'ready', items: [{ id: 'concert', title: '테스트 공연', start: '2026-11-06', location: '서울', url: 'https://www.notion.so/concert' }], truncated: false };
 await page.route('**/api/notion/archive', route => route.fulfill({ json: { activities: [], entries: [] } }));
 await page.route('**/api/notion/collections', route => route.fulfill({ json: { trips, performances } }));
 const routes = ['/', '/explore', '/capture', '/calendar', '/more', '/wiki', '/settings'];
 for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  for (const path of routes) {
   await page.goto(origin + path);
   await page.getByRole('heading', { level: 1 }).waitFor();
   const mobile = width <= 760;
   const nav = page.getByRole('navigation', { name: mobile ? '하단 메뉴' : '주요 메뉴', exact: true });
   const links = nav.getByRole('link');
   if (await links.count() !== (mobile ? 5 : 9)) throw Error('menu items: ' + width);
   if (mobile && await nav.locator('[aria-current]').count() !== 1) throw Error('active menu: ' + path);
   if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('horizontal overflow: ' + width + ' ' + path);
   if (mobile) {
    const space = await page.locator('main').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom));
    const height = await nav.evaluate(element => element.getBoundingClientRect().height);
    if (space <= height) throw Error('insufficient bottom padding');
   }
  }
  if (width === 390 || width === 1440) {
   await page.goto(origin + '/');
   await page.getByText('테스트 여행', { exact: true }).waitFor();
   await page.screenshot({ path: 'artifacts/wiki-after-' + width + '.png' });
  }
 }
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto(origin + '/');
 await page.getByRole('link', { name: '여행', exact: true }).click();
 await page.waitForURL('**/explore?category=travel');
 await page.getByRole('button', { name: '여행', exact: true }).waitFor();
 if (await page.getByRole('button', { name: '여행', exact: true }).getAttribute('aria-pressed') !== 'true') throw Error('initial category');
 await page.getByText('테스트 여행', { exact: true }).waitFor();
 if (await page.getByText('테스트 공연', { exact: true }).count()) throw Error('category filter');
 await page.getByRole('button', { name: '전체', exact: true }).click();
 await page.getByLabel('연도').selectOption('2026');
 await page.getByText('테스트 공연', { exact: true }).waitFor();
 if (await page.getByText('테스트 여행', { exact: true }).count()) throw Error('year filter');
 await page.getByRole('button', { name: '목록 보기', exact: true }).press('Enter');
 if (!(await page.locator('.universe-list').count())) throw Error('keyboard list toggle');
 const search = page.getByRole('searchbox', { name: '제목, 장소, 태그 검색' });
 await search.fill('여행');
 await page.getByText('조건에 맞는 기록이 없어요.').waitFor();
 await page.getByRole('link', { name: '기록과 문서 검색', exact: true }).press('Enter');
 await page.waitForURL('**/explore?search=1');
 if (!(await search.evaluate(node => node === document.activeElement))) throw Error('search focus');
 if (await page.locator('img.universe-cover').count()) throw Error('fabricated photo');
 if (await page.locator('.universe-cover-placeholder').count() !== 2) throw Error('missing default covers');
 await search.fill('no match');
 await page.getByRole('button', { name: '조건 초기화' }).press('Enter');
 await page.getByText('테스트 여행', { exact: true }).waitFor();
 if (await search.inputValue()) throw Error('search reset');
 return '49 responsive route checks, category/year/search filters, keyboard view toggle and search focus passed';
}
