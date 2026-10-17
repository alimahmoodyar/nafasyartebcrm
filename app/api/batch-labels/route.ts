import {requireAccess,can,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {warehouseDirectory,warehouseMember} from '@/lib/material-warehouses';
import {batchLabelHtml,batchLabelOptions} from '@/lib/batch-labels';
export async function GET(request:Request){try{
 const u=await requireAccess(),p=u.permissions;
 if(!u.isAdmin&&(p.salesAgentId||p.serviceAgentId||p.salesRoles?.includes('agent')||p.serviceRoles?.includes('agent')||p.qmsRoles?.includes('observer')))throw new AccessError('چاپ لیبل انبار برای این حساب مجاز نیست.',403);
 const general=u.isAdmin||can(u,'batch','read')||p.flowRoles?.some(r=>['inventory','qc'].includes(r));
 if(!general&&!p.warehouseResponsibilities?.length)throw new AccessError('دسترسی چاپ لیبل بچ ندارید.',403);
 const url=new URL(request.url),id=url.searchParams.get('id')||'';if(!id||id.length>200)throw new AccessError('بچ ثبت‌شده را انتخاب کنید.',400);
 const db=storage(),r:any=await db.prepare("SELECT id,payload FROM records WHERE id=? AND kind='batch'").bind(id).first();if(!r)throw new AccessError('بچ ثبت‌شده پیدا نشد.',404);
 if(!general){const receipt:any=await db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='receipt'").bind(id).first(),wid=receipt&&JSON.parse(receipt.data).warehouseId,w=(await warehouseDirectory()).find(w=>w.id===wid&&w.data.active);if(!w||!warehouseMember(u,w,'inventory')&&!warehouseMember(u,w,'qc'))throw new AccessError('این بچ در انبار تحت مسئولیت شما نیست.',403);}
 const html=await batchLabelHtml({id:r.id,data:JSON.parse(r.payload)},batchLabelOptions(url.searchParams));
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; font-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'"}});
 }catch(e){return accessResponse(e)||Response.json({error:'آماده‌سازی لیبل انجام نشد؛ شماره بچ را بررسی کنید.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
