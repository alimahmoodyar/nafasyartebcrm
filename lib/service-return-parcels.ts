import {storage} from './storage';
import {AccessError} from './authorization';
import type {Session} from './permissions';
import {liveSalesUser,salesLock} from './sales';
import {memberId,dayAt} from './duties';
import {domainWriteAccess,role} from './service-access';
import {transportDriver} from './transport';
import {identityAuthorityGuard} from './representative-identity';
import {parseReturnCarton} from './service-return-parcel-contract';
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const uuid=(s:any)=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const text=(v:any,max=200,required=true)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())fail('اطلاعات لازم را کامل کنید.');return v.trim()};
const row=(r:any)=>r?{...r,data:JSON.parse(r.data)}:null;
const get=async(id:string,type:string)=>row(await storage().prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(id,type).first());
export const parcelExpert=(u:Session)=>!u.permissions.serviceAgentId&&!u.permissions.salesAgentId&&!u.permissions.hospitalCenterId&&domainWriteAccess(u,'home')&&(role(u,'coordinator')||role(u,'inventory'));
const manager=(u:Session)=>!u.permissions.serviceAgentId&&!u.permissions.salesAgentId&&!u.permissions.hospitalCenterId&&domainWriteAccess(u,'home')&&role(u,'manager');
const driver=(u:Session)=>!u.permissions.serviceAgentId&&!u.permissions.salesAgentId&&!u.permissions.hospitalCenterId&&transportDriver(u);
async function ownAgent(u:Session,id:string){const a=await get(id,'as_agent');if(!a||a.data.domain!=='home'||!a.data.active||!u.isAdmin&&!(parcelExpert(u)||u.permissions.serviceAgentId===a.id&&u.permissions.serviceDomains?.includes('home')&&u.permissions.serviceRoles?.includes('agent')))fail('نمایندگی در دسترسی شما نیست.',404);return a;}
export async function returnParcelAccess(actor:Session,id:string,cartonId=''){
 const u=await liveSalesUser(actor),p=await get(id,'as_return_parcel');if(!p||p.data.domain!=='home')fail('مرسوله در دسترسی شما نیست.',404);
 const carton=cartonId?p.data.cartons.find((c:any)=>c.id===cartonId):null;if(cartonId&&!carton)fail('کارتن پیدا نشد.',404);
 if(!u.isAdmin&&!parcelExpert(u)){
 if(u.permissions.serviceAgentId){await ownAgent(u,p.data.agentId)}
 else if(driver(u)){const mid=await memberId(u);if(!carton||['prepared','cancelled'].includes(p.data.state)||carton.driverId&&carton.driverId!==mid)fail('کارتن در دسترسی شما نیست.',404)}
 else fail('مرسوله در دسترسی شما نیست.',404);
 }
 return {u,parcel:p,carton};
}
function publicParcel(u:Session,p:any,carton:any){
 const d=p.data,driverView=driver(u)&&!parcelExpert(u)&&!u.isAdmin;
 // Driver gets the scanned package's transport data, never repair/customer/financial records.
 return {...p,data:{domain:d.domain,agentId:driverView?undefined:d.agentId,code:d.code,state:d.state,sender:d.sender,recipient:d.recipient,tracking:d.tracking||'',sentDay:d.sentDay||'',createdBy:driverView?undefined:d.createdBy,cartons:(carton?[carton]:d.cartons).map((c:any)=>({...c,driverId:driverView?undefined:c.driverId,items:c.items.map((i:any)=>driverView?{claimId:i.claimId,partCode:i.partCode,name:i.name,quantity:i.quantity,serial:i.serial}:{...i})})),history:driverView?undefined:d.history}};
}
export async function readReturnParcels(actor:Session,q:URLSearchParams){
 const u=await liveSalesUser(actor),db=storage(),code=q.get('code'),parsed=code?parseReturnCarton(code):null;if(code&&!parsed)fail('QR کارتن معتبر نیست.');
 if(q.has('workspace')){
  if(q.get('workspace')!=='expert')fail('بخش معتبر نیست.');
  if(!parcelExpert(u)||!role(u,'coordinator'))fail('دسترسی بررسی داغی خدمات خانگی لازم است.',403);
  const view=q.get('view')||'waiting',page=Number(q.get('page')||1),search=text(q.get('q')||'',100,false);
  if(!['waiting','progress','history'].includes(view)||!Number.isSafeInteger(page)||page<1||page>1000000)fail('بخش یا صفحه معتبر نیست.');
  // Each list row is one carton, not a whole multi-carton shipment. Frozen item
  // decisions survive rejection/repacking and never borrow a later parcel's review.
  const cte=`WITH cartons AS (SELECT p.id parcelId,p.created,json_extract(p.data,'$.code') code,json_extract(p.data,'$.sender.name') sender,COALESCE(json_extract(p.data,'$.tracking'),'') tracking,c.value box FROM flow_entities p,json_each(p.data,'$.cartons') c WHERE p.type='as_return_parcel' AND json_extract(p.data,'$.domain')='home' AND json_extract(c.value,'$.state') IN ('sent','with_driver','office_partial','received')), buckets AS (SELECT *,CASE WHEN json_extract(box,'$.state')='received' AND NOT EXISTS(SELECT 1 FROM json_each(box,'$.items') i WHERE json_type(i.value,'$.review') IS NULL) THEN 'history' WHEN json_extract(box,'$.state')='office_partial' OR EXISTS(SELECT 1 FROM json_each(box,'$.items') i WHERE json_type(i.value,'$.review') IS NOT NULL) THEN 'progress' ELSE 'waiting' END bucket FROM cartons)`;
  const counts:Record<string,number>={waiting:0,progress:0,history:0};
  for(const r of (await db.prepare(cte+' SELECT bucket,COUNT(*) n FROM buckets GROUP BY bucket').all()).results as any[])counts[r.bucket]=r.n;
  const where=`bucket=? AND (?='' OR instr(code,?)>0 OR instr(sender,?)>0 OR instr(tracking,?)>0 OR EXISTS(SELECT 1 FROM json_each(box,'$.items') i WHERE instr(COALESCE(json_extract(i.value,'$.serial'),''),?)>0 OR instr(COALESCE(json_extract(i.value,'$.partCode'),''),?)>0 OR instr(COALESCE(json_extract(i.value,'$.caseId'),''),?)>0))`,args=[view,search,search,search,search,search,search,search];
  const total:any=await db.prepare(cte+' SELECT COUNT(*) n FROM buckets WHERE '+where).bind(...args).first();
  const rows=(await db.prepare(cte+' SELECT parcelId,code,sender,tracking,box,bucket FROM buckets WHERE '+where+' ORDER BY created,parcelId,json_extract(box,\'$.number\') LIMIT 20 OFFSET ?').bind(...args,(page-1)*20).all()).results.map((r:any)=>{const box=JSON.parse(r.box);return {parcelId:r.parcelId,cartonId:box.id,number:box.number,code:r.code,sender:r.sender,tracking:r.tracking,state:box.state,bucket:r.bucket,items:box.items.length,reviewed:box.items.filter((i:any)=>i.review).length}});
  return {rows,counts,total:total?.n||0,page,pages:Math.max(1,Math.ceil((total?.n||0)/20))};
 }
 const id=parsed?.parcelId||q.get('id')||'',cartonId=parsed?.cartonId||q.get('cartonId')||'';
 if(id){const access=await returnParcelAccess(u,id,cartonId),p=access.parcel,carton=access.carton;const claimIds=(carton?[carton]:p.data.cartons).flatMap((c:any)=>c.items.map((i:any)=>i.claimId));
 const claims=parcelExpert(u)||u.isAdmin||u.permissions.serviceAgentId?(await db.prepare("SELECT id,revision,data FROM flow_entities WHERE type='as_claim' AND id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(claimIds)).all()).results.map((r:any)=>{const d=JSON.parse(r.data),item=p.data.cartons.flatMap((c:any)=>c.items).find((i:any)=>i.claimId===r.id),decision=item?.review;return {id:r.id,revision:r.revision,caseId:d.caseId,state:decision?.state||d.state,review:decision?.notes||d.review||'',reviewAllowed:d.returnParcelId===p.id&&!decision,partCode:d.partCode,serial:d.serial,receivedDay:d.receivedDay||''}}):[];
 return {parcel:publicParcel(u,p,carton),cartonId,claims,canPrint:!!(u.isAdmin||u.permissions.serviceAgentId||parcelExpert(u)&&role(u,'coordinator')),canCollect:driver(u)&&!['prepared','cancelled'].includes(p.data.state)&&carton?.state==='sent',canReceive:parcelExpert(u)&&!['prepared','cancelled'].includes(p.data.state),canDispatch:!!(u.permissions.serviceAgentId||parcelExpert(u)&&role(u,'coordinator')||u.isAdmin)&&p.data.state==='prepared',canCancel:!!(u.permissions.serviceAgentId||parcelExpert(u)&&role(u,'coordinator')||u.isAdmin)&&p.data.state==='prepared',canReview:parcelExpert(u)&&role(u,'coordinator')};}
 const isDriver=driver(u)&&!parcelExpert(u)&&!u.isAdmin,page=Number(q.get('page')||1);if(!Number.isSafeInteger(page)||page<1)fail('صفحه معتبر نیست.');
 if(!u.isAdmin&&!parcelExpert(u)&&!u.permissions.serviceAgentId&&!isDriver)fail('دسترسی ارسال داغی ندارید.',403);
 const driverMember=isDriver?await memberId(u):'';let clause="type='as_return_parcel'",args:any[]=[];
 if(u.permissions.serviceAgentId){await ownAgent(u,u.permissions.serviceAgentId);clause+=" AND json_extract(data,'$.agentId')=?";args.push(u.permissions.serviceAgentId)}
 if(isDriver){clause+=" AND EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.cartons')) c WHERE json_extract(c.value,'$.driverId')=?)";args.push(await memberId(u));}
 const search=text(q.get('q')||'',100,false);if(search){clause+=" AND (instr(json_extract(data,'$.code'),?)>0 OR instr(json_extract(data,'$.sender.name'),?)>0 OR instr(COALESCE(json_extract(data,'$.tracking'),''),?)>0)";args.push(search,search,search)}
 const total:any=await db.prepare('SELECT COUNT(*) n FROM flow_entities WHERE '+clause).bind(...args).first(),parcels=(await db.prepare('SELECT * FROM flow_entities WHERE '+clause+' ORDER BY created DESC,id LIMIT 20 OFFSET ?').bind(...args,(page-1)*20).all()).results.map((r:any)=>{const p=row(r);if(isDriver){const owned=p.data.cartons.filter((c:any)=>c.driverId===driverMember);p.data={...p.data,cartons:owned}}return {id:p.id,revision:p.revision,code:p.data.code,state:p.data.state,sender:p.data.sender.name,cartons:p.data.cartons.map((c:any)=>({id:c.id,number:c.number,state:c.state}))}});
 const agentId=u.permissions.serviceAgentId||q.get('agentId')||'';let available:any[]=[],agent:any=null;
 if(!isDriver&&agentId){agent=await ownAgent(u,agentId);const claimSearch=text(q.get('claimQ')||'',100,false);available=(await db.prepare("SELECT id,revision,data FROM flow_entities WHERE type='as_claim' AND json_extract(data,'$.agentId')=? AND json_extract(data,'$.domain')='home' AND json_extract(data,'$.state') IN ('awaiting_return','rejected') AND COALESCE(json_extract(data,'$.returnParcelId'),'')='' AND COALESCE(json_extract(data,'$.transportId'),'')='' AND (?='' OR instr(COALESCE(json_extract(data,'$.serial'),''),?)>0 OR instr(json_extract(data,'$.partCode'),?)>0 OR instr(json_extract(data,'$.caseId'),?)>0) ORDER BY created,id LIMIT 100").bind(agentId,claimSearch,claimSearch,claimSearch,claimSearch).all()).results.map((r:any)=>{const d=JSON.parse(r.data);return {id:r.id,revision:r.revision,caseId:d.caseId,partCode:d.partCode,quantity:d.quantity,serial:d.serial,state:d.state}});}
 const destination=await get('as-return-destination:home','as_return_destination');return {parcels,total:total?.n||0,page,pages:Math.max(1,Math.ceil((total?.n||0)/20)),available,agent:agent?{id:agent.id,name:agent.data.name}:null,destination:!isDriver?destination?{revision:destination.revision,...destination.data}:null:undefined,canConfigure:manager(u),canCreate:!!(u.isAdmin||u.permissions.serviceAgentId||parcelExpert(u)&&role(u,'coordinator')),driver:isDriver};
}
function contact(b:any){return {name:text(b?.name),city:text(b?.city),phone:text(b?.phone,50),address:text(b?.address,1000),postalCode:text(b?.postalCode||'',10,false)};}
export async function applyReturnParcel(actor:Session,b:any){
 const u=await liveSalesUser(actor),db=storage();if(b?.confirmed!==true||!uuid(b.id)||!['destination','create','dispatch','collect','receive','cancel'].includes(b.mode))fail('شناسه، مرحله و تأیید معتبر لازم است.');
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT * FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(prior){if(prior.actor!==u.userId||prior.kind!=='as_return_parcel_'+b.mode||prior.payload!==signature)fail('شناسه برای درخواست دیگری استفاده شده است.',409);return {saved:true,repeated:true,id:b.mode==='create'?b.id:b.parcelId||'as-return-destination:home'};}
 const now=new Date().toISOString(),stamp={by:u.userId,name:u.name,at:now,profile:u.profileReview?.id||''},checks:D1PreparedStatement[]=[],writes:D1PreparedStatement[]=[];
 const guard=(sql:string,...args:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+sql+' THEN guard ELSE 0 END WHERE id=?').bind(...args,b.id));
 const lock=(r:any)=>guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',r.id,r.revision);
 const put=(id:string,type:string,data:any,old?:any)=>writes.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,id,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(data),now,now));
 let id=b.parcelId||b.id,changed:any={};
 if(b.mode==='destination'){
 if(!manager(u))fail('تنظیم نشانی دریافت با مدیر خدمات خانگی است.',403);id='as-return-destination:home';const old=await get(id,'as_return_destination');if(b.revision!==(old?.revision||0))fail('نشانی شرکت تغییر کرده؛ تازه‌سازی کنید.',409);if(old)lock(old);else guard('NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?)',id);changed={...contact(b.data),updatedBy:stamp};put(id,'as_return_destination',changed,old);
 }else if(b.mode==='create'){
 if(!u.isAdmin&&!u.permissions.serviceAgentId&&!(parcelExpert(u)&&role(u,'coordinator')))fail('بسته‌بندی با نماینده یا کارشناس مسئول است.',403);
 const a=await ownAgent(u,b.agentId||u.permissions.serviceAgentId||'');lock(a);const dest=await get('as-return-destination:home','as_return_destination');if(!dest)fail('مدیر خدمات باید ابتدا نشانی دریافت داغی شرکت را تنظیم کند.',409);lock(dest);
 const identity=a.data.identityId?await get(a.data.identityId,'representative_identity'):null;if(identity)lock(identity);const approved=identity?.data.approved,source=approved||a.data,sender=contact({name:source.tradeName||source.name,city:source.city,phone:source.mobile||source.phone,address:source.address,postalCode:source.postalCode||''});
 if(!Array.isArray(b.cartons)||!b.cartons.length||b.cartons.length>20)fail('۱ تا ۲۰ کارتن مجاز است.');const seen=new Set<string>();let total=0;const cartons=[];
 for(const [index,input] of b.cartons.entries()){
 if(!Array.isArray(input?.claimIds)||!input.claimIds.length)fail('هر کارتن باید حداقل یک ردیف داغی داشته باشد.');const items=[];
 for(const claimId of input.claimIds){if(typeof claimId!=='string'||claimId.length>200||seen.has(claimId)||++total>100)fail('حداکثر ۱۰۰ ردیف یکتا در هر مرسوله مجاز است.');seen.add(claimId);const c=await get(claimId,'as_claim');if(!c||c.data.domain!=='home'||c.data.agentId!==a.id||!['awaiting_return','rejected'].includes(c.data.state)||c.data.returnParcelId||c.data.transportId)fail('داغی انتخابی آمادهٔ بسته‌بندی نیست یا متعلق به این نماینده نیست.',409);lock(c);
 const repair=await get(c.data.caseId,'as_case');if(!repair||repair.data.agentId!==a.id||repair.data.domain!=='home'||!repair.data.reportSubmittedAt)fail('گزارش تعمیر داغی باید کامل و ارسال‌شده باشد.',409);lock(repair);
 const material=await get('material:'+c.data.partCode,'material'),item={claimId:c.id,caseId:c.data.caseId,serial:c.data.serial,partCode:c.data.partCode,name:material?.data.name||c.data.partCode,quantity:c.data.quantity};items.push(item);put(c.id,'as_claim',{...c.data,returnParcelId:b.id,history:[...(c.data.history||[]),{mode:'parcel_pack',...stamp,parcelId:b.id}]},c);
 }
 cartons.push({id:crypto.randomUUID(),number:index+1,state:'prepared',items,receivedClaimIds:[]});
 }
 changed={domain:'home',agentId:a.id,code:'RET-'+b.id.slice(0,8).toUpperCase(),state:'prepared',sender:{...sender,agencyCode:a.data.code||''},recipient:contact(dest.data),cartons,createdBy:stamp,history:[{mode:'create',...stamp}]};put(b.id,'as_return_parcel',changed);
 }else{
 const {parcel:p,carton}=await returnParcelAccess(u,text(b.parcelId),b.cartonId||'');if(b.revision!==p.revision)fail('مرسوله تغییر کرده؛ دوباره دریافت کنید.',409);lock(p);const d=p.data;
 if(b.mode==='dispatch'||b.mode==='cancel'){
 if(!u.isAdmin&&!u.permissions.serviceAgentId&&!(parcelExpert(u)&&role(u,'coordinator')))fail('ارسال با نماینده یا کارشناس مسئول است.',403);
 await ownAgent(u,d.agentId);if(d.state!=='prepared')fail('مرسوله در مرحلهٔ آماده‌سازی نیست.',409);
 if(b.mode==='dispatch'){d.tracking=text(b.tracking,300);d.sentDay=text(b.day,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d.sentDay)||Number.isNaN(Date.parse(d.sentDay))||new Date(d.sentDay).toISOString().slice(0,10)!==d.sentDay||d.sentDay>dayAt()||d.sentDay<dayAt(new Date(p.created)))fail('تاریخ واقعی ارسال معتبر نیست.');d.state='sent';d.sentAt=now;}
 else d.state='cancelled';
 for(const box of d.cartons){box.state=d.state;for(const i of box.items){const c=await get(i.claimId,'as_claim');if(!c||c.data.returnParcelId!==p.id||!['awaiting_return','rejected'].includes(c.data.state))fail('داغی تغییر کرده است.',409);lock(c);const next={...c.data,...(b.mode==='dispatch'?{state:'sent',tracking:d.tracking,sentDay:d.sentDay,sentAt:now}:{}),history:[...(c.data.history||[]),{mode:'parcel_'+b.mode,parcelId:p.id,...stamp}]};if(b.mode==='cancel')delete next.returnParcelId;put(c.id,'as_claim',next,c);}}
 }else if(b.mode==='collect'){
 if(!driver(u)||!carton||d.state==='prepared'||d.state==='cancelled'||carton.state!=='sent'||b.physicallyReceived!==true)fail('دریافت فیزیکی کارتنِ ارسال‌شده باید توسط راننده تأیید شود.',403);
 carton.driverId=await memberId(u);if(!carton.driverId)fail('حساب راننده معتبر نیست.',403);carton.state='with_driver';carton.collected={...stamp,condition:text(b.condition,1000),result:['complete','shortage','damage'].includes(b.result)?b.result:fail('نتیجه دریافت لازم است.')};
 }else if(b.mode==='receive'){
 if(!parcelExpert(u)||!carton||!['sent','with_driver','office_partial'].includes(carton.state)||b.physicallyReceived!==true)fail('دریافت واقعی شرکت و دسترسی کارشناس لازم است.',403);
 const selected=b.claimIds;if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some((id:any)=>!carton.items.some((i:any)=>i.claimId===id)||carton.receivedClaimIds.includes(id)))fail('فقط ردیف‌های واقعاً دریافت‌شدهٔ همین کارتن را انتخاب کنید.',409);
 const location=text(b.location,100);for(const claimId of selected){const c=await get(claimId,'as_claim');if(!c||c.data.returnParcelId!==p.id||c.data.state!=='sent')fail('داغی قبلاً دریافت شده یا تغییر کرده است.',409);lock(c);put(c.id,'as_claim',{...c.data,state:'received',receivedDay:dayAt(),receivedAt:now,receivedBy:u.userId,location,history:[...(c.data.history||[]),{mode:'return_receive',parcelId:p.id,cartonId:carton.id,...stamp}]},c);}
 carton.receivedClaimIds.push(...selected);carton.state=carton.receivedClaimIds.length===carton.items.length?'received':'office_partial';carton.receivedBy=stamp;carton.location=location;
 }
 if(!['dispatch','cancel'].includes(b.mode)){d.state=d.cartons.every((c:any)=>c.state==='received')?'received':d.cartons.some((c:any)=>['received','office_partial'].includes(c.state))?'office_partial':d.cartons.some((c:any)=>c.state==='with_driver')?'with_driver':'sent';}
 d.history=[...(d.history||[]),{mode:b.mode,cartonId:b.cartonId||'',notes:text(b.notes||'',2000,false),...stamp}];changed={state:d.state,cartonId:b.cartonId||''};put(p.id,p.type,d,p);
 }
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'as_return_parcel_'+b.mode,signature,u.userId,now),...await salesLock(db,b.id),...await identityAuthorityGuard(u,b.id),...checks,...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'as_return_parcel_'+b.mode,JSON.stringify({request:b,...changed,actor:stamp}),now)]);
 return {saved:true,id};
}
