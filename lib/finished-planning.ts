import {productionEligible} from './production-people';
import {productProductionMode} from './model';
import {planRoutine} from './routine-planning';

// Same scheduler as intermediate production, bounded by the unallocated CEO order.
export async function finishedPreview(input:any,source:any){
 const product=source.records.find((r:any)=>r.kind==='product'&&r.id===input.productId);if(!product||productProductionMode(JSON.parse(product.payload))==='project')throw Error('محصول نهایی سری‌ساخت را انتخاب کنید؛ تولید پروژه‌ای مسیر مستقل دارد.');
 const order=source.entities.find((e:any)=>e.type==='sourcing_plan'&&e.id===input.sourcingPlanId);
 if(!order||order.data.state!=='released'||!order.data.approvedBy||order.data.productId!==input.productId)throw Error('برنامه مصوب تحویل‌شده به تولید را انتخاب کنید.');
 const route=source.entities.find((e:any)=>e.type==='routine_route'&&e.id===input.routeId&&e.data.productId===input.productId);
 if(!route)throw Error('کارسنجی همین محصول را از تنظیمات و کارسنجی انتخاب کنید.');
 const remaining=order.data.count-source.entities.filter((e:any)=>e.type==='plan'&&e.data.sourcingPlanId===order.id).reduce((n:number,e:any)=>n+e.data.count,0);
 if(remaining<1||input.method==='quantity'&&input.count>remaining)throw Error('تعداد از باقی‌مانده سفارش مصوب بیشتر است.');
 const result:any={...planRoutine({...input,maxCount:Math.min(100,remaining)},{entities:source.entities,members:source.members.filter((m:any)=>productionEligible(m,source.entities))}),sourcingPlanId:order.id,sourceRevision:order.revision,productId:input.productId,remaining,reviewedInput:{routeId:input.routeId,method:input.method,memberIds:input.memberIds,day:input.day,days:input.days,start:input.start,end:input.end,...(input.method==='quantity'?{count:input.count}:{})}};
 if(result.count>100)throw Error('هر برنامه حداکثر ۱۰۰ دستگاه دارد؛ تعداد را بین چند برنامه تقسیم کنید.');
 if(result.feasible){
  const finalStage=route.data.steps.length-1,days=[...new Set<string>(result.work.filter((w:any)=>w.stage===finalStage).map((w:any)=>w.day))].sort();
  const releases=days.map((day:string)=>source.entities.filter((e:any)=>e.type==='product_version'&&e.data.productId===product.id&&e.data.effectiveFrom<=day).sort((a:any,b:any)=>b.data.effectiveFrom.localeCompare(a.data.effectiveFrom)||b.data.version-a.data.version)[0]);
  if(releases.some((r:any)=>!r))throw Error('برای این محصول تا روز تولید، نسخهٔ معتبر ثبت نشده است؛ ابتدا تحقیق‌وتوسعه یا مدیر در بخش «نسخه‌های محصول» نسخهٔ اولیه را تعریف کند.');
  if(new Set(releases.map((r:any)=>r.id)).size>1)throw Error('برنامه از تاریخ تغییر نسخه عبور می‌کند؛ تعداد را در دو برنامهٔ جدا ثبت کنید.');
  const release=releases[0];if(!release.data.design)throw Error('نسخهٔ طراحی محصول معتبر نیست؛ در بخش «نسخه‌های محصول» اصلاح شود.');
  result.productVersion={id:release.id,revision:release.revision,design:release.data.design,firmware:release.data.firmware||'',effectiveFrom:release.data.effectiveFrom};
 }
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(result)));
 return {...result,previewKey:Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('')};
}
