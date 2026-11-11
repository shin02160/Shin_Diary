import { COOKIE, authenticated, errorResponse, issueSession, json, passwordMatches, readJson, sameOrigin } from '@/lib/server/auth';
import { AppError } from '@/lib/server/config';
import { service } from '@/lib/server/service';
export const runtime = 'nodejs';
export async function POST(request: Request) {
 try { const {config,journal} = service(); if (config.readOnly && !config.readOnlyRequiresLogin) throw new AppError(405, 'Notion 읽기 전용 모드입니다.'); sameOrigin(request,config);
  const input = await readJson(request,4096) as {password?:unknown};
  // A global owner-login bucket is persistent and does not trust forwarded IP headers.
  if (!authenticated(request,config)) journal.allowLogin('owner');
  if (!input || typeof input.password !== 'string' || !passwordMatches(input.password,config)) throw new AppError(401,'비밀번호가 일치하지 않습니다.');
  return json({authenticated:true},200,{'Set-Cookie':`${COOKIE}=${issueSession(config)}; HttpOnly; SameSite=Strict; Path=/api/notion; Max-Age=28800${config.origin.startsWith('https:') ? '; Secure' : ''}`});
 } catch(error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
 try { const {config} = service(); if (config.readOnly && !config.readOnlyRequiresLogin) throw new AppError(405, 'Notion 읽기 전용 모드입니다.'); sameOrigin(request,config); return json({authenticated:false},200,{'Set-Cookie':`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/notion; Max-Age=0${config.origin.startsWith('https:') ? '; Secure' : ''}`}); } catch(error) { return errorResponse(error); }
}
