import {serviceCollection} from './service-collection';
import {storage} from './storage';
import {trainingContext} from './training-context';
import {AccessError} from './authorization';
import {serviceCommercialPermissions,calculatedLabor} from './service-commercial-contract';
import {req,txt,amount,qty,date,ledger,decode,list} from './after-sales';
import type {Session} from './permissions';
import {dayAt} from './duties';

export async function serviceCommercialWorkspace(u:Session){
 const rights=serviceCommercialPermissions(u),own=u.permissions.serviceAgentId;
 if(own&&(!u.permissions.serviceDomains?.includes('home')||!u.permissions.serviceRoles?.includes('agent')))throw new AccessError('دسترسی نماینده خدمات خانگی لازم است.',403);
 if(!Object.values(rights).some(Boolean)&&!own&&!(u.permissions.serviceDomains?.includes('home')&&u.permissions.serviceRoles?.length))throw new AccessError('دسترسی اعتبار و تعرفه خدمات ندارید.',403);
 const agents=(await list('as_agent')).filter(a=>a.data.domain==='home'&&(!own||a.id===own));
 if(own&&!agents.some(a=>a.id===own&&a.data.active))throw new AccessError('نماینده فعال خدمات خانگی لازم است.',403);
 const requests=(await list('as_commercial_request')).filter(r=>r.data.domain==='home'&&(!own||r.data.agentId===own));
 const works=(await list('as_service_work')).filter(r=>r.data.domain==='home');
 const policies=(await list('as_service_labor_policy')).filter(r=>r.data.domain==='home');
 const tariffs=(await list('as_tariff')).filter(r=>r.data.domain==='home');
 const accounts=await Promise.all(agents.map(async a=>{const rows=await ledger(a.id);const exposure=rows.reduce((n:bigint,r:any)=>n+BigInt(r.debit||0)-BigInt(r.credit||0),BigInt(0));return {agentId:a.id,outstandingRial:(exposure>BigInt(0)?exposure:BigInt(0)).toString(),limitRial:a.data.creditLimitRial??null,...await serviceCollection(a.id)};}));
 return {rights,agents:agents.map(a=>({id:a.id,revision:a.revision,data:{name:a.data.name,active:a.data.active,creditLimitRial:a.data.creditLimitRial??null}})),requests,works,policy:policies[0]||null,tariffs:own?tariffs.map(t=>({...t,data:{...t.data,costRial:undefined}})):tariffs,accounts,materials:own?[]:(await list('material')).map(m=>({code:m.data.code,name:m.data.name}))};
}

