import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {canOpenSection} from '@/lib/navigation-access';
import {warehouseAccess,flowRole} from '@/lib/material-flow';
import {domainAccess,role} from '@/lib/service-access';
import {hospitalInventory,hospitalLogistics,hospitalManager} from '@/lib/hospital';
import {GET as finishedReport} from '@/app/api/fulfillment/report/route';
import {GET as finishedSnapshot} from '@/app/api/fulfillment/route';
import {GET as serviceSnapshot} from '@/app/api/after-sales/route';
import {GET as hospitalSnapshot} from '@/app/api/hospital/route';
import {dispatchCategories,productDispatchRows,serviceDispatchRows,hospitalDispatchRows,type DispatchRow} from '@/lib/warehouse-dispatch';
export async function GET(request:Request){try{
 const u=await requireAccess();if(!canOpenSection(u,'warehouse'))throw new AccessError('دسترسی انبار ندارید.',403);
 const category=new URL(request.url).searchParams.get('category')||'';if(category&&!Object.hasOwn(dispatchCategories,category))throw new AccessError('دسته‌بندی معتبر نیست.',400);
 const rows:DispatchRow[]=[],base=new URL(request.url).origin;
 const read=async(r:Response)=>{const d:any=await r.json();if(!r.ok)throw new AccessError(d.error||'دریافت سفارش‌های باز انجام نشد.',r.status);return d;};
 if((!category||category==='product')&&canOpenSection(u,'fulfillment')&&(warehouseAccess(u,'finished')||flowRole(u,'logistics'))){const [r,s]=await Promise.all([finishedReport(new Request(base+'/api/fulfillment/report?status=all')),finishedSnapshot()]);rows.push(...productDispatchRows(await read(r),await read(s)));}
 for(const d of ['home','hospital'])if((!category||category===d)&&canOpenSection(u,'after-sales')&&domainAccess(u,d)&&['inventory','logistics','coordinator','manager'].some(r=>role(u,r))){rows.push(...serviceDispatchRows(await read(await serviceSnapshot(new Request(base+'/api/after-sales?domain='+d))),d));}
 if((!category||category==='hospital')&&canOpenSection(u,'hospital')&&(hospitalInventory(u)||hospitalLogistics(u)||hospitalManager(u)))rows.push(...hospitalDispatchRows(await read(await hospitalSnapshot(new Request(base+'/api/hospital')))));
 rows.sort((a,b)=>a.created.localeCompare(b.created)||a.id.localeCompare(b.id));
 return Response.json({rows,category},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
 }catch(e){return accessResponse(e)||Response.json({error:'فهرست سفارش‌های باز دریافت نشد.'},{status:503});}}
