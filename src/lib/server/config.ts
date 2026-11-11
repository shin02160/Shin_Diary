import { tmpdir } from 'node:os';
import { join } from 'node:path';
export class AppError extends Error {
 constructor(public status: number, message: string, public retryAfter?: number, public conflict?: unknown) { super(message); }
}
export interface Config { token: string; activitiesId: string; entriesId: string; password: string; secret: string; origin: string; statePath: string; readOnly?: boolean; readOnlyRequiresLogin?: boolean }
export type SessionConfig = Pick<Config, 'password' | 'secret' | 'origin'>;

export function siteLockConfig(): SessionConfig {
 const password = process.env.DIARY_PASSWORD || '';
 const secret = process.env.DIARY_SESSION_SECRET || '';
 const origin = process.env.DIARY_APP_ORIGIN || 'http://localhost:3000';
 let url: URL;
 try { url = new URL(origin); } catch { throw new AppError(503, '사이트 주소 설정을 확인해 주세요.'); }
 if (origin !== url.origin || (url.protocol !== 'https:' &&
     !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
  throw new AppError(503, '사이트의 HTTPS 주소를 설정해 주세요.');
 }
 if (!(password.length >= 16 || /^\d{4}$/.test(password)) || secret.length < 32) {
  throw new AppError(503, '사이트 잠금 설정이 필요합니다.');
 }
 return { password, secret, origin };
}

export function getConfig(): Config {
 const readOnly = process.env.DIARY_NOTION_READ_ONLY === 'true';
 const siteLocked = process.env.DIARY_SITE_LOCK === 'true';
 const readOnlyRequiresLogin = readOnly && (siteLocked || process.env.DIARY_NOTION_REQUIRE_LOGIN === 'true');
 const token = process.env.NOTION_TOKEN || '';
 const activitiesId = process.env.NOTION_ACTIVITIES_DATA_SOURCE_ID || '';
 const entriesId = process.env.NOTION_ENTRIES_DATA_SOURCE_ID || '';
 const password = process.env.DIARY_PASSWORD || ''; const secret = process.env.DIARY_SESSION_SECRET || '';
 const origin = process.env.DIARY_APP_ORIGIN || 'http://localhost:3000';
 const uuid = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
 let url: URL; try { url = new URL(origin); } catch { throw new AppError(503, '서버의 DIARY_APP_ORIGIN 설정을 확인해 주세요.'); }
 if (origin !== url.origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) throw new AppError(503, '앱 주소는 HTTPS 또는 localhost 주소로 설정해 주세요.');
 if (readOnly && !readOnlyRequiresLogin && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new AppError(503, '외부 주소의 읽기 전용 모드에는 DIARY_NOTION_REQUIRE_LOGIN=true를 설정해 주세요.');
 if (!token || !uuid.test(activitiesId) || !uuid.test(entriesId) || activitiesId.replaceAll('-','') === entriesId.replaceAll('-','') || ((!readOnly || readOnlyRequiresLogin) && ((password.length < 16 && !(siteLocked && readOnly && /^\d{4}$/.test(password))) || secret.length < 32))) throw new AppError(503, 'Notion 연결 설정이 필요합니다. .env.local의 토큰·두 데이터 소스 ID·앱 비밀번호·세션 비밀키를 확인해 주세요.');
 const stateFile = process.env.DIARY_STATE_FILE || 'notion.sqlite';
 if (!/^[a-zA-Z0-9._-]{1,90}\.sqlite$/.test(stateFile)) throw new AppError(503,'저장 저널 파일명을 확인해 주세요.');
 if (siteLocked) siteLockConfig();
 const statePath = process.env.VERCEL === '1' && readOnly
  ? join(tmpdir(), 'diary-read-only', stateFile)
  : join(process.cwd(), '.data', stateFile);
 return { token, activitiesId, entriesId, password, secret, origin, readOnly, readOnlyRequiresLogin, statePath };
}
