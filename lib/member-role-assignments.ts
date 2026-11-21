import {env} from 'cloudflare:workers';
import {storage} from './storage';
import {AccessError} from './authorization';
import {roleProfiles} from './role-profiles';
import {profileSession,profileJobRoles} from './profile-review';
import {servicePreviewAgent} from './service-role-preview';
import {validatePermissions,toManualPermissions,manualBusinessPrograms,rolePolicyVersion,type Permissions,type Session} from './permissions';
import {canOpenSection} from './navigation-access';
import {personnelStaff} from './personnel-profile';
import {personnelBaseApproved} from './personnel-documents';
import {warehouseProfilePermissions} from './material-warehouses';

export type ProfileBinding={profileId:string;warehouseIds?:string[];agentId?:string};
const policyVersion='member-profiles-v1:'+rolePolicyVersion;
const entityId=(id:string)=>'member-role-assignment:'+id;
const fail=(s:string,status=400):never=>{throw new AccessError(s,status)};
const arrayKeys=['read','write','eventStages','financialRead','financialWrite','treasuryWorkflowRoles','assetRoles','qmsRoles','personnelRoles','salesRoles','transportRoles','serviceRoles','serviceDomains','supplyRoles','warehouses','flowRoles'] as const;
const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,stable(v[k])])):v;
const json=(v:any)=>JSON.stringify(stable(v));
const digest=async(v:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json(v))))).map(x=>x.toString(16).padStart(2,'0')).join('');
const parse=(r:any)=>({...r,data:JSON.parse(r.data)});
export function roleBindingScope(id:string){return ['central-store','line-store','quality'].includes(id)?'warehouses':id==='sales-representative'?'salesAgent':id==='home-service-representative'?'serviceAgent':'none';}
const empty=()=>validatePermissions({read:[],write:[],eventStages:[],manualPrograms:[],warehouseResponsibilities:[]});
function manual(p:Permissions):Permissions {const {roleAssignment,...value}=toManualPermissions(p);return validatePermissions(value);}
function tokens(p:Permissions){
 const values:string[]=[];for(const k of arrayKeys)for(const v of p[k]||[])values.push(k+':'+v);
 for(const k of ['salesAgentId','serviceAgentId','hospitalCenterId'] as const)if(p[k])values.push(k+':'+p[k]);
 for(const r of p.warehouseResponsibilities||[])values.push('warehouse:'+r.role+':'+r.warehouseId);
 for(const v of p.manualPrograms||[])values.push('program:'+v);
 if(p.finance&&p.finance!=='none')values.push('finance:'+p.finance);
 return [...new Set(values)].sort();
}
function merge(parts:Permissions[]):Permissions{
 const p:any={read:[],write:[],eventStages:[],manualPrograms:[]};
 for(const k of [...arrayKeys,'manualPrograms'] as const)if(parts.some(v=>v[k]!==undefined))p[k]=[...new Set(parts.flatMap(v=>v[k]||[]))].sort();
 if(parts.some(v=>v.warehouseResponsibilities!==undefined))p.warehouseResponsibilities=[...new Map(parts.flatMap(v=>v.warehouseResponsibilities||[]).map(r=>[r.role+':'+r.warehouseId,r])).values()].sort((a,b)=>(a.role+a.warehouseId).localeCompare(b.role+b.warehouseId));
 for(const k of ['salesAgentId','serviceAgentId','hospitalCenterId'] as const){const ids=[...new Set(parts.map(v=>v[k]).filter(Boolean))];if(ids.length>1)fail('محدوده‌های متفاوت یک حساب نمایندگی قابل ترکیب نیستند.');p[k]=ids[0]||'';}
 p.finance=parts.some(v=>v.finance==='write')?'write':parts.some(v=>v.finance==='read')?'read':'none';
 // The current service policy uses a role/domain product. Never introduce a pair
 // absent from every complete selected profile or the explicitly retained ACL.
 for(const role of p.serviceRoles||[])for(const domain of p.serviceDomains||[])if(!parts.some(v=>v.serviceRoles?.includes(role)&&v.serviceDomains?.includes(domain)))fail('ترکیب این نقش‌ها، اختیار خدمات را به حوزهٔ دیگری گسترش می‌دهد؛ نقش‌ها و حوزه‌های خدمات را جداگانه بررسی کنید.');
 return validatePermissions(p);
}
function normalizeBindings(input:any,warehouses:any[],agents:any[]):ProfileBinding[]{
 if(!Array.isArray(input)||input.length>roleProfiles.length)fail('فهرست پروفایل‌های نقش معتبر نیست.');const ids=new Set<string>();
 return input.map((b:any)=>{
  if(!b||Object.keys(b).some(k=>!['profileId','warehouseIds','agentId'].includes(k))||typeof b.profileId!=='string')fail('انتخاب نقش معتبر نیست.');
  const profile=roleProfiles.find(p=>p.id===b.profileId);if(!profile?.operational||!Object.hasOwn(profileJobRoles,b.profileId))fail('این پروفایل هنوز قابل تخصیص عملیاتی نیست.');
  if(ids.has(b.profileId))fail('یک پروفایل را دوبار انتخاب نکنید.');ids.add(b.profileId);const scope=roleBindingScope(b.profileId),out:ProfileBinding={profileId:b.profileId};
  if(scope==='warehouses'){
   if(!Array.isArray(b.warehouseIds)||!b.warehouseIds.length||b.warehouseIds.length>200||b.warehouseIds.some((id:any)=>typeof id!=='string'))fail('انبارهای تحت مسئولیت نقش را انتخاب کنید.');
   out.warehouseIds=[...new Set(b.warehouseIds as string[])].sort();
   for(const id of out.warehouseIds){const w=warehouses.find(w=>w.id===id);if(!w?.data.active||w.data.deletedAt||b.profileId==='line-store'&&w.data.warehouseType!=='production_line'||b.profileId==='central-store'&&(w.data.serviceDomain||['production_line','quarantine'].includes(w.data.warehouseType)))fail('انبار انتخاب‌شده با محدودهٔ نقش منطبق یا فعال نیست.');}
  }else if(b.warehouseIds?.length)fail('این نقش محدودهٔ انبار ندارد.');
  if(scope==='salesAgent'||scope==='serviceAgent'){
   const a=agents.find(a=>a.id===b.agentId&&a.type===(scope==='salesAgent'?'sales_agent':'as_agent'));
   if(!a?.data.active||a.id===servicePreviewAgent||/^(role-sample|training)[-:]/.test(a.id)||scope==='serviceAgent'&&a.data.domain!=='home'||scope==='salesAgent'&&!['representative','reseller'].includes(a.data.kind))fail('نمایندگی واقعی، فعال و منطبق با نقش را انتخاب کنید.');out.agentId=a.id;
  }else if(b.agentId)fail('این نقش محدودهٔ نمایندگی ندارد.');
  return out;
 }).sort((a:ProfileBinding,b:ProfileBinding)=>a.profileId.localeCompare(b.profileId));
}
export async function memberRoleContext(actor:Session,memberId='',options:{q?:string;tab?:string;page?:number}={}){
 if(!actor.isAdmin||actor.profileReview)fail('تخصیص نقش فقط برای مدیر سامانه مجاز است.',403);
 const db=storage(),q=(options.q||'').trim().slice(0,120),tab=options.tab||'pending',page=Number.isSafeInteger(options.page)&&options.page!>=0?Math.min(options.page!,100000):0;
 const assigned="EXISTS(SELECT 1 FROM flow_entities a WHERE a.type='member_role_assignment' AND json_extract(a.data,'$.memberId')=m.id AND json_array_length(a.data,'$.bindings')>0)";
 const where="m.status!='deleted' AND (?='' OR instr(lower(m.name),lower(?))>0 OR EXISTS(SELECT 1 FROM flow_entities h WHERE h.type='hr_employee' AND json_extract(h.data,'$.memberId')=m.id AND instr(lower(json_extract(h.data,'$.code')),lower(?))>0))"+(tab==='assigned'?' AND '+assigned:tab==='pending'?' AND NOT '+assigned:'');
 const args=[q,q,q],count:any=memberId?{n:1}:await db.prepare('SELECT COUNT(*) n FROM app_members m WHERE '+where).bind(...args).first();
 const listed=memberId?await db.prepare('SELECT id,name,status,subject,permissions FROM app_members WHERE id=?').bind(memberId).all():await db.prepare('SELECT id,name,status,subject,permissions FROM app_members m WHERE '+where+' ORDER BY name,id LIMIT 25 OFFSET ?').bind(...args,page*25).all();
 const members=listed.results as any[],actorRows=await db.prepare('SELECT id,name,status,subject,permissions FROM app_members WHERE id=? OR subject=? ORDER BY id').bind(actor.userId.startsWith('local:')?actor.userId.slice(6):actor.userId,actor.userId).all();
 const guardedMembers=[...new Map([...members,...actorRows.results as any[]].map(m=>[m.id,m])).values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const ids=members.map(m=>m.id),placeholders=ids.length?ids.map(()=>'?').join(','):'NULL';
 const entityWhere="type IN ('material_warehouse','sales_agent','as_agent') OR (type IN ('hr_employee','member_role_assignment') AND json_extract(data,'$.memberId') IN ("+placeholders+"))";
 const [entities,runs,identity,owners]=await Promise.all([
  db.prepare('SELECT * FROM flow_entities WHERE '+entityWhere+' ORDER BY id LIMIT 2001').bind(...ids).all(),
  db.prepare("SELECT id,assignee,supervisor,state,data,revision FROM duty_runs WHERE (assignee=? OR supervisor=?) AND state NOT IN ('completed','cancelled') ORDER BY id LIMIT 201").bind(memberId,memberId).all(),
  db.prepare('SELECT id,subject FROM app_identity ORDER BY id').all(),
  db.prepare('SELECT id FROM app_members WHERE lower(email)=?').bind(env.TRACE_OWNER_EMAIL?.trim().toLowerCase()||'').all()
 ]);
 if(entities.results.length>2000)fail('فهرست محدوده‌های نقش از سقف بررسی بیشتر است؛ پشتیبان سامانه بررسی کند.',409);
 return {db,actor,members,guardedMembers,total:count.n,page,entityWhere,entityArgs:ids,entities:entities.results.map(parse),runs:runs.results as any[],identity:identity.results as any[],owners:owners.results as any[]};
}

type Context=Awaited<ReturnType<typeof memberRoleContext>>;
function target(ctx:Context,id:string){const m=ctx.members.find(m=>m.id===id);if(!m||m.status==='deleted')fail('حساب فرد یافت نشد.',404);return m;}
function protectedMember(ctx:Context,m:any){return ctx.actor.userId==='local:'+m.id||m.subject===ctx.actor.userId||ctx.owners.some(o=>o.id===m.id)||ctx.identity.some(i=>i.subject===m.id||m.subject&&i.subject===m.subject);}
export function memberRoleCatalog(ctx:Context){
 const warehouses=ctx.entities.filter(r=>r.type==='material_warehouse'),agents=ctx.entities.filter(r=>['sales_agent','as_agent'].includes(r.type));
 const people=ctx.members.filter(m=>m.status!=='deleted').map(m=>{
  let valid=true,priorPermissions:Permissions=empty();try{priorPermissions=validatePermissions(JSON.parse(m.permissions))}catch{valid=false}
  const profile=ctx.entities.find(r=>r.type==='hr_employee'&&r.data.memberId===m.id),assignment=ctx.entities.find(r=>r.id===entityId(m.id)),isProtected=protectedMember(ctx,m),internal=personnelStaff(m);
  return {id:m.id,name:m.name,status:m.status,ready:valid&&!isProtected&&m.status==='active'&&(internal?!!profile&&personnelBaseApproved(profile.data):!JSON.parse(m.permissions).hospitalCenterId),reason:!valid?'دسترسی‌های قبلی معتبر نیستند؛ ابتدا حساب بررسی شود.':isProtected?'حساب مدیر جاری یا مدیر اصلی محافظت‌شده است.':m.status!=='active'?'ابتدا حساب فعال شود.':internal&&(!profile||!personnelBaseApproved(profile.data))?'ابتدا اطلاعات پایه پرونده در اداری تأیید شود.':'',code:profile?.data.code||'',profileId:profile?.id||'',internal,bindings:assignment?.data.bindings||[],hasPreviousAccess:tokens(priorPermissions).some(t=>!t.startsWith('program:')),revision:assignment?.revision||0};
 });
 return {accountId:ctx.actor.userId,total:ctx.total,page:ctx.page,policyVersion,profiles:roleProfiles.map(p=>({id:p.id,title:p.title,group:p.group,operational:p.operational&&Object.hasOwn(profileJobRoles,p.id),scope:roleBindingScope(p.id),actions:p.links.filter(l=>!l.taskOnly).map(l=>l.title)})),warehouses:warehouses.filter(w=>w.data.active&&!w.data.deletedAt).map(w=>({id:w.id,name:w.data.name,kind:w.data.warehouseType||'',serviceDomain:w.data.serviceDomain||''})),agents:agents.filter(a=>a.data.active&&a.id!==servicePreviewAgent&&!/^(role-sample|training)[-:]/.test(a.id)).map(a=>({id:a.id,name:a.data.name,type:a.type,domain:a.data.domain,kind:a.data.kind})),people};
}
export async function previewMemberRoles(ctx:Context,b:any){
 if(Object.keys(b).some(k=>!['mode','memberId','revision','assignmentRevision','bindings','legacyMode','reason','confirmed','reviewedRemovals','previewToken','requestId'].includes(k)))fail('فرم تخصیص نقش فقط اطلاعات نقش را می‌پذیرد.');
 const member=target(ctx,b.memberId);if(protectedMember(ctx,member))fail('نقش مدیر جاری یا مدیر اصلی از این مسیر قابل تغییر نیست.',403);if(member.status!=='active')fail('فقط حساب فعال قابل تخصیص نقش است.',409);
 const row:any=await ctx.db.prepare('SELECT * FROM app_members WHERE id=?').bind(member.id).first();const record=ctx.entities.find(r=>r.id===entityId(member.id));
 if(row.permissions!==member.permissions||row.status!==member.status)fail('حساب هم‌زمان تغییر کرده؛ اطلاعات را تازه کنید.',409);
 if(!Number.isSafeInteger(b.revision)||b.revision!==row.revision||b.assignmentRevision!==(record?.revision||0))fail('حساب یا نقش‌ها تغییر کرده‌اند؛ اطلاعات تازه را دریافت کنید.',409);
 const employee=ctx.entities.find(r=>r.type==='hr_employee'&&r.data.memberId===member.id),internal=personnelStaff(member);
 if(internal&&(!employee||!personnelBaseApproved(employee.data)))fail('اطلاعات پایه پرونده باید ابتدا توسط اداری تأیید شود.',409);
 const warehouses=ctx.entities.filter(r=>r.type==='material_warehouse'),agents=ctx.entities.filter(r=>['sales_agent','as_agent'].includes(r.type));
 const bindings=normalizeBindings(b.bindings,warehouses,agents);
 const before=manual(warehouseProfilePermissions({...member,permissions:JSON.stringify(validatePermissions(JSON.parse(member.permissions)))},warehouses));
 if(before.manualPrograms===undefined)before.manualPrograms=manualBusinessPrograms.filter(s=>canOpenSection({...ctx.actor,isAdmin:false,userId:'local:'+member.id,permissions:before,productionParticipant:employee?.data.productionEligible===true,profileReview:undefined},s));
 if(before.hospitalCenterId)fail('حساب مرکز درمانی از مسیر تخصیص نقش کارکنان تغییر نمی‌کند.');
 const external=bindings.filter(x=>['salesAgent','serviceAgent'].includes(roleBindingScope(x.profileId)));
 if(external.length&&(internal||bindings.length!==1))fail('نقش نمایندگی بیرونی با حساب کارکنان یا نقش‌های دیگر ترکیب نمی‌شود.');
 if(!internal&&(bindings.length!==1||!external.length))fail('حساب نمایندگی باید همان نقش و محدودهٔ نمایندگی را حفظ کند.');
 if(external.some(x=>x.agentId!==(roleBindingScope(x.profileId)==='salesAgent'?before.salesAgentId:before.serviceAgentId)))fail('انتقال حساب به نمایندگی دیگر از این مسیر مجاز نیست.');
 if(!['keep','replace'].includes(b.legacyMode))fail('شیوهٔ بررسی دسترسی‌های قبلی را مشخص کنید.');
 const legacy:Permissions=record?record.data.legacyPermissions:before;
 if(record&&record.data.appliedPermissions!==json(before))fail('دسترسی حساب خارج از فرم نقش‌ها تغییر کرده است؛ ابتدا سابقه و دسترسی‌ها بررسی شوند.',409);
 const retained=b.legacyMode==='keep'?manual(legacy):empty();
 // Freeze the legacy navigation ceiling before adding grants from new profiles.
 if(retained.manualPrograms===undefined)retained.manualPrograms=manualBusinessPrograms.filter(s=>canOpenSection({...ctx.actor,isAdmin:false,userId:'local:'+member.id,permissions:retained,productionParticipant:employee?.data.productionEligible===true,profileReview:undefined},s));
 const parts=bindings.map(binding=>{const grants=profileSession(ctx.actor,binding.profileId,warehouses.filter(w=>binding.warehouseIds?.includes(w.id)),binding.agentId||'').permissions;return manual({...grants,manualPrograms:grants.manualPrograms?.filter(id=>(manualBusinessPrograms as readonly string[]).includes(id))});});
 const after=merge([retained,...parts]),beforeTokens=tokens({...before,manualPrograms:before.manualPrograms??manualBusinessPrograms.filter(s=>canOpenSection({...ctx.actor,isAdmin:false,userId:'local:'+member.id,permissions:before,productionParticipant:employee?.data.productionEligible===true,profileReview:undefined},s))}),afterTokens=tokens(after);
 const removed=beforeTokens.filter(t=>!afterTokens.includes(t)),added=afterTokens.filter(t=>!beforeTokens.includes(t));
 if(ctx.runs.length>200)fail('تعداد کارهای باز بیش از سقف بررسی است؛ ابتدا کارها تعیین تکلیف شوند.',409);
 const openWork=ctx.runs.filter(r=>!['completed','cancelled'].includes(r.state)&&(r.assignee===member.id||r.supervisor===member.id&&r.state==='submitted')).filter(r=>{const d=JSON.parse(r.data);return !!d.sourceSection||Object.keys(d).some(k=>k.endsWith('Workflow')&&d[k]);}).map(r=>({id:r.id,title:JSON.parse(r.data).title||'کار فرایندی',state:r.state}));
 const dependencies={members:ctx.members,entities:ctx.entities.map(r=>[r.id,r.revision]),runs:ctx.runs.filter(r=>r.assignee===member.id||r.supervisor===member.id).map(r=>[r.id,r.revision,r.state]),identity:ctx.identity};
 const reason=typeof b.reason==='string'?b.reason.trim():'';if(reason.length>4000)fail('دلیل تغییر بیش از حد طولانی است.');
 const previewToken=await digest({memberId:member.id,revision:row.revision,assignmentRevision:record?.revision||0,bindings,legacyMode:b.legacyMode,reason,after,policyVersion,dependencies});
 return {member:row,record,employee,bindings,legacyPermissions:retained,before,after,reason,previewToken,removed,added,openWork,blocked:removed.length>0&&openWork.length>0,hasLegacy:tokens(legacy).filter(t=>!t.startsWith('program:')).length>0,programs:after.manualPrograms||[],policyVersion,dependencies};
}
export async function memberRoleEditor(ctx:Context,id:string){
 const member=target(ctx,id),row:any=await ctx.db.prepare('SELECT revision FROM app_members WHERE id=?').bind(id).first(),record=ctx.entities.find(r=>r.id===entityId(id));
 let permissions:Permissions=empty();try{permissions=validatePermissions(JSON.parse(member.permissions))}catch{fail('دسترسی‌های قبلی معتبر نیستند؛ ابتدا حساب باید بررسی شود.',409)}
 return {...memberRoleCatalog(ctx),selected:{...memberRoleCatalog(ctx).people.find(p=>p.id===id),memberRevision:row.revision,assignmentRevision:record?.revision||0,bindings:record?.data.bindings||[],legacyPermissions:record?.data.legacyPermissions||manual(permissions),permissions,permissionTokens:tokens(manual(warehouseProfilePermissions(member,ctx.entities.filter(r=>r.type==='material_warehouse')))),history:record?.data.history||[]}};
}
export async function saveMemberRoles(ctx:Context,b:any){
 if(b.confirmed!==true||typeof b.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.requestId))fail('شناسه عملیات و تأیید صریح لازم است.');
 const signature=json(b),prior:any=await ctx.db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.requestId).first();
 if(prior){if(prior.actor!==ctx.actor.userId||prior.payload!==signature)fail('شناسه عملیات با محتوای دیگری استفاده شده است.',409);return {saved:true,repeated:true,memberId:b.memberId};}
 const p=await previewMemberRoles(ctx,b);if(!p.reason)fail('دلیل تغییر نقش را وارد کنید.');if(b.previewToken!==p.previewToken)fail('خلاصهٔ تغییرات تازه نیست؛ دوباره بررسی و پیش‌نمایش کنید.',409);if(p.removed.length&&b.reviewedRemovals!==true)fail('فهرست دسترسی‌های حذف‌شونده را بررسی و تأیید کنید.');if(p.blocked)fail('فرد کار فرایندی باز دارد؛ پیش از برداشتن دسترسی، کارها را در مسیر مربوط تعیین تکلیف یا تحویل دهید.',409);
 const now=new Date().toISOString(),oldHistory=p.record?.data.history||[];if(oldHistory.length>=300)fail('سقف سابقه تخصیص نقش پر شده است؛ سابقه باید بررسی شود.',409);
 const data={memberId:p.member.id,bindings:p.bindings,legacyPermissions:p.legacyPermissions,appliedPermissions:json(p.after),policyVersion,history:[...oldHistory,{at:now,actor:ctx.actor.userId,name:ctx.actor.name,reason:p.reason,beforeBindings:p.record?.data.bindings||[],afterBindings:p.bindings,beforeStoredPermissions:validatePermissions(JSON.parse(p.member.permissions)),beforePermissions:p.before,afterPermissions:p.after,legacyMode:b.legacyMode}]};
 const dependencies=ctx.entities,runRows=ctx.runs.filter(r=>r.assignee===p.member.id||r.supervisor===p.member.id),guards=[
  ctx.db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'name',name,'status',status,'subject',subject,'permissions',permissions)) FROM (SELECT * FROM app_members WHERE id IN ("+ctx.guardedMembers.map(()=>'?').join(',')+") ORDER BY id))=? THEN guard ELSE 0 END WHERE id=?").bind(...ctx.guardedMembers.map(m=>m.id),JSON.stringify(ctx.guardedMembers),b.requestId),
  ctx.db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=? AND status='active') THEN guard ELSE 0 END WHERE id=?").bind(p.member.id,p.member.revision,b.requestId),
  ctx.db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'revision',revision)) FROM (SELECT id,revision FROM flow_entities WHERE "+ctx.entityWhere+" ORDER BY id))=? THEN guard ELSE 0 END WHERE id=?").bind(...ctx.entityArgs,JSON.stringify(dependencies.map(r=>({id:r.id,revision:r.revision}))),b.requestId),
  ctx.db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'assignee',assignee,'supervisor',supervisor,'state',state,'data',data,'revision',revision)) FROM (SELECT * FROM duty_runs WHERE (assignee=? OR supervisor=?) AND state NOT IN ('completed','cancelled') ORDER BY id))=? THEN guard ELSE 0 END WHERE id=?").bind(p.member.id,p.member.id,JSON.stringify(runRows),b.requestId),
  ctx.db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'subject',subject)) FROM (SELECT * FROM app_identity ORDER BY id))=? THEN guard ELSE 0 END WHERE id=?").bind(JSON.stringify(ctx.identity),b.requestId)
 ];
 try{await ctx.db.batch([
  ctx.db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.requestId,'assign_member_profiles',signature,ctx.actor.userId,now),...guards,
  ctx.db.prepare('UPDATE app_members SET permissions=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(p.after),now,p.member.id,p.member.revision),
  ...(p.record?[ctx.db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,p.record.id,p.record.revision)]:[ctx.db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'member_role_assignment',?,1,?,?)").bind(entityId(p.member.id),JSON.stringify(data),now,now)]),
  ctx.db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(b.requestId,ctx.actor.userId,p.member.id,'assign_member_profiles',JSON.stringify({storedPermissions:validatePermissions(JSON.parse(p.member.permissions)),permissions:p.before,bindings:p.record?.data.bindings||[]}),JSON.stringify({permissions:p.after,bindings:p.bindings,reason:p.reason,legacyMode:b.legacyMode,policyVersion}),now)
 ])}catch(e){const repeat:any=await ctx.db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.requestId).first();if(repeat?.actor===ctx.actor.userId&&repeat.payload===signature)return {saved:true,repeated:true,memberId:p.member.id};if(/guard|UNIQUE/.test(String(e)))fail('اطلاعات حساب، نقش یا کارهای باز هم‌زمان تغییر کرد؛ فهرست را تازه کنید.',409);throw e;}
 return {saved:true,memberId:p.member.id};
}
export function publicRolePreview(p:Awaited<ReturnType<typeof previewMemberRoles>>){return {previewToken:p.previewToken,removed:p.removed,added:p.added,openWork:p.openWork,blocked:p.blocked,hasLegacy:p.hasLegacy,programs:p.programs,bindings:p.bindings,before:p.before,after:p.after,policyVersion};}
