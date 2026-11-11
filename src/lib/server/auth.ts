import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AppError, type Config } from './config.ts';
export const COOKIE = 'diary_session';
const hash = (value: string) => createHash('sha256').update(value).digest();
export function passwordMatches(input: string, config: Config) { return timingSafeEqual(hash(input), hash(config.password)); }
function signature(value: string, config: Config) { return createHmac('sha256', config.secret).update(config.origin + ':' + value + ':' + hash(config.password).toString('hex')).digest('hex'); }
export function issueSession(config: Config, now = Date.now()) { const payload = String(now + 8 * 60 * 60_000); return `${payload}.${signature(payload, config)}`; }
export function authenticated(request: Request, config: Config, now = Date.now()) {
 const cookie = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1) || '';
 const [expires, provided] = cookie.split('.');
 if (!/^\d+$/.test(expires || '') || Number(expires) <= now || Number(expires) > now + 8 * 60 * 60_000 || !/^[a-f0-9]{64}$/.test(provided || '')) return false;
 return timingSafeEqual(Buffer.from(provided,'hex'), Buffer.from(signature(expires,config),'hex'));
}
function matchesHost(request: Request, config: Pick<Config, 'origin'>) {
 // Next may canonicalize request.url to localhost; validate the actual Host header.
 const host = request.headers.get('host') || new URL(request.url).host;
 return host.toLowerCase() === new URL(config.origin).host.toLowerCase();
}
export function sameOrigin(request: Request, config: Pick<Config, 'origin'>) {
 if (!matchesHost(request,config) || request.headers.get('origin') !== config.origin) throw new AppError(403, '허용된 앱 주소에서 다시 요청해 주세요.');
}
export function authorize(request: Request, config: Config) {
 if (!matchesHost(request,config)) throw new AppError(403, '앱 주소가 서버 설정과 다릅니다.');
 if (!authenticated(request,config)) throw new AppError(401, 'Notion 연결을 사용하려면 설정에서 로그인해 주세요.');
 if (request.method !== 'GET') sameOrigin(request,config);
}
export async function readJson(request: Request, limit = 128_000): Promise<unknown> {
 if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AppError(415, 'JSON 요청이 필요합니다.');
 const reader = request.body?.getReader(); if (!reader) throw new AppError(400, '요청 내용이 없습니다.');
 const chunks: Uint8Array[] = []; let total = 0;
 try { while (true) { const {value,done} = await reader.read(); if (done) break; total += value.length; if (total > limit) { await reader.cancel(); throw new AppError(413,'요청 크기가 너무 큽니다.'); } chunks.push(value); } return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (error) { if (error instanceof AppError) throw error; throw new AppError(400,'요청 형식을 확인해 주세요.'); }
}
export function json(value: unknown, status = 200, headers?: HeadersInit) { return Response.json(value, { status, headers: { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers } }); }
export function errorResponse(error: unknown) {
 if (error instanceof AppError) return json({ error:error.message, conflict:error.conflict }, error.status, error.retryAfter ? {'Retry-After':String(error.retryAfter)} : undefined);
 return json({error:'서버에서 처리하지 못했습니다. 브라우저 기록은 유지됩니다. 설정과 서버 상태를 확인해 주세요.'},500);
}
