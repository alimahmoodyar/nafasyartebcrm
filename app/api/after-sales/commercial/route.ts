import {withServiceRolePreview} from '@/lib/service-role-preview';
import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {applyServiceCommercial,serviceCommercialWorkspace} from '@/lib/service-commercial';
import {syncServiceCommercialTasks} from '@/lib/service-commercial-tasks';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
async function get(){try{return json(await serviceCommercialWorkspace(await requireAccess()));}catch(e){return accessResponse(e)||json({error:'دریافت اعتبار و تعرفه خدمات انجام نشد.'},503);}}
async function post(request:Request){try{checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,25000))),result=await applyServiceCommercial(u,b);try{await syncServiceCommercialTasks()}catch{console.error('Service commercial task projection deferred');}return json(result);}catch(e){return accessResponse(e)||json({error:/constraint|SQLITE|D1/i.test(String(e))?'اطلاعات هم‌زمان تغییر کرده؛ هیچ تغییر ناقصی ثبت نشد.':e instanceof Error?e.message:'ثبت اعتبار و تعرفه انجام نشد.'},409);}}

export const GET=withServiceRolePreview(get);
export const POST=withServiceRolePreview(post);
