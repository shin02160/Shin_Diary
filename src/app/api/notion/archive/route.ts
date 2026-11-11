import { authorize, errorResponse, json, readJson } from '@/lib/server/auth';
import { AppError, getConfig } from '@/lib/server/config';
import { service } from '@/lib/server/service';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try { const config = getConfig(); authorize(request,config); const {repository} = service(); return json(await repository.read()); } catch(error) { return errorResponse(error); }
}
export async function POST(request: Request) {
 try { const config = getConfig(); authorize(request,config); const input = await readJson(request, 256_000) as {kind?:unknown;record?:unknown}; if (!input || (input.kind !== 'activity' && input.kind !== 'entry')) throw new AppError(400,'기록 종류를 확인해 주세요.'); const {repository} = service(); return json(await repository.save(input.kind,input.record)); } catch(error) { return errorResponse(error); }
}
