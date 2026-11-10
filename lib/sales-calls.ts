import {trainingContext} from './training-context';
import {storage} from './storage';
import {dayAt,addDay} from './duties';
import {salesRows,salesLock,salesVisible,salesFail as fail,sreq,stxt,integer} from './sales';
import {networkActor} from './sales-network';
import {salesManager,salesStaff,salesRep} from './sales-access';
import {leadMemberGuard,leadPhone} from './sales-leads';
import {solarParts,solarToIso} from './persian-date';
import {goalProgress} from './sales-monitor-contract';
import {leadCallResults,partnerCallResults} from './sales-call-results';
import {storedAccessPermissions} from './permissions';
import type {Session} from './permissions';

export const callKinds={incoming:'تماس ورودی',partner:'نماینده یا عامل فروش',outreach:'تماس بازاریابی'};
export const followupDefaults={dropPercent:25,behindPoints:20};
export const isPartner=(a:any)=>['representative','reseller'].includes(a.data.kind||'representative');
export function partnerFollowup(agent:any,rows:any[],today:string){
 const own=rows.filter(r=>r.data.agentId===agent.id);
 const last=own.filter(r=>r.type==='sales_contact').sort((a,b)=>b.created.localeCompare(a.created))[0];
 const contact=last?.data.nextDue||addDay(last?.data.day||agent.created.slice(0,10),agent.data.contactDays||30);
 const latest=own.filter(r=>r.type==='sales_invoice'&&!r.data.openingId&&r.data.day<=today).map(r=>r.data.day).sort().at(-1);
 const inactive=addDay(latest||agent.created.slice(0,10),agent.data.reorderDays||60);
 const policy={...followupDefaults,...rows.find(r=>r.type==='sales_call_policy')?.data};
 const reasons:string[]=[];
 if(contact<=today)reasons.push('موعد تماس دوره‌ای رسیده');
 const since=last?.data.day||'';
 const eligible=(day:string)=>!since||day>since;
 const waiting=!!last?.data.nextDue;
 if(inactive<=today&&(waiting||eligible(inactive)))reasons.push(latest?'مدتی خریدی ثبت نشده':'هنوز اولین خرید ثبت نشده');
 const daySpan=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/86400000;
 const units=(start:string,end:string)=>Number(goalProgress({data:{agentId:agent.id,basis:'units',amount:'1',productIds:[],start,end}},rows,today).actual);
 if(agent.created.slice(0,10)<=addDay(today,-59)&&(waiting||!since||daySpan(since,today)>=30)){
  const before=units(addDay(today,-59),addDay(today,-30)),current=units(addDay(today,-29),today);
  if(before>0&&current<=before*(1-policy.dropPercent/100))reasons.push('افت فروش: '+before+' ← '+current+' دستگاه');
 }
 if(waiting||!since||daySpan(since,today)>=Math.min(30,agent.data.contactDays||30))for(const reward of own.filter(r=>r.type==='sales_reward'&&r.data.state==='active'&&r.data.basis==='units'&&r.data.start<=today&&today<=r.data.end)){
  const d=reward.data,actual=Number(goalProgress({data:{...d,amount:d.target}},rows,today).actual);
  const elapsed=(daySpan(d.start,today)+1)/(daySpan(d.start,d.end)+1);
  if(elapsed-actual/Number(d.target)>=policy.behindPoints/100)reasons.push((d.period==='quarter'?'عقب‌ماندگی هدف فصل':'عقب‌ماندگی هدف سال')+': '+actual+' از '+d.target+' دستگاه');
 }
 if(last?.data.nextAction&&last.data.nextDue&&last.data.nextDue<=today)reasons.unshift(last.data.nextAction);
 return {reasons:[...new Set(reasons)],due:waiting?contact:reasons.length&&contact>today?today:contact,last};
}

