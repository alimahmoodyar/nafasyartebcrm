import {storage} from './storage';
import {AccessError} from './authorization';
import {storedAccessPermissions} from './permissions';
import type {Session} from './permissions';
import {salesManager,salesRep,salesStaff} from './sales-access';
import {salesVisible,liveSalesUser,salesLock} from './sales';
import {domainWriteAccess} from './service-access';
import {memberId} from './duties';
import {emptyIdentity,identityFields} from './representative-identity-contract';

const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const uuid=(s:any)=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
const txt=(s:any,max=200)=>{if(typeof s!=='string'||s.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s))fail('متن نامعتبر یا بیش از حد طولانی است.');return s.trim()};
const digits=(s:string)=>s.replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
const decode=(r:any)=>r?{...r,data:JSON.parse(r.data)}:null;
async function entity(id:string,type:string){return decode(await storage().prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(id,type).first())}
function serviceExpert(u:Session,domain:string){const p=u.permissions;return !p.salesAgentId&&!p.serviceAgentId&&!p.hospitalCenterId&&domainWriteAccess(u,domain)&&!!p.serviceRoles?.some(r=>['manager','support','coordinator'].includes(r));}
function salesEditor(u:Session){return !u.permissions.serviceAgentId&&!u.permissions.hospitalCenterId&&(salesRep(u)||salesStaff(u));}
export async function identityAgentAccess(actor:Session,kind:string,id:string){
 const u=await liveSalesUser(actor);
 if(!['sales','service'].includes(kind)||typeof id!=='string'||!id||id.length>200)fail('نمایندگی معتبر لازم است.');
 const agent=await entity(id,kind==='sales'?'sales_agent':'as_agent');if(!agent)fail('نمایندگی در دسترسی شما نیست.',404);
 const own=kind==='sales'?!!u.permissions.salesAgentId:!!u.permissions.serviceAgentId;
 if(!u.isAdmin&&(kind==='sales'?!(salesEditor(u)&&await salesVisible(u,agent,'write')):!(own?u.permissions.serviceAgentId===agent.id&&!!u.permissions.serviceDomains?.includes(agent.data.domain)&&!!u.permissions.serviceRoles?.includes('agent'):serviceExpert(u,agent.data.domain))))fail('نمایندگی در دسترسی شما نیست.',404);
 if(own&&!agent.data.active)fail('نمایندگی غیرفعال است؛ تکمیل اطلاعات را از کارشناس پیگیری کنید.',403);
 const review=!own&&(u.isAdmin||(kind==='sales'?salesStaff(u):serviceExpert(u,agent.data.domain)));
 return {u,agent,review,own};
}
export async function identityAuthorityGuard(u:Session,operationId:string){
 if(u.isAdmin||u.profileReview)return [];
 const db=storage(),row:any=await db.prepare("SELECT id,permissions FROM app_members WHERE status='active' AND (subject=? OR id=?)").bind(u.userId,u.userId.startsWith('local:')?u.userId.slice(6):u.userId).first();
 if(!row||JSON.stringify(storedAccessPermissions(row.permissions))!==JSON.stringify(u.permissions))fail('دسترسی حساب تغییر کرده؛ دوباره وارد شوید.',403);
 return [db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?) THEN guard ELSE 0 END WHERE id=?").bind(row.id,row.permissions,operationId)];
}
// Bound reciprocal group: one sales agency and at most one service agency in each domain.
export async function identityGroup(agent:any){
 let sale=agent.type==='sales_agent'?agent:null;
 if(!sale&&agent.data.linkedSalesAgentId){sale=await entity(agent.data.linkedSalesAgentId,'sales_agent');if(!sale||!sale.data.linkedServiceAgentIds?.includes(agent.id))fail('ارتباط نمایندگی‌ها هم‌خوان نیست؛ مدیر سامانه بررسی کند.',409);}
 if(!sale)return [agent];
 const ids=sale.data.linkedServiceAgentIds||[];if(!Array.isArray(ids)||ids.length>2||new Set(ids).size!==ids.length)fail('ارتباط نمایندگی‌ها نیازمند بررسی است.',409);
 const group=[sale];for(const id of ids){const service=await entity(id,'as_agent');if(!service||service.data.linkedSalesAgentId!==sale.id)fail('ارتباط نمایندگی‌ها هم‌خوان نیست.',409);group.push(service);}
 return group;
}
async function dossier(group:any[]){const ids=new Set(group.map(a=>a.data.identityId).filter(Boolean));if(ids.size>1)fail('شناسنامه‌های مرتبط هم‌خوان نیستند؛ مدیر سامانه بررسی کند.',409);const id=[...ids][0] as string|undefined;const row=id?await entity(id,'representative_identity'):null;if(id&&!row)fail('شناسنامهٔ مشترک در دسترس نیست.',409);return row;}
function baseline(a:any){return {...emptyIdentity(),name:a.data.name||'',nationalId:a.data.nationalId||'',mobile:a.data.mobile||'',phone:a.data.phone||'',province:a.data.province||'',city:a.data.city||'',address:a.data.address||'',contactName:a.data.contact||''};}
export async function readRepresentativeIdentity(actor:Session,q:URLSearchParams){
 const kind=q.get('kind')||'sales',id=q.get('agentId');
 if(id){const access=await identityAgentAccess(actor,kind,id),group=await identityGroup(access.agent),row=await dossier(group),page=Number(q.get('page')||1);if(!Number.isSafeInteger(page)||page<1)fail('صفحه معتبر نیست.');
 const audit=row?(await storage().prepare("SELECT actor,action,at,before,after FROM access_audit WHERE target=? AND action GLOB 'representative_identity_*' ORDER BY at DESC,id DESC LIMIT 10 OFFSET ?").bind(row.id,(page-1)*10).all()).results:[];
 return {agent:{id:access.agent.id,name:access.agent.data.name,code:access.agent.data.code||'',domain:access.agent.data.domain||''},identity:row?{id:row.id,revision:row.revision,...row.data}:{id:'',revision:0,state:'incomplete',draft:baseline(access.agent),approved:null,documents:[]},activities:group.map(a=>a.type==='sales_agent'?'فروش':a.data.domain==='hospital'?'خدمات بیمارستانی':'خدمات خانگی'),canReview:access.review,own:access.own,shared:group.length>1,history:audit,page};}
 const u=await liveSalesUser(actor),db=storage(),domain=q.get('domain')||'home',page=Number(q.get('page')||1),search=txt(q.get('q')||'',100);
 if(!['sales','service'].includes(kind)||!Number.isSafeInteger(page)||page<1)fail('فهرست معتبر نیست.');
 let clause="type=?",params:any[]=[kind==='sales'?'sales_agent':'as_agent'];
 if(kind==='sales'){
 if(!u.isAdmin&&!salesEditor(u))fail('دسترسی شناسنامهٔ نمایندگی ندارید.',403);
 const own=u.permissions.salesAgentId;if(own){clause+=' AND id=?';params.push(own)}else if(!salesManager(u)){clause+=" AND json_extract(data,'$.ownerId')=?";params.push(await memberId(u));}
 if(u.profileReview?.buyerId&&['home-sales','hospital-sales'].includes(u.profileReview.id)){clause+=' AND id=?';params.push(u.profileReview.buyerId)}
 }else{
 if(!['home','hospital'].includes(domain))fail('حوزه معتبر نیست.');
 if(!u.isAdmin&&!serviceExpert(u,domain)&&!(u.permissions.serviceAgentId&&u.permissions.serviceDomains?.includes(domain)&&u.permissions.serviceRoles?.includes('agent')))fail('دسترسی شناسنامهٔ نمایندگی ندارید.',403);
 clause+=" AND json_extract(data,'$.domain')=?";params.push(domain);if(u.permissions.serviceAgentId){clause+=' AND id=?';params.push(u.permissions.serviceAgentId)}
 }
 if(search){clause+=" AND (instr(lower(json_extract(data,'$.name')),lower(?))>0 OR instr(COALESCE(json_extract(data,'$.code'),''),?)>0)";params.push(search,search);}
 const total:any=await db.prepare('SELECT COUNT(*) n FROM flow_entities WHERE '+clause).bind(...params).first(),rows=(await db.prepare("SELECT id,data FROM flow_entities WHERE "+clause+" ORDER BY json_extract(data,'$.name'),id LIMIT 20 OFFSET ?").bind(...params,(page-1)*20).all()).results as any[];
 return {agents:rows.map(r=>{const d=JSON.parse(r.data);return {id:r.id,name:d.name,code:d.code||'',active:!!d.active}}),page,pages:Math.max(1,Math.ceil((total?.n||0)/20)),total:total?.n||0};
}
function validate(value:any,complete:boolean){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!identityFields.some(([f])=>f===k)))fail('فیلدهای شناسنامه معتبر نیستند.');
 const d:any=Object.fromEntries(identityFields.map(([key])=>[key,txt(value[key]??'',key==='address'?1000:200)]));
 if(!['natural','legal'].includes(d.personType))fail('نوع شخص را انتخاب کنید.');
 for(const key of ['nationalId','companyId','registrationNo','mobile','phone','alternatePhone','postalCode'])d[key]=digits(d[key]);
 if(d.personType==='natural'){d.companyId='';d.registrationNo=''}else d.nationalId='';
 if(d.mobile&&!/^09\d{9}$/.test(d.mobile))fail('شماره همراه باید ۱۱ رقم و با ۰۹ باشد.');
 if(d.nationalId&&!/^\d{10}$/.test(d.nationalId)||d.companyId&&!/^\d{11}$/.test(d.companyId)||d.postalCode&&!/^\d{10}$/.test(d.postalCode)||d.registrationNo&&!/^\d{1,20}$/.test(d.registrationNo))fail('تعداد ارقام شناسه هویتی، شماره ثبت یا کد پستی معتبر نیست.');
 if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))fail('ایمیل معتبر نیست.');
 if(!d.name||!d.mobile)fail('نام و شماره همراه اصلی لازم است.');
 if(complete&&(!d.contactName||!d.province||!d.city||!d.address||!d.postalCode||!(d.personType==='natural'?d.nationalId:d.companyId&&d.registrationNo)))fail('برای بررسی، مشخصات هویتی، مسئول و نشانی را کامل کنید.');
 return d;
}
export async function applyRepresentativeIdentity(actor:Session,b:any){
 if(!b||b.confirmed!==true||!uuid(b.id)||!['save','submit','approve','return'].includes(b.mode)||!Number.isSafeInteger(b.revision)||b.revision<0||Object.keys(b).some(k=>!['id','mode','confirmed','kind','agentId','revision','data','documents','notes'].includes(k)))fail('درخواست شناسنامه معتبر نیست.');
 const {u,agent,review}=await identityAgentAccess(actor,b.kind,b.agentId),group=await identityGroup(agent),db=storage(),signature=JSON.stringify(b);
 const prior:any=await db.prepare('SELECT * FROM inventory_operations WHERE id=?').bind(b.id).first();if(prior){if(prior.actor!==u.userId||prior.kind!=='representative_identity_'+b.mode||prior.payload!==signature)fail('شناسه عملیات قبلاً برای درخواست دیگری استفاده شده است.',409);return {saved:true,repeated:true};}
 const old=await dossier(group);if((old?.revision||0)!==b.revision)fail('شناسنامه تغییر کرده؛ دوباره دریافت کنید تا اطلاعات همکار شما از دست نرود.',409);
 const id=old?.id||'representative-identity:'+crypto.randomUUID(),now=new Date().toISOString(),data:any=old?{...old.data}:{state:'incomplete',draft:baseline(agent),approved:null,documents:[]};
 const stamp={by:u.userId,name:u.name,profile:u.profileReview?.id||'',at:now},notes=txt(b.notes??'',2000);
 if(b.mode==='save'||b.mode==='submit'){
 data.draft=validate(b.data,b.mode==='submit');
 if(b.documents!==undefined){if(!Array.isArray(b.documents)||b.documents.length>20||new Set(b.documents.map((f:any)=>f.id)).size!==b.documents.length)fail('حداکثر ۲۰ مدرک یکتا مجاز است.');
 data.documents=[];for(const doc of b.documents){if(!uuid(doc.id))fail('شناسه مدرک معتبر نیست.');const file=await entity(doc.id,'representative_identity_file');if(!file||!(group.some(a=>file.data.agentId===a.id)||file.data.identityId===id)||file.data.identityId&&file.data.identityId!==id)fail('مدرک متعلق به این نمایندگی نیست.',403);const expires=txt(doc.expires??'',10);if(expires&&(!/^\d{4}-\d{2}-\d{2}$/.test(expires)||Number.isNaN(Date.parse(expires))||new Date(expires).toISOString().slice(0,10)!==expires))fail('تاریخ اعتبار مدرک معتبر نیست.');data.documents.push({id:doc.id,title:txt(doc.title||file.data.title,200),expires,filename:file.data.filename});}}
 data.state=b.mode==='submit'?'pending':'incomplete';data.submitted=b.mode==='submit'?stamp:null;data.decision=null;
 }else{
 if(!review)fail('بررسی شناسنامه با کارشناس مسئول است.',403);if(data.state!=='pending')fail('شناسنامه در انتظار بررسی نیست.',409);
 if(data.submitted?.by===u.userId&&!u.isAdmin&&!u.profileReview)fail('ثبت‌کننده نمی‌تواند شناسنامهٔ خودش را تأیید یا رد کند.',403);
 if(b.mode==='return'&&!notes)fail('دلیل نیاز به اصلاح را بنویسید.');
 if(b.mode==='approve'){validate(data.draft,true);data.approved={...data.draft};data.approvedDocuments=[...(data.documents||[])];data.state='approved'}else data.state='returned';
 data.decision={...stamp,notes};
 }
 data.updatedBy=stamp;
 const guards=group.map(a=>db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(a.id,a.revision,b.id));
 guards.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+(old?'EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)':'NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?)')+' THEN guard ELSE 0 END WHERE id=?').bind(id,...(old?[old.revision]:[]),b.id));
 const writes:D1PreparedStatement[]=[];for(const doc of data.documents||[]){const file=await entity(doc.id,'representative_identity_file');if(!file)fail('مدرک تغییر کرده است.',409);guards.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(file.id,file.revision,b.id));if(!file.data.identityId)writes.push(db.prepare("UPDATE flow_entities SET data=json_set(data,'$.identityId',?),revision=revision+1,updated=? WHERE id=? AND revision=?").bind(id,now,file.id,file.revision));}
 writes.push(...group.filter(a=>a.data.identityId!==id).map(a=>db.prepare('UPDATE flow_entities SET data=json_set(data,\'$.identityId\',?),revision=revision+1,updated=? WHERE id=? AND revision=?').bind(id,now,a.id,a.revision)));
 // Login accounts, legacy commercial profiles, contracts and ledgers are not changed by identity review.
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'representative_identity_'+b.mode,signature,u.userId,now),...await salesLock(db,b.id),...await identityAuthorityGuard(u,b.id),...guards,...writes,old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,id,old.revision):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'representative_identity',?,1,?,?)").bind(id,JSON.stringify(data),now,now),db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'representative_identity_'+b.mode,JSON.stringify(old?.data||null),JSON.stringify({...data,operationId:b.id}),now)]);
 return {saved:true,id,state:data.state};
}
