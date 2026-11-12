import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {boundedBody} from '@/lib/firmware-storage';
import {readReturnParcels,applyReturnParcel} from '@/lib/service-return-parcels';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
async function get(r:Request){try{return json(await readReturnParcels(await requireAccess(),new URL(r.url).searchParams))}catch(e){return accessResponse(e)||json({error:'مرسوله دریافت نشد.'},503)}}
async function post(r:Request){try{checkOrigin(r);return json(await applyReturnParcel(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(r,32000)))))}catch(e){return accessResponse(e)||json({error:'ثبت انجام نشد؛ تازه‌سازی و با همان شناسه دوباره تلاش کنید.'},409)}}
export const GET=withServiceRolePreview(get);export const POST=withServiceRolePreview(post);