async function actor(session:Session){
 const sample=trainingContext.getStore();
 if(sample&&session.profileReview){
  const u={...session,name:session.profileReview.title+' · آزمایشی'};
  return {u,members:await import('./sales-leads').then(m=>m.leadMembers()),member:{id:'sales-call-demo:'+sample.actor+':'+session.profileReview.id},sample:sample.actor};
 }
 const {u,members}=await networkActor(session);
 if(salesRep(u)||u.permissions.serviceAgentId||u.permissions.hospitalCenterId||!salesStaff(u))fail('دسترسی کارشناس فروش لازم است.',403);
 return {u,members,sample:'',member:members.find(m=>m.status==='active'&&(m.subject===u.userId||'local:'+m.id===u.userId))};
}

export async function readSalesCalls(session:Session){
 const {u,member,sample}=await actor(session),manager=salesManager(u),rows=(await salesRows()).filter(r=>!sample||r.data.callSample===sample);
 const agents=[];
 for(const a of rows.filter(r=>r.type==='sales_agent'&&r.data.active&&r.data.kind!=='referrer'))if(sample?(manager||a.data.ownerId===member?.id):await salesVisible(u,a,'write'))agents.push(a);
 const ids=new Set(agents.map(a=>a.id));
 const calls=rows.filter(r=>r.type==='sales_contact'&&r.data.callKind&&(manager||r.data.actor===u.userId||ids.has(r.data.agentId))).reverse();
 const leads=rows.filter(r=>r.type==='sales_lead'&&(manager||r.data.ownerId===member?.id)).map(r=>({id:r.id,name:r.data.contactName,stage:r.data.stage,segment:r.data.segment,orderId:r.data.orderId||''}));
 const products=(await storage().prepare("SELECT id,payload FROM records WHERE kind='product'").all()).results.map((r:any)=>{const p=JSON.parse(r.payload);return {id:r.id,name:p.name||p.model||p.code};});
 const today=dayAt();
 const report=manager?callReport(calls,rows,today):null;
 const referrals=manager?calls.filter(r=>r.data.referral&&(u.isAdmin||sample||r.data.referral.managerId===member?.id)):[];
 return {today,report,referrals,sample:!!sample,manager,name:u.name,agents:agents.map(a=>({id:a.id,name:a.data.name,partner:isPartner(a),ownerId:a.data.ownerId||''})),leads,products,calls,policy:{...followupDefaults,...rows.find(r=>r.type==='sales_call_policy')?.data},open:agents.filter(isPartner).map(a=>({id:a.id,name:a.data.name,...partnerFollowup(a,rows,today),last:undefined})).filter(a=>a.reasons.length)};
}

function callReport(calls:any[],rows:any[],today:string){
 const start=addDay(today,-6),week=new Map<string,any>();
 for(const row of calls.filter(r=>r.data.day>=start&&r.data.day<=today)){
  const d=row.data;
  const actor=week.get(d.actor)||{actor:d.actor,name:d.actorName,counts:{},onTime:0,late:0};
  const counts=actor.counts[d.callKind]||{effective:0,missed:0};
  counts[d.result==='no_answer'?'missed':'effective']++;
  actor.counts[d.callKind]=counts;
  if(d.priorDue&&d.result!=='no_answer'&&!d.nextDue)actor[d.day<=d.priorDue?'onTime':'late']++;
  week.set(d.actor,actor);
 }
 const seen=new Set<string>();
 for(const row of calls){
  const d=row.data,key=d.agentId||d.leadId||d.phone;
  if(seen.has(key))continue;
  seen.add(key);
  if(!d.nextDue||d.nextDue>=today)continue;
  const actor=week.get(d.actor)||{actor:d.actor,name:d.actorName,counts:{},onTime:0,late:0};
  actor.late++;week.set(d.actor,actor);
 }
 const {year,month}=solarParts(today);
 const summarize=(segment:string,from:string,actorId?:string)=>{
  const cases=new Map<string,any>();
  for(const row of calls.filter(r=>r.data.segment===segment&&r.data.day>=from&&(!actorId||r.data.actor===actorId))){
   const d=row.data,key=d.leadId||d.agentId||d.phone;
   if(!cases.has(key))cases.set(key,d);
  }
  let orders=0,active=0;
  for(const d of cases.values()){
   const lead=rows.find(r=>r.type==='sales_lead'&&r.id===d.leadId);
   if(lead&&!['lost','converted'].includes(lead.data.stage))active++;
   if(rows.some(r=>r.type==='sales_order'&&!['cancelled','rejected'].includes(r.data.state)&&r.created.slice(0,10)>=from&&(lead&&(r.data.leadId===lead.id||r.id===lead.data.orderId))))orders++;
  }
  return {cases:cases.size,orders,active};
 };
 const monthStart=solarToIso(year,month,1),quarterStart=solarToIso(year,Math.floor((month-1)/3)*3+1,1);
 const metrics=(actorId?:string)=>({home:summarize('home',monthStart,actorId),hospitalMonth:summarize('hospital',monthStart,actorId),hospitalQuarter:summarize('hospital',quarterStart,actorId)});
 return {week:[...week.values()].map(a=>({...a,...metrics(a.actor)})),...metrics()};
}

