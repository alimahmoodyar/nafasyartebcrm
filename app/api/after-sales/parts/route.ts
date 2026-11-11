import {withServiceRolePreview} from '@/lib/service-role-preview';
import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {storedMaterialPhoto,materialPhotoBytes} from '@/lib/material-photos';
import {applyServiceParts,servicePartsWorkspace} from '@/lib/service-parts';
import {syncServiceCommercialTasks} from '@/lib/service-commercial-tasks';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
async function get(request:Request){try{const u=await requireAccess(),q=new URL(request.url).searchParams,result=await servicePartsWorkspace(u,q);if(q.has('photo')){if(!q.has('part')||!('photos' in result)||!result.photos?.some(p=>p.id===q.get('photo')))return json({error:'عکس این قطعه در دسترس نیست.'},404);const row=await storedMaterialPhoto(q.get('photo')!);if(!row)return json({error:'عکس پیدا نشد.'},404);const bytes=await materialPhotoBytes(row,true);return new Response(bytes,{headers:{'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});}return json(result);}catch(e){return accessResponse(e)||json({error:'خواندن قطعات مجاز انجام نشد.'},503);}}
async function post(request:Request){try{checkOrigin(request);const result=await applyServiceParts(await requireAccess(),JSON.parse(new TextDecoder().decode(await boundedBody(request,100000))));try{await syncServiceCommercialTasks()}catch{console.error('Parts catalog task projection deferred');}return json(result);}catch(e){return accessResponse(e)||json({error:/constraint|SQLITE|D1/i.test(String(e))?'فهرست یا مجوز هم‌زمان تغییر کرده؛ ثبت ناقصی انجام نشد.':e instanceof Error?e.message:'ثبت قطعات انجام نشد.'},409);}}

export const GET=withServiceRolePreview(get);
export const POST=withServiceRolePreview(post);
