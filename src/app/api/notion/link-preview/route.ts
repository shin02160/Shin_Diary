import { authorize, errorResponse, json, readJson, sameOrigin } from '@/lib/server/auth';
import { AppError, getConfig } from '@/lib/server/config';
import { linkPreview } from '@/lib/server/link-preview';

export const runtime = 'nodejs';
let active = 0;

export async function POST(request: Request) {
 try {
  const origin = process.env.DIARY_APP_ORIGIN || 'http://localhost:3000';
  const hostname = new URL(origin).hostname;
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) sameOrigin(request, { origin });
  else authorize(request, getConfig());

  const input = await readJson(request, 5000) as { url?: unknown } | null;
  if (typeof input?.url !== 'string' || input.url.length > 2000) throw new AppError(400, '미리 볼 주소를 확인해 주세요.');
  try { new URL(input.url); } catch { throw new AppError(400, '미리 볼 주소를 확인해 주세요.'); }
  if (active >= 4) throw new AppError(429, '미리보기가 처리 중입니다. 잠시 후 다시 시도해 주세요.');
  active++;
  try { return json(await linkPreview(input.url)); }
  catch (error) {
   if (error instanceof AppError) throw error;
   throw new AppError(502, '미리보기를 불러오지 못했습니다.');
  } finally { active--; }
 } catch (error) { return errorResponse(error); }
}
