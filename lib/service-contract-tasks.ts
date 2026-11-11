import {storage} from './storage';
import {storedAccessPermissions,type Session} from './permissions';
import {serviceContractRights} from './service-contracts-contract';
import {serviceContractRows,contractWarning} from './service-contracts';
import type {ProfileWork} from './role-profiles';
import {dayAt} from './duties';
export function serviceContractProfileWork(u:Session,rows:any[],today=dayAt()):ProfileWork[]{
 const rights=serviceContractRights(u);if(!rights.read||!rights.expert&&!rights.ownAgent)return [];
 return rows.filter(r=>r.type==='as_service_contract'&&r.data.domain==='home'&&(!rights.ownAgent||r.data.agentId===rights.ownAgent)).flatMap(c=>{const w=contractWarning(c,rows,today);return w?[{id:'service-contract:'+c.id,title:w.title,section:'after-sales',target:'service-contract:'+c.id,sourceId:c.id,state:'open'}]:[];});
}
export async function syncServiceContractTasks(today=dayAt()){
 const db=storage(),rows=await serviceContractRows(),contracts=rows.filter(r=>r.type==='as_service_contract'&&r.data.domain==='home'),members=(await db.prepare("SELECT id,name,permissions FROM app_members WHERE status='active'").all()).results,now=new Date().toISOString(),wanted=new Set<string>(),writes:D1PreparedStatement[]=[];
 const prior=(await db.prepare("SELECT * FROM duty_runs WHERE template_id LIKE 'service-contract:%'").all()).results as any[],map=new Map(prior.map(t=>[t.id,t]));
 for(const c of contracts){const warning=contractWarning(c,rows,today);if(!warning)continue;
  for(const member of members){const p=storedAccessPermissions(String(member.permissions)),u:Session={userId:String(member.id),name:String(member.name),email:'',isAdmin:false,permissions:p},rights=serviceContractRights(u);if(!rights.read||(rights.ownAgent?rights.ownAgent!==c.data.agentId:!rights.expert))continue;
   const id='service-contract:'+c.id+':'+member.id,old=map.get(id),oldData=old?JSON.parse(old.data):{},data={...oldData,title:warning.title,instructions:'قرارداد نمایندگی را بررسی کنید. این هشدار فقط با ثبت تمدید یا تعیین تکلیف قطع همکاری توسط خدمات خانگی بسته می‌شود.',sourceSection:'after-sales',sourceId:'service-contract:'+c.id,serviceWorkflow:true,serviceContractWorkflow:true,serviceDomain:'home',serviceAgentId:c.data.agentId,contractId:c.id,contractEndsOn:c.data.endsOn,daysRemaining:warning.daysRemaining,warningStart:warning.warningStart,positionName:rights.ownAgent?'نماینده خدمات خانگی':'کارشناس خدمات خانگی',evidence:'text',history:oldData.history||[],answer:oldData.answer||''},due=c.data.endsOn+'T20:29:00Z';wanted.add(id);
   if(!old)writes.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) SELECT ?,?,'workflow',?,NULL,?,'open',?,1,?,? WHERE EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND json_extract(data,'$.state')='active') AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) ON CONFLICT(id) DO NOTHING").bind(id,'service-contract:'+c.id,String(member.id),due,JSON.stringify(data),now,now,c.id,c.revision,warning.agent.id,warning.agent.revision));
   else if(old.data!==JSON.stringify(data)||old.due!==due||['completed','cancelled'].includes(old.state))writes.push(db.prepare("UPDATE duty_runs SET data=?,due=?,state=CASE WHEN state IN ('completed','cancelled','submitted') THEN 'open' ELSE state END,revision=revision+1,updated=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND json_extract(data,'$.state')='active') AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)").bind(JSON.stringify(data),due,now,id,old.revision,c.id,c.revision,warning.agent.id,warning.agent.revision));
  }
 }
 for(const old of prior)if(!wanted.has(old.id)&&!['completed','cancelled'].includes(old.state)){const contractId=old.template_id.slice('service-contract:'.length);writes.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='as_service_contract' AND json_extract(data,'$.state')='active')").bind(now,old.id,old.revision,contractId));}
 if(writes.length)await db.batch(writes);
}
