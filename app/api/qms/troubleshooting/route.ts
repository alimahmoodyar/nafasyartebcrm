import {requireAccess,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {qrows,qtoday} from '@/lib/qms';
import {domainAccess} from '@/lib/service-access';
import {serviceDomains} from '@/lib/after-sales-labels';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request){try{
 const u=await requireAccess(),q=new URL(request.url).searchParams,domain=q.get('domain')||'',productId=q.get('productId')||'';
 if(!Object.hasOwn(serviceDomains,domain)||!domainAccess(u,domain))return json({error:'دسترسی این حوزه خدمات را ندارید.'},403);
 const internal=!u.permissions.hospitalCenterId&&!u.permissions.salesAgentId&&!u.permissions.serviceAgentId&&!u.permissions.salesRoles?.includes('agent')&&!u.permissions.serviceRoles?.includes('agent');
 const roles=u.permissions.serviceRoles||[],canUse=internal&&(u.isAdmin||roles.some(r=>['manager','coordinator','technician','support'].includes(r)));
 if(!canUse)return json({error:'راهنمای عیب‌یابی برای کارکنان مجاز خدمات پس از فروش است.'},403);
 if(!productId||productId.length>200||/[\u0000-\u001f]/.test(productId))return json({error:'شناسه محصول معتبر لازم است.'},400);
 const product=await storage().prepare("SELECT id,payload FROM records WHERE id=? AND kind='product'").bind(productId).first() as {id:string;payload:string}|null;if(!product)return json({error:'محصول پیدا نشد.'},404);
 const today=qtoday(),technician=u.isAdmin||roles.some(r=>['technician','manager','coordinator'].includes(r));
 const productData=JSON.parse(product.payload) as {name?:string;code?:string},guides=(await qrows()).filter(r=>r.type==='qms_record'&&r.data.kind==='troubleshooting'&&r.data.productId===productId&&r.data.state==='approved'&&(!r.data.values?.effective||r.data.values.effective<=today)).map(r=>({id:r.id,title:r.data.title,version:r.data.version,productId,product:productData.name||productData.code||'',symptoms:r.data.values?.symptoms||'',customerChecks:r.data.values?.customerChecks||'',safetyWarnings:r.data.values?.safetyWarnings||'',...(technician?{technicianSteps:r.data.values?.technicianSteps||'',escalation:r.data.values?.escalation||''}:{}),references:r.data.values?.references||'',effective:r.data.values?.effective||'',updatedAt:r.updated}));
 return json({productId,domain,guides,access:technician?'technician':'customer_support'});
 }catch(e){return accessResponse(e)||json({error:'دریافت راهنمای عیب‌یابی ممکن نشد.'},503)}}
