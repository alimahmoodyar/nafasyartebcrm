import {agreedWarrantyMonths} from './warranty-basis';
import {storage} from './storage';
import {AccessError} from './authorization';
import {hreq,htext,hrow} from './hospital';
import {integer,sday} from './sales';
import {productProductionMode} from './model';
import {hospitalOxygenProduct,hospitalSerialKey,hospitalModelKey} from './hospital-service-model';
import {hospitalServiceCatalog} from './hospital-service-catalog';
import {addSolarMonths} from './sales-payment-terms';
const fail=(m:string,status=400):never=>{throw new AccessError(m,status)};
const contractWarranty=(v:unknown)=>{try{return agreedWarrantyMonths(v);}catch(e){return fail((e as Error).message);}};
const serialSql=[...'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'].reduce((q,d,i)=>"replace("+q+",'"+d+"','"+(i%10)+"')","upper(trim(json_extract(data,'$.serial')))");
/** Installed legacy equipment only; no fabricated manufacturing record or stock movement. */
export async function prepareHospitalInstallation(input:any,old:any,today:string,guard:(sql:string,...args:any[])=>unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('مشخصات دستگاه لازم است.');
 const db=storage(),productId=hreq(input.productId),record:any=await db.prepare("SELECT payload FROM records WHERE id=? AND kind='product'").bind(productId).first();
 if(!record)fail('محصول بیمارستانی را انتخاب کنید.',404);const product=JSON.parse(record.payload);
 if(productProductionMode(product)!=='project')fail('محصول باید در گروه ساخت بیمارستانی تعریف شده باشد.');
 guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='product' AND payload=?)",productId,record.payload);
 const serial=hospitalSerialKey(hreq(input.serial,160)),installedOn=sday(input.installedOn),projectId=htext(input.projectId||'',200);let warrantyMonths:number,warrantyBasis:any;
 if(projectId){const project=await hrow(projectId,'build_project'),p=project.data;
  if(p.specificationPending)fail('شرایط این پروژه در حال بازنگری است؛ ابتدا تأیید شود.',409);
  if(p.warranty?.months===null||p.warranty?.months===undefined||p.warranty.months==='')fail('مدت گارانتی قرارداد این پروژه هنوز تعیین نشده است.');
  warrantyMonths=integer(p.warranty.months,0,120);const supplied=contractWarranty(input.warrantyMonths);if(supplied!==null&&supplied!==warrantyMonths)fail('گارانتی دستگاه باید مطابق قرارداد پروژه انتخاب‌شده باشد.',409);
  const productIds=[...(p.units||[]).map((u:any)=>u.productId),...(p.customerRequirements?.items||[]).map((i:any)=>i.productId)].filter(Boolean);if(productIds.length&&!productIds.includes(productId))fail('این محصول در پروژه انتخاب‌شده نیست.');
  guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',project.id,project.revision);
  warrantyBasis={kind:'project_contract',projectId:project.id,projectRevision:project.revision,contractId:p.warranty.contractId||p.contractId||'',contractNumber:p.warranty.contractNumber||p.contract||'',months:warrantyMonths};
 }else{const agreed=contractWarranty(input.warrantyMonths);warrantyMonths=agreed??fail('مدت گارانتی توافق‌شده برای همین بیمارستان لازم است؛ از محصول گرفته نمی‌شود.');warrantyBasis={kind:'manual_contract',months:warrantyMonths};}
 const warrantyUntil=addSolarMonths(installedOn,warrantyMonths),expired=warrantyMonths===0||warrantyUntil<today;
 if(installedOn>today)fail('برای دستگاه نصب‌شده، تاریخ نصب در آینده نیست.');
 if(old&&(hospitalSerialKey(old.data.serial)!==serial||old.data.productId&&old.data.productId!==productId))fail('محصول و سریال دستگاه ثبت‌شده ثابت هستند.');
 const contractStatus=input.contractStatus||'';if(!['','yes','no'].includes(contractStatus)||expired&&!contractStatus)fail('پس از پایان گارانتی، داشتن یا نداشتن قرارداد را مشخص کنید.');
 const contractUntil=contractStatus==='yes'?sday(input.contractUntil):'';if(contractUntil&&contractUntil<installedOn)fail('انقضای قرارداد نمی‌تواند پیش از نصب باشد.');
 const candidates=(await db.prepare("SELECT id,payload FROM records WHERE kind='device'").all()).results.filter((r:any)=>hospitalSerialKey(JSON.parse(r.payload).code||'')===serial);
 if(candidates.length>1)fail('سریال تولیدی تکراری است؛ ابتدا بررسی شود.',409);const device:any=candidates[0],p=device?JSON.parse(device.payload):null;
 if(p&&p.product!==productId)fail('سریال تولیدی متعلق به محصول دیگری است.',409);
 if(old?.data.deviceId&&old.data.deviceId!==(device?.id||''))fail('اتصال دستگاه تولیدی تغییر کرده است.',409);
 if(device)guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='device' AND payload=?)",device.id,device.payload);
 guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='hospital_asset' AND (json_extract(data,'$.serialKey')=? OR "+serialSql+"=? OR (?<>'' AND json_extract(data,'$.deviceId')=?)) AND id<>?)",serial,serial,device?.id||'',device?.id||'',old?.id||'');
 const oxygen=hospitalOxygenProduct(product);let equipment:any=null,kit:any=null,kitData:any=null;
 if(oxygen){
  const compressorModel=hreq(input.compressorModel),generatorModel=hreq(input.generatorModel),dryerModel=hreq(input.dryerModel),intervalHours=integer(input.serviceIntervalHours,1,100000),catalog=await hospitalServiceCatalog();
  const matches=catalog.kits.filter(k=>k.data.active&&k.data.modelKey===hospitalModelKey(compressorModel)&&k.data.intervalHours===intervalHours);
  if(matches.length>1)fail('بیش از یک فهرست فعال برای کمپرسور وجود دارد.',409);kit=matches[0]||null;
  if(kit&&(input.kitId!==kit.id||input.kitRevision!==kit.revision))fail('فیلترهای کمپرسور تغییر کرده؛ دوباره آن را انتخاب کنید.',409);
  if(!kit&&input.kitId)fail('فهرست کمپرسور غیرفعال یا تغییر کرده است.',409);
  if(!Array.isArray(input.filters)||!input.filters.length||input.filters.length>50)fail('بین ۱ تا ۵۰ فیلتر وارد کنید.');
  const seen=new Set<string>(),filters=[];
  for(const f of input.filters){const partCode=hreq(f.partCode,12);if(seen.has(partCode))fail('کد فیلتر تکراری است.');seen.add(partCode);
   const material=catalog.materials.find(m=>m.data.code===partCode);if(!material||material.data.unit!=='عدد')fail('فیلتر با کد کالای موجود و واحد عدد انتخاب کنید.');guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',material.id,material.revision);
   filters.push({partCode,technicalCode:hreq(f.technicalCode,200),quantity:integer(f.quantity,1,10000),batchCode:htext(f.batchCode||'',200)});
  }
  const lines=filters.map(({batchCode,...f})=>f);
  if(kit){const expected=kit.data.lines.map((f:any)=>({partCode:f.partCode,quantity:f.quantity,technicalCode:f.technicalCode||''}));
   const normalized=(xs:any[])=>JSON.stringify([...xs].sort((a,b)=>a.partCode.localeCompare(b.partCode)).map(f=>[f.partCode,f.quantity,f.technicalCode||'']));
   // Existing lists without a technical code may be completed once, with an exact revision guard.
   if(expected.some((f:any)=>!f.technicalCode)){if(normalized(expected.map(({technicalCode,...f}:any)=>f))!==normalized(lines.map(({technicalCode,...f})=>f)))fail('کد یا تعداد فیلتر با تعریف مشترک کمپرسور متفاوت است.',409);kitData={...kit.data,lines};}
   else if(normalized(expected)!==normalized(lines))fail('فیلترهای این مدل مشترک‌اند؛ برای تغییر، تعریف کمپرسور را ویرایش کنید.',409);
   guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',kit.id,kit.revision);
  }else{guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='hospital_service_kit' AND json_extract(data,'$.modelKey')=? AND json_extract(data,'$.intervalHours')=? AND json_extract(data,'$.active')=1)",hospitalModelKey(compressorModel),intervalHours);kitData={componentModel:compressorModel,modelKey:hospitalModelKey(compressorModel),intervalHours,lines,active:true};}
  equipment={kind:'oxygen',compressorModel,generatorModel,dryerModel,serviceIntervalHours:intervalHours,filters};
 }
 const components=oxygen?[{kind:'compressor',name:'کمپرسور',model:equipment.compressorModel,quantity:integer(input.compressorQuantity??1,1,10000),code:'',serial:'',notes:''},...(old?.data.components||[]).filter((c:any)=>c.kind!=='compressor')]:old?.data.components||[];
 return {kit,kitData,data:{...old?.data,deviceId:device?.id||'',source:device?{kind:'production',deviceId:device.id}:{kind:'manual_installation'},serial,serialKey:serial,model:product.model||product.name,productId,productName:product.name,design:p?.design||old?.data.design||'',firmware:p?.firmware||old?.data.firmware||'',name:product.name,department:htext(input.department??old?.data.department??'',200),location:htext(input.location??old?.data.location??'',200),installedOn,warrantyMonths,warrantyUntil,warrantyBasis,projectId,serviceContract:{status:contractStatus,until:contractUntil},equipment,components,...(oxygen?{technicalProfile:{kind:'installed_oxygen',title:'مشخصات اکسیژن‌ساز بیمارستانی',fields:[{key:'generator',label:'مدل مولد'},{key:'dryer',label:'مدل درایر'}],values:{generator:equipment.generatorModel,dryer:equipment.dryerModel}}}:{}),...(oxygen?{maintenance:{...old?.data.maintenance,enabled:old?.data.maintenance?.enabled||false,interval:equipment.serviceIntervalHours}}:{})}};
}