export async function writeSalesCall(session:Session,b:any){
 const {u,members,member,sample}=await actor(session),db=storage(),now=new Date().toISOString(),today=dayAt();
 if(b.confirmed!==true||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id)||!['call','policy','resolve_referral'].includes(b.mode))fail('شناسه و تأیید عملیات لازم است.');
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه قبلاً استفاده شده است.',409);return {saved:true};}
 const checks=await salesLock(db,b.id),rows=(await salesRows()).filter(r=>!sample||r.data.callSample===sample);
 let data:any,target=b.id,type='sales_contact';
 const linked:D1PreparedStatement[]=[];
 if(b.mode==='policy'){
  if(!salesManager(u))fail('تنظیم هشدار فقط با مدیر فروش است.',403);
  target=sample?'sales-call-demo:'+sample+':policy':'sales-call-policy';type='sales_call_policy';
  data={dropPercent:integer(b.dropPercent,1,100),behindPoints:integer(b.behindPoints,1,100)};
 }else if(b.mode==='resolve_referral'){
  if(!salesManager(u))fail('ثبت تصمیم فقط با مدیر فروش است.',403);
  const call=rows.find(r=>r.type==='sales_contact'&&r.id===b.callId);
  if(!call?.data.referral||!u.isAdmin&&!sample&&call.data.referral.managerId!==member?.id)fail('ارجاع در دسترسی شما نیست.',404);
  if(call.revision!==b.revision||call.data.referral.state!=='open')fail('ارجاع تغییر کرده یا قبلاً رسیدگی شده است.',409);
  checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(call.id,call.revision,b.id));
  target=call.id;
  data={...call.data,referral:{...call.data.referral,state:'resolved',decision:sreq(b.decision,2000),resolvedBy:u.userId,resolvedAt:now}};
 }else{
  if(!Object.hasOwn(callKinds,b.callKind))fail('نوع تماس لازم است.');
  const a=rows.find(r=>r.type==='sales_agent'&&r.id===b.agentId);
  let lead=rows.find(r=>r.type==='sales_lead'&&r.id===b.leadId);
  if(b.agentId&&(!a||!a.data.active||!(sample?(salesManager(u)||a.data.ownerId===member?.id):await salesVisible(u,a,'write'))))fail('مخاطب در دسترسی شما نیست.',403);
  if(b.leadId&&(!lead||!salesManager(u)&&lead.data.ownerId!==member?.id))fail('سرنخ در دسترسی شما نیست.',403);
  if(b.callKind==='partner'&&(!a||!isPartner(a)))fail('نماینده یا عامل فروش را انتخاب کنید.');
  if(a&&lead)fail('یک مخاطب انتخاب کنید.');
  const partner=!!a&&isPartner(a);
  if(!Object.hasOwn(partner?partnerCallResults:leadCallResults,b.result))fail('نتیجهٔ تماس با نوع مخاطب سازگار نیست.');
  const name=a?.data.name||lead?.data.contactName||sreq(b.name,200),phone=a||lead?'':leadPhone(b.phone);
  if(phone){
   lead=rows.find(r=>r.type==='sales_lead'&&r.data.phone===phone&&!['converted','lost'].includes(r.data.stage));
   if(lead&&!salesManager(u)&&lead.data.ownerId!==member?.id)fail('این شماره در پروندهٔ کارشناس دیگری ثبت شده است.',409);
  }
  const nextAction=b.nextDue?sreq(b.nextAction,300):'',nextDue=b.nextDue||'';
  if(nextDue&&(!/^\d{4}-\d{2}-\d{2}$/.test(nextDue)||!Number.isFinite(Date.parse(nextDue))||new Date(nextDue).toISOString().slice(0,10)!==nextDue||nextDue<today))fail('موعد پیگیری معتبر نیست.');
  if(b.result==='no_answer'&&!nextDue)fail('برای تماس بی‌پاسخ موعد تماس دوباره را ثبت کنید.');
  const nextTime=nextDue?(b.nextTime||''):'';
  if(nextTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(nextTime))fail('ساعت پیگیری معتبر نیست.');
  const productId=stxt(b.productId||'',200);
  if(productId&&!await db.prepare("SELECT 1 FROM records WHERE id=? AND kind='product'").bind(productId).first())fail('مدل دستگاه معتبر نیست.');
  const notes=stxt(b.notes||'',2000);
  let referral;
  if(b.managerRequest){
   if(!partner||b.result==='no_answer'||nextDue)fail('برای ارجاع، تماس با شریک فروش و یک اقدام بعدی معتبر لازم است.');
   const candidates=members.filter(m=>m.status==='active'&&salesManager({...u,isAdmin:false,permissions:storedAccessPermissions(m.permissions)}));
   const managerId=sample?'sales-call-demo:'+sample+':sales-manager'
    :(candidates.find(m=>m.id===a?.data.managerId)||(candidates.length===1?candidates[0]:null))?.id;
   if(!managerId)fail('ابتدا مدیر مسئول این نماینده را در پرونده تعیین کنید.',409);
   referral={state:'open',managerId,request:sreq(b.managerRequest,1000),day:today};
   sreq(notes,2000);
  }
  const segment=u.profileReview?.id==='hospital-sales'||u.permissions.roleAssignment?.roles.includes('hospital_sales')?'hospital':'home';
  const due=a&&isPartner(a)?partnerFollowup(a,rows,today):null;
  const priorDue=due?.last?.data.nextDue||(due?.reasons.length?due.due:'')||lead?.data.nextDue||'';
  if(!a&&!lead&&member){
   const leadId='call-lead:'+b.id;
   const draft={...(sample?{callSample:sample}:{}),title:name,contactName:name,phone,company:'',city:'',source:'phone',segment,ownerId:member.id,agentId:'',items:[],interest:notes,stage:'contacted',createdDay:today,createdBy:u.userId,nextAction,nextDue,history:[]};
   linked.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_lead',?,1,?,?)").bind(leadId,JSON.stringify(draft),now,now));
   lead={id:leadId,data:draft};
  }else if(lead&&!['converted','lost'].includes(lead.data.stage)){
   checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(lead.id,lead.revision,b.id));
   const d={...lead.data,nextDue,nextAction,lastContact:{day:today,type:'call',summary:notes,actor:u.userId}};
   linked.push(db.prepare("UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(JSON.stringify(d),now,lead.id,lead.revision));
  }
  data={agentId:a?.id||'',leadId:lead?.id||'',name,phone,productId,notes,...(referral?{referral}:{}),day:today,channel:'call',callKind:b.callKind,result:b.result,nextAction,nextDue,nextTime,priorDue,actor:sample?member!.id:u.userId,actorName:u.name,segment:lead?.data.segment||segment,history:[{actor:u.userId,mode:'contact',notes,at:now}]};
 }
 await db.batch([
  db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,type,signature,u.userId,now),...checks,leadMemberGuard(db,b.id,members),
  ...linked,
  db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated').bind(target,type,JSON.stringify({...data,...(sample?{callSample:sample}:{})}),now,now),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,b.mode==='resolve_referral'?'sales_contact_referral_resolved':type,'{}',now)
 ]);
 return {saved:true};
}
