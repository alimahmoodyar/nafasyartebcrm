import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {applyServicePayment,readServicePayments} from '@/lib/service-payments';
import {syncServiceTasks} from '@/lib/after-sales';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
async function get(request:Request){try{const u=await requireAccess(),q=new URL(request.url).searchParams,page=Number(q.get('page')||1);if(!Number.isSafeInteger(page)||page<1)return json({error:'صفحه معتبر نیست.'},400);return json(await readServicePayments(u,u.permissions.serviceAgentId||q.get('agent')||'',page));}catch(e){return accessResponse(e)||json({error:'گزارش پرداخت خدمات دریافت نشد.'},503)}}
async function post(request:Request){try{checkOrigin(request);const u=await requireAccess(),body=JSON.parse(new TextDecoder().decode(await boundedBody(request,32000))),result=await applyServicePayment(u,body);let followupPending=false;try{await syncServiceTasks()}catch{followupPending=true}return json({...result,followupPending});}catch(e){return accessResponse(e)||json({error:'ثبت انجام نشد؛ با همان شناسه دوباره تلاش کنید.'},409)}}
export const GET=withServiceRolePreview(get);
export const POST=withServiceRolePreview(post);