export async function applyServiceCommercial(u:Session,b:any){
 const db=storage(),rights=serviceCommercialPermissions(u),mode=req(b.mode),id=req(b.id),now=new Date().toISOString(),today=dayAt();
 if(b.domain!=='home'||b.confirmed!==true||!/^[a-f0-9-]{36}$/i.test(id))throw new AccessError('حوزه خانگی، تأیید ثبت و شناسه عملیات معتبر لازم است.',400);
 const allowed=mode==='credit_propose'?rights.expert:mode==='credit_decide'||mode==='part_price_propose'||mode==='work_define'?rights.manager:mode==='part_price_decide'?rights.finance:mode==='labor_publish'?rights.ceo:false;
 if(!allowed)throw new AccessError('مجوز این مرحله اعتبار و تعرفه خدمات را ندارید.',403);
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT * FROM inventory_operations WHERE id=?').bind(id).first();
 if(prior){if(prior.actor!==u.userId||prior.kind!=='service_commercial_'+mode||prior.payload!==signature)throw new AccessError('شناسه عملیات برای درخواست دیگری استفاده شده است.',409);const audit:any=await db.prepare("SELECT target FROM access_audit WHERE actor=? AND action=? AND json_extract(after,'$.request.id')=?").bind(u.userId,'service_commercial_'+mode,id).first();if(!audit)throw new AccessError('نتیجه عملیات قبلی در دسترس نیست.',409);return {saved:true,repeated:true,id:audit.target};}
 const checks:D1PreparedStatement[]=[],writes:D1PreparedStatement[]=[];let target=id;
 const guard=(sql:string,...values:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+sql+' THEN guard ELSE 0 END WHERE id=?').bind(...values,id));
 const get=async(eid:string,type:string)=>{const row:any=await db.prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(eid,type).first();if(!row)throw new AccessError('رکورد مرتبط پیدا نشد.',404);const e=decode(row);if(e.data.domain!=='home')throw new AccessError('رکورد متعلق به خدمات خانگی نیست.',403);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',e.id,e.revision);return e;};
 const put=(eid:string,type:string,data:any,old?:any)=>writes.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,eid,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(eid,type,JSON.stringify(data),now,now));
 const actor={by:u.userId,byName:u.name,profile:u.profileReview?.id||trainingContext.getStore()?.role||'',at:now,actualTester:trainingContext.getStore()?.actor||u.userId};
 const revision=(e:any)=>{if(b.revision!==e.revision)throw new AccessError('اطلاعات تغییر کرده؛ فرم را تازه کنید.',409);};
 const independent=(r:any)=>{if(r.data.submitted?.by===u.userId&&!u.isAdmin&&!u.profileReview&&!trainingContext.getStore())throw new AccessError('ثبت‌کننده نمی‌تواند درخواست خودش را تأیید کند.',403);};
 if(mode==='credit_propose'){
  const a=await get(req(b.agentId),'as_agent');if(!a.data.active)throw new AccessError('نماینده غیرفعال است.',400);
  const limitRial=amount(b.limitRial);put(id,'as_commercial_request',{domain:'home',kind:'credit',state:'pending',agentId:a.id,agentName:a.data.name,limitRial,notes:req(b.notes),submitted:actor});
 }else if(mode==='part_price_propose'){
  const code=req(b.partCode,12),m:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='material'").bind('material:'+code).first();if(!m)throw new AccessError('قطعه باید از شناسنامه کالای انبار مرکزی انتخاب شود.',400);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',m.id,m.revision);
  const optional=(v:any)=>v===undefined||v===null||txt(v)===''?null:amount(v),priceRial=optional(b.priceRial),consumerPriceRial=optional(b.consumerPriceRial);if(priceRial===null&&consumerPriceRial===null)throw new AccessError('حداقل یک قیمت قطعه لازم است.',400);
  put(id,'as_commercial_request',{domain:'home',kind:'part_price',state:'pending',partCode:code,name:JSON.parse(m.data).name,priceRial,consumerPriceRial,costRial:null,validFrom:date(b.validFrom),notes:req(b.notes),submitted:actor});
 }else if(mode==='credit_decide'||mode==='part_price_decide'){
  const r=await get(req(b.requestId),'as_commercial_request');revision(r);independent(r);if(r.data.state!=='pending'||r.data.kind!==(mode==='credit_decide'?'credit':'part_price')||typeof b.approved!=='boolean')throw new AccessError('درخواست قابل بررسی نیست.',409);
  const d={...r.data,state:b.approved?'approved':'rejected',decision:{...actor,notes:req(b.notes)}};target=r.id;
  if(b.approved&&d.kind==='credit'){const a=await get(d.agentId,'as_agent');if(!a.data.active)throw new AccessError('نماینده غیرفعال است.',400);put(a.id,'as_agent',{...a.data,creditLimitRial:d.limitRial,creditApproval:{requestId:r.id,...actor}},a);}
  if(b.approved&&d.kind==='part_price'){
   const m:any=await db.prepare("SELECT revision FROM flow_entities WHERE id=? AND type='material'").bind('material:'+d.partCode).first();if(!m)throw new AccessError('شناسنامه قطعه موجود نیست.',409);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)','material:'+d.partCode,m.revision);
   put(id,'as_tariff',{domain:'home',kind:'part',name:d.name,partCode:d.partCode,priceRial:d.priceRial,consumerPriceRial:d.consumerPriceRial,costRial:d.costRial,validFrom:d.validFrom,active:true,approval:{requestId:r.id,...actor}});d.tariffId=id;
  }
  put(r.id,'as_commercial_request',d,r);
 }else if(mode==='work_define'){
  const old=b.workId?await get(req(b.workId),'as_service_work'):null;if(old)revision(old);const minutes=qty(b.minutes);if(typeof b.active!=='boolean')throw new AccessError('وضعیت فعال کار لازم است.',400);
  target=old?.id||id;put(target,'as_service_work',{domain:'home',name:req(b.name),minutes,active:b.active,state:'pending_rate',notes:req(b.notes),submitted:actor,published:old?.data.published||null},old);
 }else if(mode==='labor_publish'){
  const works=(await list('as_service_work')).filter(w=>w.data.domain==='home'),rate=amount(b.ratePerMinuteRial),multiplier=qty(b.customerMultiplier);if(rate==='0'||multiplier<1000)throw new AccessError('فی دقیقه باید مثبت و ضریب مشتری حداقل ۱ باشد.',400);if(!works.some(w=>w.data.active))throw new AccessError('ابتدا مدیر خدمات یک کار فعال و زمان آن را تعریف کند.',400);
  const policyId='service-labor-policy:home',raw:any=await db.prepare('SELECT * FROM flow_entities WHERE id=?').bind(policyId).first(),old=raw?decode(raw):null;
  if((b.policyRevision??0)!==(old?.revision||0))throw new AccessError('مصوبه اجرت تغییر کرده؛ فرم را تازه کنید.',409);
  guard("(SELECT COUNT(*) FROM flow_entities WHERE type='as_service_work' AND json_extract(data,'$.domain')='home')=?",works.length);
  guard(old?'EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)':'NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?)',policyId,...(old?[old.revision]:[]));
  const version=(old?.revision||0)+1,policy={domain:'home',ratePerMinuteRial:rate,customerMultiplier:multiplier,validFrom:today,decision:{...actor,notes:req(b.notes)}};
  for(const w of works){guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',w.id,w.revision);const tariffId=crypto.randomUUID();
   if(w.data.active){const prices=calculatedLabor(w.data.minutes,rate,multiplier);put(tariffId,'as_tariff',{domain:'home',kind:'labor',name:w.data.name,partCode:'',...prices,costRial:null,active:true,validFrom:today,workId:w.id,workRevision:w.revision,policyId,policyRevision:version,formula:{minutes:w.data.minutes,ratePerMinuteRial:rate,customerMultiplier:multiplier},approval:actor});}
   else for(const t of (await list('as_tariff')).filter(t=>t.data.workId===w.id&&t.data.domain==='home'&&t.data.active)){guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',t.id,t.revision);put(t.id,'as_tariff',{...t.data,active:false},t);}
   put(w.id,'as_service_work',{...w.data,state:'published',published:{...actor,policyRevision:version,tariffId:w.data.active?tariffId:null}},w);
  }
  put(policyId,'as_service_labor_policy',policy,old);target=policyId;
 }
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'service_commercial_'+mode,signature,u.userId,now),...checks,...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'service_commercial_'+mode,JSON.stringify({request:b,actor}),now)]);
 return {saved:true,id:target};
}
