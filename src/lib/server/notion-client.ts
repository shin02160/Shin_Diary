import { AppError } from './config.ts';
export class NotionError extends AppError { constructor(status:number,message:string,retryAfter?:number,public upstreamStatus=status) {super(status,message,retryAfter);} }
export interface Transport { call<T>(path: string, method?: string, body?: unknown): Promise<T> }
export class NotionClient implements Transport {
 private queue: Promise<unknown> = Promise.resolve();
 private nextAt = 0;
 private blockedUntil = 0;
 constructor(private token: string, private fetcher: typeof fetch = fetch, private wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve,ms))) {}
 call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const work = this.queue.then(() => this.perform<T>(path,method,body));
  this.queue = work.catch(() => undefined); return work;
 }
 private async perform<T>(path: string, method: string, body?: unknown): Promise<T> {
  if (Date.now() < this.blockedUntil) throw new NotionError(429,'Notion 요청 제한으로 대기 중입니다.',Math.ceil((this.blockedUntil-Date.now())/1000));
  const delay = this.nextAt - Date.now(); if (delay > 0) await this.wait(delay);
  this.nextAt = Date.now() + 350;
  let response: Response;
  try { response = await this.fetcher('https://api.notion.com/v1'+path, { method, headers: { Authorization:'Bearer '+this.token, 'Notion-Version':'2026-03-11', 'Content-Type':'application/json' }, body:body === undefined ? undefined : JSON.stringify(body), cache:'no-store', signal:AbortSignal.timeout(12_000) }); } catch { throw new AppError(502,'Notion 응답을 확인하지 못했습니다. 다시 시도해 주세요. 새 페이지 저장 결과가 불명확하면 중복 생성을 차단합니다.'); }
  if ([429,529].includes(response.status)) {
   const raw = Number(response.headers.get('retry-after')); const seconds = Number.isFinite(raw) && raw > 0 ? Math.ceil(raw) : 3;
   this.blockedUntil = Date.now() + seconds * 1000;
   throw new NotionError(response.status,'Notion이 일시적으로 요청을 제한했습니다. 표시된 대기 후 재시도해 주세요.',seconds);
  }
  if (!response.ok) throw new NotionError(response.status === 401 || response.status === 403 ? 502 : response.status === 404 ? 422 : response.status >= 500 ? 502 : 422, response.status === 401 || response.status === 403 ? 'Notion 토큰과 통합 권한을 확인해 주세요.' : response.status === 404 ? 'Notion 데이터 소스가 없거나 연결 권한이 없습니다.' : 'Notion 요청을 완료하지 못했습니다. 데이터 소스 속성과 권한을 확인해 주세요.',undefined,response.status);
  try { return await response.json() as T; } catch { throw new AppError(502,'Notion 응답 형식을 확인할 수 없습니다.'); }
 }
}
