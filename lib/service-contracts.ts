import {isUnassignedServiceProfile} from './service-profile-scope';
import {storage} from './storage';
import {AccessError} from './authorization';
import type {Session} from './permissions';
import {trainingContext} from './training-context';
import {serviceContractRights,serviceContractStatus} from './service-contracts-contract';
import {req,txt,date,past,decode,monthsAfter} from './after-sales';
import {dayAt} from './duties';
export async function serviceContractRows(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type IN ('as_agent','as_service_contract')").all()).results.map(decode);}
export function contractWarning(c:any,agents:any[],today=dayAt()){
 const a=agents.find(a=>a.id===c.data.agentId&&a.type==='as_agent'&&a.data.domain==='home');
 if(!a||!a.data.active||a.data.currentServiceContractId!==c.id)return null;
 const status=serviceContractStatus(c,today,monthsAfter(c.data.endsOn,-1));
 return status.warning?{contract:c,agent:a,...status,title:'تمدید قرارداد · '+a.data.name+' · '+status.remainingText}:null;
}
export async function serviceContractWorkspace(u:Session){
 const rights=serviceContractRights(u);if(!rights.read)throw new AccessError('دسترسی قرارداد خدمات خانگی ندارید.',403);
 const rows=await serviceContractRows(),agents=rows.filter(r=>r.type==='as_agent'&&r.data.domain==='home'&&(!rights.ownAgent||r.id===rights.ownAgent));
 if(rights.ownAgent&&!agents.length&&!isUnassignedServiceProfile(u))throw new AccessError('نماینده خدمات خانگی پیدا نشد.',404);
 const ids=new Set(agents.map(a=>a.id)),today=dayAt(),contracts=rows.filter(r=>r.type==='as_service_contract'&&r.data.domain==='home'&&ids.has(r.data.agentId)).map(c=>({...c,status:serviceContractStatus(c,today,monthsAfter(c.data.endsOn,-1))}));
 return {rights,today,agents:agents.map(a=>({id:a.id,revision:a.revision,name:a.data.name,active:a.data.active,currentContractId:a.data.currentServiceContractId||''})),contracts};
}
export async function applyServiceContract(u:Session,b:any){
 const rights=serviceContractRights(u);if(!rights.manage)throw new AccessError('فقط کارشناس یا مدیر خدمات خانگی می‌تواند قرارداد را تعیین تکلیف کند.',403);
 const mode=req(b.mode),id=req(b.id),db=storage(),now=new Date().toISOString(),today=dayAt();
 if(!['register','renew','terminate'].includes(mode)||b.domain!=='home'||b.confirmed!==true||!/^[a-f0-9-]{36}$/i.test(id))throw new AccessError('عملیات، تأیید و شناسه ثبت قرارداد معتبر نیست.',400);
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload,kind FROM inventory_operations WHERE id=?').bind(id).first();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature||prior.kind!=='service_contract_'+mode)throw new AccessError('شناسه عملیات برای درخواست دیگری استفاده شده است.',409);const audit:any=await db.prepare("SELECT target FROM access_audit WHERE actor=? AND action=? AND json_extract(after,'$.operationId')=?").bind(u.userId,'service_contract_'+mode,id).first();if(!audit)throw new AccessError('نتیجه ثبت قبلی در دسترس نیست.',409);return {saved:true,repeated:true,id:audit.target};}
 const checks:D1PreparedStatement[]=[],writes:D1PreparedStatement[]=[];
 const guard=(sql:string,...values:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+sql+' THEN guard ELSE 0 END WHERE id=?').bind(...values,id));
 const get=async(eid:string,type:string)=>{const r:any=await db.prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(eid,type).first();if(!r||JSON.parse(r.data).domain!=='home')throw new AccessError('پرونده قرارداد یا نماینده خانگی پیدا نشد.',404);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',r.id,r.revision);return decode(r);};
 const put=(eid:string,type:string,data:any,old?:any)=>writes.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,eid,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(eid,type,JSON.stringify(data),now,now));
 const c=mode==='register'?null:await get(req(b.contractId),'as_service_contract'),a=await get(c?c.data.agentId:req(b.agentId),'as_agent');
 if(b.agentRevision!==a.revision||c&&b.revision!==c.revision)throw new AccessError('قرارداد یا نماینده تغییر کرده؛ صفحه را تازه کنید.',409);
 if(!a.data.active||c&&(c.data.state!=='active'||a.data.currentServiceContractId!==c.id))throw new AccessError('این قرارداد یا نماینده قابل تعیین تکلیف نیست.',409);
 const actor={by:u.userId,name:u.name,at:now,profile:u.profileReview?.id||trainingContext.getStore()?.role||'',actualTester:trainingContext.getStore()?.actor||u.userId},notes=req(b.notes),history={mode,...actor,notes};let target=id,newContract:any=null;
 if(mode==='register'||mode==='renew'){
  if(mode==='register'&&a.data.currentServiceContractId){const existing:any=await db.prepare("SELECT id FROM flow_entities WHERE id=? AND type='as_service_contract'").bind(a.data.currentServiceContractId).first();const old=existing?await get(existing.id,'as_service_contract'):null;if(!old)guard('NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?)',a.data.currentServiceContractId);if(old?.data.state==='active')throw new AccessError('قرارداد جاری وجود دارد؛ از ثبت تمدید استفاده کنید.',409);}
  const startsOn=date(b.startsOn),endsOn=date(b.endsOn);if(startsOn>endsOn)throw new AccessError('پایان اعتبار پیش از شروع قرارداد است.',400);
  if(mode==='renew'&&(endsOn<=c.data.endsOn||endsOn<today))throw new AccessError('تمدید باید پایان قرارداد را جلو ببرد و اعتبار جدید منقضی نباشد.',400);
  newContract={domain:'home',agentId:a.id,agentName:a.data.name,number:req(b.number,200),startsOn,endsOn,reference:txt(b.reference,1000),state:'active',previousContractId:c?.id||'',createdBy:actor,history:[history]};
  put(id,'as_service_contract',newContract);put(a.id,'as_agent',{...a.data,currentServiceContractId:id},a);
  if(c)put(c.id,'as_service_contract',{...c.data,state:'renewed',successorContractId:id,resolution:history,history:[...(c.data.history||[]),history]},c);
 }else{
  const day=past(b.day);target=c.id;put(c.id,'as_service_contract',{...c.data,state:'terminated',terminationDay:day,resolution:history,history:[...(c.data.history||[]),history]},c);
  put(a.id,'as_agent',{...a.data,active:false,serviceTermination:{contractId:c.id,day,...history}},a);
 }
 // Both the representative and expert copies close in the same transaction as the actual decision.
 if(c)writes.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=?,data=json_set(data,'$.contractResolution',json(?)) WHERE template_id=? AND state NOT IN ('completed','cancelled')").bind(now,JSON.stringify({newContractId:newContract?id:'',...history}),'service-contract:'+c.id));
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'service_contract_'+mode,signature,u.userId,now),...checks,...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'service_contract_'+mode,JSON.stringify({operationId:id,request:b,actor}),now)]);
 return {saved:true,id:target};
}
