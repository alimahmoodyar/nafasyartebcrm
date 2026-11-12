import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {readRepresentativeIdentity,applyRepresentativeIdentity} from '@/lib/representative-identity';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
async function get(r:Request){try{return json(await readRepresentativeIdentity(await requireAccess(),new URL(r.url).searchParams))}catch(e){return accessResponse(e)||json({error:'شناسنامه دریافت نشد.'},503)}}
async function post(r:Request){try{checkOrigin(r);return json(await applyRepresentativeIdentity(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(r,24000)))))}catch(e){return accessResponse(e)||json({error:'ثبت انجام نشد؛ اطلاعات را تازه و با همان شناسه دوباره تلاش کنید.'},409)}}
export const GET=withServiceRolePreview(get);export const POST=withServiceRolePreview(post);
