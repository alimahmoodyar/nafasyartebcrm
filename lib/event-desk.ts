import {AccessError} from './authorization';
import {storage} from './storage';
import {storedAccessPermissions,type Session} from './permissions';
import {salesManager} from './sales-access';
import {memberId,validDay,dayAt} from './duties';
import {trainingContext} from './training-context';
import {applyLead,leadEligible,leadOpen,leadPhone,leadStages} from './sales-leads';
import {syncLeadTasks} from './sales-lead-tasks';
import {visitFields} from './exhibition-visits';

const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const text=(value:unknown,max:number)=>{if(typeof value!=='string'||value.length>max)fail('مقدار واردشده معتبر نیست.');return (value as string).trim()};
const internal=(m:any)=>{if(m?.status!=='active')return false;const p=storedAccessPermissions(m.permissions);return !p.salesAgentId&&!p.serviceAgentId&&!p.hospitalCenterId};
export async function deskActor(u:Session){
 const id=await memberId(u),m=id?await storage().prepare('SELECT * FROM app_members WHERE id=?').bind(id).first<any>():null;
 if(u.profileReview||u.rolePreview||trainingContext.getStore()||(!u.isAdmin&&!internal(m)))fail('دسترسی کارکنان لازم است.',403);
 return {id:id||u.userId,name:m?.name||u.name,manager:salesManager(m?{...u,permissions:storedAccessPermissions(m.permissions)}:u)};
}
type Actor=Awaited<ReturnType<typeof deskActor>>;
async function record(type:string,id:string){
 const r=await storage().prepare('SELECT id,data,revision FROM flow_entities WHERE type=? AND id=?').bind(type,id).first<any>();
 if(!r)throw new AccessError('پرونده در دسترس نیست.',404);return {...r,data:JSON.parse(r.data)};
}
function allowed(a:Actor,event:any){return a.manager||event.manager===a.id||event.team.includes(a.id)}
async function open(a:Actor,id:string){const e=await record('booth_event',id);if(!allowed(a,e.data))fail('به این رویداد دسترسی ندارید.',403);return e}
async function insert(type:string,id:string,data:unknown){
 const now=new Date().toISOString();await storage().prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(data),now,now).run();
}
export async function deskRead(a:Actor,q:URLSearchParams){
 const db=storage(),key=q.get('event')||'';
 if(q.has('search')){
  if(q.get('specialist')==='1'){const e=await open(a,key);if(!a.manager&&e.data.manager!==a.id)fail('مسئول رویداد باید ارجاع دهد.',403)}
  else if(!a.manager)fail('تعریف تیم با مدیر فروش است.',403);
  const term=(q.get('search')||'').trim();if(!term)return {people:[]};
  const rows=await db.prepare("SELECT id,name,unit,status,permissions FROM app_members WHERE status='active' AND (instr(name,?)>0 OR instr(unit,?)>0) ORDER BY name,id").bind(term,term).all<any>();
  return {people:rows.results.filter(q.get('specialist')==='1'?leadEligible:internal).slice(0,12).map(({id,name,unit})=>({id,name,unit}))};
 }
 if(!key){const rows=await db.prepare("SELECT id,data FROM flow_entities WHERE type='booth_event' AND (?=1 OR json_extract(data,'$.manager')=? OR EXISTS(SELECT 1 FROM json_each(data,'$.team') WHERE value=?)) ORDER BY created DESC").bind(Number(a.manager),a.id,a.id).all<any>();return {manager:a.manager,events:rows.results.map(r=>({id:r.id,...JSON.parse(r.data)}))}}
 const e=await open(a,key),supervise=a.manager||e.data.manager===a.id;
 const rows=await db.prepare(`SELECT v.id,v.revision,v.created,v.updated,v.data,l.data AS lead,o.data AS sale,m.name AS owner
 FROM flow_entities v LEFT JOIN flow_entities l ON l.type='sales_lead' AND l.id=json_extract(v.data,'$.leadId')
 LEFT JOIN flow_entities o ON o.type='sales_order' AND o.id=json_extract(l.data,'$.orderId')
 LEFT JOIN app_members m ON m.id=json_extract(l.data,'$.ownerId')
 WHERE v.type='booth_visit' AND json_extract(v.data,'$.event')=? AND (?=1 OR json_extract(v.data,'$.creator')=?) ORDER BY v.updated DESC`).bind(key,Number(supervise),a.id).all<any>();
 return {me:a.id,supervise,event:e.data,members:[],visits:rows.results.map(({lead,sale,owner,...r})=>{const l=lead&&JSON.parse(lead),o=sale&&JSON.parse(sale);return {...r,data:JSON.parse(r.data),progress:l?{owner,stage:leadStages[l.stage],next:l.nextAction,due:l.nextDue,order:o?.code||l.orderId,state:o?.state,invoice:o?.invoiceId,last:l.lastContact?.summary,history:supervise?(l.history||[]).filter((h:any)=>h.at>=r.created).map((h:any)=>({at:h.at,name:h.name,notes:h.notes})):[]}:null}})};
}
export async function deskWrite(u:Session,a:Actor,b:any){
 const db=storage();
 if(b.mode==='create'){
  if(!a.manager)fail('تعریف رویداد با مدیر فروش است.',403);
  const name=text(b.name,120),place=text(b.place,200),brief=text(b.brief,1500);
  if(!name||!validDay(b.start)||!validDay(b.end)||b.start>b.end||!Array.isArray(b.team)||!b.team.length)fail('نام، بازه و تیم رویداد را کامل کنید.');
  const ids=[...new Set([b.manager,...b.team])];const selected=await db.prepare('SELECT id,name,status,permissions FROM app_members WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all<any>();
  if(selected.results.filter(internal).length!==ids.length)fail('همهٔ افراد انتخابی باید پرسنل فعال باشند.');
  const id='event-'+crypto.randomUUID();await insert('booth_event',id,{name,place,brief,start:b.start,end:b.end,manager:b.manager,managerName:selected.results.find(m=>m.id===b.manager)?.name,team:[...new Set(b.team)]});return {id};
 }
 const e=await open(a,b.event),supervise=a.manager||e.data.manager===a.id;
 if(b.mode==='refer'){
  if(!supervise)fail('ارجاع فقط با مسئول رویداد است.',403);
  const visit=await record('booth_visit',b.id),v=visit.data;
  if(v.event!==e.id||visit.revision!==b.revision)fail('پرونده تغییر کرده است. تازه‌سازی کنید.',409);
  const id=crypto.randomUUID(),ownerId=text(b.ownerId,200),notes='ارجاع بازدید '+e.data.name+' · ثبت‌کننده '+v.creatorName;
  if(!v.phone)fail('ابتدا شمارهٔ تماس را در بازدید تکمیل کنید.');
  const phone=leadPhone(v.phone);
  const existing=!v.leadId?await db.prepare("SELECT id FROM flow_entities WHERE type='sales_lead' AND json_extract(data,'$.phone')=? AND json_extract(data,'$.stage') NOT IN ('lost','converted') LIMIT 1").bind(phone).first<{id:string}>():null;
  const prior=v.leadId||existing?.id,leadId=prior||id,old=prior?await record('sales_lead',prior):null;
  if(existing&&(!b.linkExisting||old.data.ownerId!==ownerId))fail('یک سرنخ باز با همین شماره وجود دارد. برای اتصال، مسئول فعلی آن را انتخاب و اتصال به سرنخ موجود را تأیید کنید.',409);
  if(v.leadId&&old?.data.exhibition?.visitId!==visit.id&&old?.data.ownerId!==ownerId&&!a.manager)fail('تغییر مسئول سرنخ مشترک با مدیر فروش است.',403);
  if(old&&!leadOpen(old.data))fail('پروندهٔ فروش بسته است.');
  if(!old&&(!v.person||!v.city||!(v.subject||v.note)))fail('برای ساخت سرنخ، نام، شهر و موضوع گفت‌وگو یا یادداشت را در بازدید تکمیل کنید.');
  const guard=db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND type='booth_visit') THEN guard ELSE 0 END WHERE id=?").bind(visit.id,visit.revision,id);
  const link=db.prepare("UPDATE flow_entities SET data=json_set(data,'$.leadId',?,'$.assignee',?),revision=revision+1,updated=? WHERE id=?").bind(leadId,ownerId,new Date().toISOString(),visit.id);
  const input={id,confirmed:true,mode:existing?'activity':old?'assign':'save',activityType:'visit',day:dayAt(),leadId,revision:old?.revision||0,title:v.company||v.person,contactName:v.person,phone:leadPhone(v.phone),city:v.city,company:v.company,segment:b.segment,source:'exhibition',sourceDetail:e.data.name,items:[],interest:v.subject||v.note,ownerId,nextAction:b.nextAction,nextDue:b.nextDue,notes};
  await applyLead(u,input,{guard,link,eventId:e.id,visitId:visit.id,creator:v.creator});
  try{await syncLeadTasks()}catch{return {id:leadId,pending:true}}return {id:leadId};
 }
 if(!/^visit-[a-f0-9-]{36}$/.test(b.id)||!Number.isSafeInteger(b.revision)||b.revision<0)fail('شناسه بازدید معتبر نیست.');
 const old=b.revision?await record('booth_visit',b.id):null;
 if(old&&(old.data.event!==e.id||(!supervise&&old.data.creator!==a.id)))fail('دسترسی ویرایش ندارید.',403);
 const fields=Object.fromEntries(visitFields.map(k=>[k,text(b.fields?.[k]||'',k==='note'?2000:200)]));
 const data={...old?.data,...fields,event:e.id,creator:old?.data.creator||a.id,creatorName:old?.data.creatorName||a.name,assignee:old?.data.assignee||'',draft:b.draft!==false||!fields.person||!fields.company||!fields.position||!fields.specialty};
 if(!old)await insert('booth_visit',b.id,data);
 else {const r=await db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),new Date().toISOString(),b.id,b.revision).run();if(!r.meta.changes)fail('پرونده تغییر کرده است.',409)}
 return {id:b.id,draft:data.draft};
}
