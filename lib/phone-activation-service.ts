import {AccessError,accessResponse,checkOrigin,realSession,requireAccess} from '@/lib/authorization';
import {generateActivationCode} from '@/lib/activation-code';
import {normalizeSerial} from '@/lib/distribution';
import {dayAt} from '@/lib/duties';
import {boundedBody} from '@/lib/firmware-storage';
import {legacyActivationType,legacyCustomerName,type LegacyActivation} from '@/lib/legacy-activation-import';
import {phoneActivationHistory} from '@/lib/phone-activation-history';
import {canOpenPhoneActivation} from '@/lib/phone-activation-policy';
import {phoneCustomerFields,type PhoneActivationCustomer,type PhoneActivationDevice,type PhoneActivationProduct,type PhoneActivationPurpose,type PhoneCodeHistory} from '@/lib/phone-activation-contract';
import {storedAccessPermissions} from '@/lib/permissions';
import {storage} from '@/lib/storage';
import {trainingContext} from '@/lib/training-context';
import {agreedWarrantyMonths} from '@/lib/warranty-basis';
import {firstWarrantyCodeIssuedAt,WARRANTY_CODE_ISSUED} from '@/lib/warranty';

const failure=(message:string,status=400):never=>{throw new AccessError(message,status);};
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
const text=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max?value.trim():'';
const digest=async (value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const deviceSerial=(raw:unknown)=>{
 const serial=normalizeSerial(text(raw,160));
 if(!/^[A-Z0-9][A-Z0-9._/-]{0,159}$/.test(serial))failure('سریال درج‌شده روی بدنهٔ دستگاه را وارد کنید.');
 return serial;
};
export const legacyMatch=`type='${legacyActivationType}' AND (
 json_extract(data,'$.event.deviceSetSerial')=? OR json_extract(data,'$.event.setSerial')=? OR json_extract(data,'$.event.serial')=?)`;
const homeCaseMatch="type='as_case' AND json_extract(data,'$.domain')='home' AND json_extract(data,'$.serial')=?";
export const hospitalMatch="type='hospital_asset' AND (json_extract(data,'$.serialKey')=? OR upper(json_extract(data,'$.serial'))=? OR (?<>'' AND json_extract(data,'$.deviceId')=?))";

async function actor(request:Request){
 const user=await requireAccess(),db=storage();
 if(trainingContext.getStore()||user.rolePreview)failure('از حساب فعال خود در اطلاعات شرکت وارد شوید.',403);
 const expected=request.headers.get('x-assistant-account');
 if(expected&&expected!==user.userId)failure('حساب ورود تغییر کرده است.',409);
 if(user.profileReview){
  const original=await realSession();
  if(!original.isAdmin||original.userId!==user.userId||!canOpenPhoneActivation(user))failure('مجوز فعال‌سازی تلفنی ندارید.',403);
  return {user,db,member:null};
 }
 if(user.isAdmin)return {user,db,member:null};
 const id=user.userId.startsWith('local:')?user.userId.slice(6):'';
 const member=await db.prepare(`SELECT m.id,m.permissions,m.subject,a.data AS assignment
  FROM app_members m LEFT JOIN flow_entities a ON a.id='member-role-assignment:'||m.id AND a.type='member_role_assignment'
  WHERE m.status='active' AND (m.subject=? OR m.id=?)`).bind(user.userId,id).first<{id:string;permissions:string;subject:string|null;assignment:string|null}>();
 const profiles:string[]=member?.assignment?JSON.parse(member.assignment).bindings.map((binding:{profileId:string})=>binding.profileId):[];
 if(!member||!canOpenPhoneActivation(user,profiles)||!canOpenPhoneActivation({...user,permissions:storedAccessPermissions(member.permissions)},profiles))
  failure('فعال‌سازی تلفنی برای کارشناسان پاسخ‌گویی مشتری و مسئول نمایندگی‌های خدمات خانگی است.',403);
 return {user,db,member};
}

export function product(id:string,payload:string):PhoneActivationProduct|null{
 const d=JSON.parse(payload);
 if(!['فعال','توقف تولید'].includes(d.status)||!d.name)return null;
 try{
  const months=agreedWarrantyMonths(d.warrantyMonths);
  return months===null?null:{id,name:d.name,model:d.model||'',code:d.code||'',months};
 }catch{return null;}
}

export async function lookup(serial:string){
 const db=storage(),serialKey=await digest(serial),profileId='phone-activation-device:'+serialKey,historyPrefix='phone-activation-event:'+serialKey+':';
 const [devices,activation,profile,legacy,history,caseRow]=await Promise.all([
  db.prepare("SELECT id,payload FROM records WHERE kind='device' AND json_extract(payload,'$.code')=? LIMIT 2").bind(serial).all<{id:string;payload:string}>(),
  db.prepare("SELECT day,months,source FROM service_activations WHERE serial=?").bind(serial).first<{day:string;months:number;source:string}>(),
  db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='phone_activation_device'").bind(profileId).first<{data:string}>(),
  db.prepare(`SELECT data FROM flow_entities WHERE ${legacyMatch} ORDER BY json_extract(data,'$.event.activeDate') DESC,id DESC LIMIT 21`).bind(serial,serial,serial).all<{data:string}>(),
  db.prepare("SELECT data FROM flow_entities WHERE id>=? AND id<? AND type='phone_activation_event' ORDER BY created DESC,id LIMIT 20").bind(historyPrefix,historyPrefix+'~').all<{data:string}>(),
  db.prepare(`SELECT data FROM flow_entities WHERE ${homeCaseMatch} ORDER BY created DESC,id LIMIT 1`).bind(serial).first<{data:string}>(),
 ]);
 const device=devices.results[0],data=device?JSON.parse(device.payload):null,registered=profile?JSON.parse(profile.data):null;
 if(await db.prepare(`SELECT 1 FROM flow_entities WHERE ${hospitalMatch} LIMIT 1`).bind(serial,serial,device?.id||'',device?.id||'').first())
  failure('این سریال به تجهیزات بیمارستانی تعلق دارد.',403);
 const [dist,issued]=await Promise.all([
  device?db.prepare("SELECT payload FROM records WHERE id=? AND kind='distribution'").bind('distribution:'+device.id).first<{payload:string}>():null,
  device?firstWarrantyCodeIssuedAt(device.id):null,
 ]);
 const previous=dist?JSON.parse(dist.payload):null,fromCase=caseRow?JSON.parse(caseRow.data):null;
 const legacyEvents=legacy.results.map(row=>JSON.parse(row.data).event as LegacyActivation);
 const legacyActive=legacyEvents.filter(e=>e.status==='0'&&!e.activeDate.startsWith('1900-'));
 const legacyDays=[...new Set(legacyActive.map(e=>e.activeDate.slice(0,10)))];
 const profileIds=new Set(legacyActive.map(e=>e.details?.profileId).filter(Boolean));
 const nationalIds=new Set(legacyActive.map(e=>e.details?.nationalId).filter(Boolean));
 const ambiguousCustomer=profileIds.size>1||nationalIds.size>1;
 const legacyDossier=legacy.results.length<=20&&!ambiguousCustomer?legacyActive.find(e=>e.details)||legacyActive[0]:undefined;
 const legacyDetails=legacyDossier?.details;
 const activeDay=activation?.day||(issued?dayAt(new Date(issued)):'')||(legacyDays.length===1?legacyDays[0]:'');
 const needsReview=devices.results.length>1||(!activation&&!issued&&legacyEvents.length>0&&(legacyDays.length!==1||ambiguousCustomer||legacy.results.length>20));
 const fallbackCustomer={
  name:legacyCustomerName(legacyDetails)||previous?.customerName||fromCase?.customer,
  mobile:legacyDetails?.mobile||previous?.customerMobile||fromCase?.phone,
  nationalId:legacyDetails?.nationalId||previous?.customerNationalId,postalCode:legacyDetails?.postalCode||previous?.customerPostalCode,
  referrer:legacyDetails?.doctor,telephone:legacyDetails?.telephone,email:legacyDetails?.email,
 };
 const customer=(registered?.customer||fallbackCustomer) as Partial<PhoneActivationCustomer>;
 const knownProduct=registered?.product as PhoneActivationProduct|undefined;
 const rawMonths=data?.warrantyMonths;
 const months=activation?.months??knownProduct?.months??(rawMonths!==undefined&&String(rawMonths).trim()&&/^\d{1,3}$/.test(String(rawMonths))&&Number(rawMonths)<=120?Number(rawMonths):null);
 const result:PhoneActivationDevice={
  serial,state:needsReview?'review':activeDay?'activated':'new',
  basis:activation?.source==='public-warranty'?'سایت نفس‌یار':activation?.source==='phone-activation'?'هم‌نفس':activation||issued?'سابقهٔ فعال‌سازی هم‌نفس':legacyEvents.length?'سوابق سیستم قبلی':'',
  model:data?.model||knownProduct?.model||fromCase?.model||'',productName:data?.productName||knownProduct?.name||'',
  months,devicesKnown:!!(device||registered||activation||issued||legacyEvents.length||caseRow),activatedDay:activeDay,
  dealer:previous?.dealerName||legacyDossier?.agencyName||'',
  customer:Object.fromEntries(Object.entries(customer).filter(([,value])=>typeof value==='string'&&value)),
  legacy:legacyDossier,
  history:history.results.map(row=>{
   const {purpose,at,actorName,reference}=JSON.parse(row.data) as PhoneCodeHistory;
   return {purpose,at,actorName,reference};
  }),
 };
 const snapshot=await digest(JSON.stringify([serial,device?.payload,activation,profile,legacy.results,dist,issued,caseRow]));
 return {result,snapshot,profileId,historyPrefix,device,dist,activation,issued,legacyEvents,caseRow,productId:data?.product||''};
}

export function customerInput(raw:unknown,existing:Partial<PhoneActivationCustomer>):PhoneActivationCustomer{
 const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 if(Object.keys(value).some(key=>!phoneCustomerFields.some(([field])=>field===key)))failure('اطلاعات مشتری معتبر نیست.');
 const name=text(value.name??existing.name,100);
 const mobile=normalizeSerial(text(value.mobile??existing.mobile,20)).replace(/^\+98/,'0');
 const nationalId=normalizeSerial(text(value.nationalId??existing.nationalId,15));
 const suppliedPostalCode=value.postalCode??existing.postalCode??'';
 const postalCode=typeof suppliedPostalCode==='string'?normalizeSerial(suppliedPostalCode):failure('کد پستی واردشده باید ۱۰ رقم باشد.');
 const referrer=text(value.referrer??existing.referrer,120);
 if(!name||!/^09\d{9}$/.test(mobile))failure('نام کامل و شماره همراه معتبر مشتری لازم است.');
 const sum=[...nationalId.slice(0,9)].reduce((n,d,i)=>n+Number(d)*(10-i),0)%11;
 if(!/^\d{10}$/.test(nationalId)||/^(\d)\1{9}$/.test(nationalId)||Number(nationalId[9])!==(sum<2?sum:11-sum))failure('کد ملی مشتری معتبر نیست.');
 if(postalCode&&!/^\d{10}$/.test(postalCode))failure('کد پستی واردشده باید ۱۰ رقم باشد.');
 return {name,mobile,nationalId,postalCode,referrer};
}

export async function GET(request:Request){
 try{
  const {user,db}=await actor(request),q=new URL(request.url).searchParams;
  if(q.get('view')==='history'||q.get('view')==='history-agencies')return json({accountId:user.userId,...await phoneActivationHistory(q)});
  if(q.get('view')==='products'){
   const key=text(q.get('query'),80);
   const rows=await db.prepare(`SELECT id,payload FROM records WHERE kind='product'
    AND json_extract(payload,'$.status') IN ('فعال','توقف تولید')
    AND json_type(payload,'$.warrantyMonths') IS NOT NULL
    AND (?='' OR instr(json_extract(payload,'$.name')||' '||coalesce(json_extract(payload,'$.model'),'')||' '||coalesce(json_extract(payload,'$.code'),''),?)>0)
    ORDER BY json_extract(payload,'$.name'),id LIMIT 60`).bind(key,key).all<{id:string;payload:string}>();
   return json({accountId:user.userId,products:rows.results.flatMap(row=>product(row.id,row.payload)||[])});
  }
  const purpose=q.get('purpose');
  if(purpose!=='activate'&&purpose!=='board')failure('نوع درخواست را انتخاب کنید.');
  const {result,snapshot,productId}=await lookup(deviceSerial(q.get('serial')));
  const legacy=result.legacy;
  const boardLegacy=legacy&&{...legacy,details:{issuedCode:legacy.details?.issuedCode,agencyActive:legacy.details?.agencyActive,agencyCity:legacy.details?.agencyCity}};
  const device=purpose==='board'?{...result,customer:{},legacy:boardLegacy}:result;
  return json({accountId:user.userId,device,snapshot,today:dayAt(),linkedProductId:productId});
 }catch(error){return accessResponse(error)||jsonError('خواندن شناسنامهٔ دستگاه انجام نشد.',503);}
}

const jsonError=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const {user,db,member}=await actor(request);
  let body:Record<string,unknown>;
  try{body=JSON.parse(new TextDecoder().decode(await boundedBody(request,6000)));}catch{failure('درخواست معتبر نیست.');}
  if(!body!||Array.isArray(body!)||typeof body!=='object'||Object.keys(body!).some(key=>!['id','serial','snapshot','purpose','deviceCode','customer','productId','reference','confirmed'].includes(key)))failure('درخواست معتبر نیست.');
  const {id,purpose,confirmed,snapshot,deviceCode,productId,customer,reference}=body!;
  if(typeof purpose!=='string'||confirmed!==true||typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!['activate','board'].includes(String(purpose)))failure('انتخاب نوع عملیات و تأیید لازم است.');
  const serial=deviceSerial(body!.serial);
  let code:string;
  try{code=generateActivationCode(deviceCode);}catch(error){failure((error as Error).message);}
  const requestKey=await digest(JSON.stringify([serial,purpose,deviceCode,productId,customer,reference]));
  const previous=await db.prepare("SELECT actor,payload FROM inventory_operations WHERE id=? AND kind='phone_activation'").bind(id).first<{actor:string;payload:string}>();
  const reply=(payload:{requestKey:string;actorName:string;at:string;activatedDay:string;first:boolean})=>{
   if(payload.requestKey!==requestKey)failure('شناسهٔ درخواست قبلاً استفاده شده است.',409);
   const {actorName,at,activatedDay,first}=payload;
   return json({accountId:user.userId,activationCode:code!,actorName,at,activatedDay,first});
  };
  if(previous){
   if(previous.actor!==user.userId)failure('این درخواست به حساب دیگری تعلق دارد.',409);
   return reply(JSON.parse(previous.payload));
  }
  const found=await lookup(serial),known=found.result;
  if(snapshot!==found.snapshot)failure('شناسنامه تغییر کرده است. سریال را دوباره بررسی کنید.',409);
  if(known.state==='review')failure('سابقهٔ این سریال نیاز به بررسی دارد. صدور کد برای این شناسنامه متوقف است.',409);
  const first=purpose==='activate'&&known.state==='new';
  if(!first&&(customer!==undefined||productId!==undefined))failure('اطلاعات مشتری و محصول فقط برای فعال‌سازی اولیه ثبت می‌شوند.');
  if(purpose==='board'&&!known.devicesKnown)failure('دستگاهی با این سریال در شناسنامه یا سوابق خدمات پیدا نشد.',404);
  const at=new Date().toISOString(),activatedDay=first?dayAt(new Date(at)):known.activatedDay;
  const details={requestKey,actorName:user.name,at,activatedDay,first};
  const legacyAgencyId=known.legacy?.agencyId||'';
  const distribution=found.dist?JSON.parse(found.dist.payload):null;
  const salesAgencies=distribution?.dealerCode?(await db.prepare("SELECT id FROM flow_entities WHERE type='sales_agent' AND json_extract(data,'$.code')=? AND json_extract(data,'$.kind') IN ('representative','reseller') ORDER BY id LIMIT 2")
   .bind(distribution.dealerCode).all<{id:string}>()).results:[];
  const event={purpose:purpose as PhoneActivationPurpose,serial,first,at,day:dayAt(new Date(at)),
   actorName:user.name,actorId:user.userId,reference:text(reference,180),dealer:known.dealer,
   legacyAgencyId,legacyActivationId:known.legacy?.activeId||'',salesAgencyId:salesAgencies.length===1?salesAgencies[0].id:'',
  };
  const ops=[db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'phone_activation',?,?,?,1)").bind(id,JSON.stringify(details),user.userId,at)];
  const guard=(sql:string,...args:unknown[])=>ops.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN "+sql+" THEN 1 ELSE 0 END WHERE id=?").bind(...args,id));
  if(member)guard("EXISTS(SELECT 1 FROM app_members m JOIN flow_entities a ON a.id='member-role-assignment:'||m.id AND a.type='member_role_assignment' WHERE m.id=? AND m.status='active' AND m.permissions=? AND m.subject IS ? AND a.data=?)",member!.id,member!.permissions,member!.subject,member!.assignment);
  guard('NOT EXISTS(SELECT 1 FROM flow_entities WHERE '+hospitalMatch+')',serial,serial,found.device?.id||'',found.device?.id||'');
  if(found.device)guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='device' AND payload=?)",found.device.id,found.device.payload);
  else guard("NOT EXISTS(SELECT 1 FROM records WHERE kind='device' AND json_extract(payload,'$.code')=?)",serial);
  if(found.activation)guard('EXISTS(SELECT 1 FROM service_activations WHERE serial=? AND day=? AND months=? AND source=?)',serial,found.activation.day,found.activation.months,found.activation.source);
  else if(found.legacyEvents.length)guard('EXISTS(SELECT 1 FROM flow_entities WHERE '+legacyMatch+')',serial,serial,serial);
  else if(!first&&!found.device&&found.caseRow)guard('EXISTS(SELECT 1 FROM flow_entities WHERE '+homeCaseMatch+')',serial);
  if(first){
   const person=customerInput(customer,known.customer);
   let selection:PhoneActivationProduct|null=null,months=known.months;
   if(months===null){
    const selectedId=found.productId||text(productId,200);
    const selected=await db.prepare("SELECT id,payload FROM records WHERE id=? AND kind='product'").bind(selectedId).first<{id:string;payload:string}>();
    selection=selected&&product(selected.id,selected.payload);
    if(!selection)failure('مدل دارای مدت گارانتی مشخص را از شناسنامهٔ محصولات انتخاب کنید.');
    months=selection!.months;
    guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='product' AND payload=?)",selected!.id,selected!.payload);
   }
   if(found.device){
    guard('NOT EXISTS(SELECT 1 FROM access_audit WHERE target=? AND action=?)','warranty:'+found.device.id,WARRANTY_CODE_ISSUED);
    guard("COALESCE((SELECT payload FROM records WHERE id=? AND kind='distribution'),'')=?",'distribution:'+found.device.id,found.dist?.payload||'');
   }
   guard('NOT EXISTS(SELECT 1 FROM flow_entities WHERE '+legacyMatch+')',serial,serial,serial);
   ops.push(db.prepare("INSERT INTO service_activations(serial,day,months,source,created,actor) VALUES(?,?,?,'phone-activation',?,?)").bind(serial,activatedDay,months,at,user.userId));
   ops.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'phone_activation_device',?,1,?,?)").bind(found.profileId,JSON.stringify({serial,customer:person,product:selection||{id:found.productId,name:known.productName,model:known.model,months},actorId:user.userId,actorName:user.name,at}),at,at));
   if(found.device)ops.push(db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,'warranty:'+found.device.id,WARRANTY_CODE_ISSUED,JSON.stringify({operationId:id}),at));
  }
  ops.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'phone_activation_event',?,1,?,?)").bind(found.historyPrefix+id,JSON.stringify(event),at,at));
  try{await db.batch(ops);}catch(error){
   const retry=await db.prepare("SELECT actor,payload FROM inventory_operations WHERE id=? AND kind='phone_activation'").bind(id).first<{actor:string;payload:string}>();
   if(retry?.actor===user.userId)return reply(JSON.parse(retry.payload));
   throw error;
  }
  return reply(details);
 }catch(error){return accessResponse(error)||jsonError('ثبت کد انجام نشد. شناسنامه را دوباره بررسی کنید.',409);}
}
