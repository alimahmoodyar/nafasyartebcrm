import {productProductionMode} from './model';
import {planRoutine} from './routine-planning';
import {routineRoles} from './routine-production';
import {storedAccessPermissions} from './permissions';

// Same scheduler as intermediate production, bounded by the unallocated CEO order.
export async function finishedPreview(input:any,source:any){
 const product=source.records.find((r:any)=>r.kind==='product'&&r.id===input.productId);if(!product||productProductionMode(JSON.parse(product.payload))==='project')throw Error('محصول نهایی سری‌ساخت را انتخاب کنید؛ تولید پروژه‌ای مسیر مستقل دارد.');
 const order=source.entities.find((e:any)=>e.type==='sourcing_plan'&&e.id===input.sourcingPlanId);
 if(!order||order.data.state!=='released'||!order.data.approvedBy||order.data.productId!==input.productId)throw Error('برنامه مصوب تحویل‌شده به تولید را انتخاب کنید.');
 const route=source.entities.find((e:any)=>e.type==='routine_route'&&e.id===input.routeId&&e.data.productId===input.productId);
 if(!route)throw Error('کارسنجی همین محصول را از تنظیمات و کارسنجی انتخاب کنید.');
 const remaining=order.data.count-source.entities.filter((e:any)=>e.type==='plan'&&e.data.sourcingPlanId===order.id).reduce((n:number,e:any)=>n+e.data.count,0);
 if(remaining<1||input.method==='quantity'&&input.count>remaining)throw Error('تعداد از باقی‌مانده سفارش مصوب بیشتر است.');
 const result={...planRoutine({...input,maxCount:Math.min(100,remaining)},{entities:source.entities,members:source.members.filter((m:any)=>routineRoles({permissions:storedAccessPermissions(m.permissions)}).read)}),sourcingPlanId:order.id,sourceRevision:order.revision,productId:input.productId,remaining,reviewedInput:{routeId:input.routeId,method:input.method,memberIds:input.memberIds,day:input.day,days:input.days,start:input.start,end:input.end,...(input.method==='quantity'?{count:input.count}:{})}};
 if(result.count>100)throw Error('هر برنامه حداکثر ۱۰۰ دستگاه دارد؛ تعداد را بین چند برنامه تقسیم کنید.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(result)));
 return {...result,previewKey:Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('')};
}
