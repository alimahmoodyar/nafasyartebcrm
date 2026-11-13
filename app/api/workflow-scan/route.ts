import {requireAccess,accessResponse} from '@/lib/authorization';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {resolveWorkflowScan} from '@/lib/workflow-scan';
async function get(r:Request){try{const url=new URL(r.url);return Response.json(await resolveWorkflowScan(await requireAccess(),url.searchParams.get('code')||'',url.origin),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}})}catch(e){return accessResponse(e)||Response.json({error:'شناسایی کار انجام نشد؛ دوباره تلاش کنید.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
export const GET=withServiceRolePreview(get);
