import { getConfig } from '@/lib/server/config';
import { authenticated, json } from '@/lib/server/auth';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try { const config = getConfig(); return json({configured:true,authenticated:authenticated(request,config)}); }
 catch { return json({configured:false,authenticated:false}); }
}
