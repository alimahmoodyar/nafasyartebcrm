import {storage} from './storage';
import {AccessError} from './authorization';
import {hreq,htext} from './hospital';
import {integer} from './sales';
import {qualityFields,qualityValues} from './quality';
import {selectConsumerPartTariff,consumerTariffValue,servicePartTariffGuard} from './after-sales-pricing';
import {dayAt} from './duties';
import {sha256} from './firmware';

import {hospitalModelKey} from './hospital-service-model';
export {hospitalModelKey} from './hospital-service-model';
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
export async function hospitalServiceCatalog(){
 const rows=(await storage().prepare("SELECT * FROM flow_entities WHERE type IN ('hospital_profile_template','hospital_service_kit','material','as_tariff') ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 return {templates:rows.filter(r=>r.type==='hospital_profile_template'),kits:rows.filter(r=>r.type==='hospital_service_kit'),materials:rows.filter(r=>r.type==='material'),tariffs:rows.filter(r=>r.type==='as_tariff'&&r.data.domain==='hospital')};
}
export function publicHospitalCatalog(catalog:Awaited<ReturnType<typeof hospitalServiceCatalog>>){
 return {templates:catalog.templates,kits:catalog.kits,parts:catalog.materials.map(m=>{const tariff=selectConsumerPartTariff(catalog.tariffs,m.data.code,dayAt(),'hospital');return {id:m.id,code:m.data.code,name:m.data.name,unit:m.data.unit,consumerPriceRial:tariff?consumerTariffValue(tariff):null};})};
}
export function hospitalProfileFields(input:unknown){
 const fields=qualityFields(input);if(fields.some(f=>f.type==='result'))fail('فرم مشخصات فنی فقط فیلد متن یا عدد دارد.');return fields;
}
export function hospitalTechnicalSnapshot(template:any,asset:any,values:unknown){
 if(!template||!template.data.active||template.data.modelKey!==hospitalModelKey(asset.data.model||''))fail('فرم فعال مشخصات همین مدل دستگاه لازم است.');
 const checked=qualityValues(template.data.fields,values);if(checked.failed)fail('مقدار مشخصات فنی خارج از حدود فرم است.');
 return {templateId:template.id,templateRevision:template.revision,title:template.data.title,fields:template.data.fields,values:checked.values};
}
export function hospitalComponents(input:unknown){
 if(!Array.isArray(input)||input.length>100)return fail('حداکثر ۱۰۰ قطعه ثبت کنید.');
 return input.map(v=>{if(v.kind!=null&&!['compressor','other'].includes(v.kind))fail('نوع قطعه معتبر نیست.');const kind=v.kind||'other';return {kind,name:hreq(v.name),code:htext(v.code||'',100),model:kind==='compressor'?hreq(v.model):htext(v.model||'',200),serial:htext(v.serial||'',200),quantity:integer(v.quantity,1,10000),notes:htext(v.notes||'',2000)};});
}

/** Draft only: no stock reservation, invoice, notice or center consent is created. */
export async function hospitalPeriodicDraft(job:any,asset:any,catalog:Awaited<ReturnType<typeof hospitalServiceCatalog>>,today=dayAt()){
 const blockers:string[]=[],lines:any[]=[],sources:any[]=[];
 if(job.data.kind!=='service')blockers.push('آماده‌سازی دوره‌ای فقط برای درخواست سرویس دوره‌ای است.');
 if(job.data.assetId!==asset.id||job.data.centerId!==asset.data.centerId)fail('دستگاه و مرکز پرونده منطبق نیستند.',409);
 const intervalHours=job.data.pm?job.data.pm.target-job.data.pm.baselineHours:asset.data.maintenance?.interval;
 if(!Number.isSafeInteger(intervalHours)||intervalHours<=0)blockers.push('فاصله سرویس دستگاه در شناسنامه مشخص نشده است.');
 const template=catalog.templates.filter(t=>t.data.active&&t.data.modelKey===hospitalModelKey(asset.data.model||''));
 const profile=asset.data.technicalProfile;
 if(template.length!==1)blockers.push('برای مدل دستگاه یک فرم فعال مشخصات فنی تعریف کنید.');
 else if(!profile||profile.templateId!==template[0].id||profile.templateRevision!==template[0].revision)blockers.push('مشخصات فنی دستگاه با فرم فعلی مدل تکمیل یا بازبینی نشده است.');
 else{try{hospitalTechnicalSnapshot(template[0],asset,profile.values);}catch(e){blockers.push((e as Error).message);}}
 const compressors=(asset.data.components||[]).filter((c:any)=>c.kind==='compressor');if(!compressors.length)blockers.push('کمپرسور و مدل آن را در قطعات نصب‌شده دستگاه مشخص کنید.');
 for(const component of compressors){
  const kits=catalog.kits.filter(k=>k.data.active&&k.data.modelKey===hospitalModelKey(component.model)&&k.data.intervalHours===intervalHours);
  if(kits.length!==1){blockers.push('فهرست یکتای فیلترهای سرویس '+intervalHours+' ساعته برای کمپرسور '+component.model+' موجود نیست.');continue;}
  const kit=kits[0];sources.push({id:kit.id,revision:kit.revision,component:{model:component.model,quantity:component.quantity,serial:component.serial||''},intervalHours});
  for(const item of kit.data.lines){
   const material=catalog.materials.find(m=>m.data.code===item.partCode),tariff=selectConsumerPartTariff(catalog.tariffs,item.partCode,today,'hospital');
   if(!material||material.data.unit!=='عدد'){blockers.push('قطعه '+item.partCode+' با واحد عدد در فهرست کالا موجود نیست.');continue;}
   if(!tariff){blockers.push('قیمت مصرف‌کننده فعال بیمارستانی برای '+material.data.name+' ('+item.partCode+') ثبت نشده است.');continue;}
   const quantity=item.quantity*component.quantity;
   if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000){blockers.push('تعداد فیلتر '+item.partCode+' خارج از محدوده است.');continue;}
   const existing=lines.find(l=>l.partCode===item.partCode);
   if(existing){existing.quantity+=quantity;if(existing.quantity>10000)blockers.push('تعداد مجموع '+item.partCode+' خارج از محدوده است.');}
   else lines.push({kind:'part',label:material.data.name,partCode:item.partCode,quantity,unitPrice:consumerTariffValue(tariff),materialId:material.id,materialRevision:material.revision,tariffId:tariff.id,tariffRevision:tariff.revision});
  }
 }
 if(!lines.length&&!blockers.length)blockers.push('فهرست سرویس فاقد قطعه است.');
 if(lines.length>50)blockers.push('پیش‌فاکتور بیش از ۵۰ کد قطعه دارد.');
 const total=lines.reduce((sum,l)=>sum+BigInt(l.unitPrice)*BigInt(l.quantity),BigInt(0)).toString();if(BigInt(total)>BigInt('999999999999999999'))blockers.push('مبلغ پیش‌فاکتور خارج از محدوده است.');
 const source={jobId:job.id,jobRevision:job.revision,assetId:asset.id,assetRevision:asset.revision,centerId:asset.data.centerId,day:today,intervalHours:intervalHours||null,device:{serial:asset.data.serial,model:asset.data.model},technicalProfile:profile||null,template:template.length===1?{id:template[0].id,revision:template[0].revision}:null,kits:sources,lines,total,blockers:[...new Set(blockers)]};
 const token=await sha256(new TextEncoder().encode(JSON.stringify(source)));return {...source,token,ready:!source.blockers.length};
}
export function guardHospitalPeriodicDraft(draft:Awaited<ReturnType<typeof hospitalPeriodicDraft>>,catalog:Awaited<ReturnType<typeof hospitalServiceCatalog>>,guard:(sql:string,...args:any[])=>unknown){
 guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',draft.assetId,draft.assetRevision);
 if(draft.template)guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',draft.template.id,draft.template.revision);
 for(const kit of draft.kits)guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',kit.id,kit.revision);
 for(const line of draft.lines){guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',line.materialId,line.materialRevision);const tariff=catalog.tariffs.find(t=>t.id===line.tariffId);const check=servicePartTariffGuard(tariff,line.partCode,draft.day,'hospital','consumer');guard(check.sql,...check.args);}
}
