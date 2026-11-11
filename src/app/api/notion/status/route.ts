import { getConfig } from '@/lib/server/config';
import { notionAuthenticated, json } from '@/lib/server/auth';
export const runtime = 'nodejs';
export async function GET(request: Request) {
 try { const config = getConfig(); return json({configured:true,authenticated:(!config.readOnly || config.readOnlyRequiresLogin) && notionAuthenticated(request,config),readOnly:config.readOnly,readOnlyRequiresLogin:config.readOnlyRequiresLogin,siteLocked:process.env.DIARY_SITE_LOCK === 'true'}); }
 catch { return json({configured:false,authenticated:false}); }
}
