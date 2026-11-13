import {requireAccess,accessResponse} from '@/lib/authorization';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {incomingQcForLabel} from '@/lib/incoming-qc';
async function get(r:Request){try{return Response.json(await incomingQcForLabel(await requireAccess(),new URL(r.url).searchParams.get('code')||'',new URL(r.url).origin),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}})}catch(e){return accessResponse(e)||Response.json({error:'ردیف کنترل کیفیت دریافت نشد.'},{status:503})}}
export const GET=withServiceRolePreview(get);
