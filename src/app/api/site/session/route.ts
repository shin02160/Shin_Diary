import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError, siteLockConfig } from '@/lib/server/config';
import { errorResponse, issueSession, json, passwordMatches, readJson, sameOrigin, SITE_COOKIE } from '@/lib/server/auth';
import { Journal } from '@/lib/server/journal';

export const runtime = 'nodejs';
let journal: Journal | undefined;

export async function POST(request: Request) {
 try {
  if (process.env.DIARY_SITE_LOCK !== 'true') throw new AppError(404, '사이트 잠금이 설정되지 않았습니다.');
  const config = siteLockConfig();
  sameOrigin(request, config);
  const body = await readJson(request, 2048) as { password?: unknown } | null;
  journal ??= new Journal(join(tmpdir(), 'diary-site-lock-' + createHash('sha256').update(config.origin).digest('hex').slice(0, 16) + '.sqlite'));
  journal.allowLogin('site');
  if (typeof body?.password !== 'string' || !passwordMatches(body.password, config)) throw new AppError(401, '비밀번호가 일치하지 않습니다.');
  return json({ authenticated: true }, 200, {
   'Set-Cookie': SITE_COOKIE + '=' + issueSession(config) + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800' + (config.origin.startsWith('https:') ? '; Secure' : ''),
  });
 } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
 try {
  if (process.env.DIARY_SITE_LOCK !== 'true') throw new AppError(404, '사이트 잠금이 설정되지 않았습니다.');
  const config = siteLockConfig();
  sameOrigin(request, config);
  return json({ authenticated: false }, 200, {
   'Set-Cookie': SITE_COOKIE + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' + (config.origin.startsWith('https:') ? '; Secure' : ''),
  });
 } catch (error) { return errorResponse(error); }
}
