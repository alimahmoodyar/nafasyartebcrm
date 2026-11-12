import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {readDriverReceipts,applyDriverReceipt} from '@/lib/driver-receipts';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
async function get(request:Request){try{return json(await readDriverReceipts(await requireAccess(),new URL(request.url).searchParams))}catch(e){return accessResponse(e)||json({error:'دریافت رسیدها انجام نشد.'},503)}}
async function post(request:Request){try{checkOrigin(request);return json(await applyDriverReceipt(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(request,24000)))))}catch(e){return accessResponse(e)||json({error:'ثبت انجام نشد؛ با همان شناسه دوباره تلاش کنید.'},409)}}
export const GET=withServiceRolePreview(get);export const POST=withServiceRolePreview(post);
