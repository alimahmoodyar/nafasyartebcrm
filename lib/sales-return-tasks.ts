import {storage} from './storage';
import {storedAccessPermissions} from './permissions';
import {notice,dayAt,addDay} from './duties';
import {salesManager} from './sales-access';
import {returnActions,returnActionRoles,returnRoles,pendingReturnActions} from './sales-return-contract';
import {warehouseDirectory,warehouseMember} from './material-warehouses';

export async function returnTaskStatements(id:string,d:any,buyer:any,saleState?:string){
 const db=storage(),now=new Date().toISOString(),due=addDay(dayAt(),1)+'T12:30:00Z';
 const members=(await db.prepare("SELECT id,name,subject,permissions FROM app_members WHERE status='active'").all()).results.map(m=>{
  const memberId=String(m.id),user={userId:String(m.subject||'local:'+memberId),name:String(m.name),email:'',isAdmin:false,permissions:storedAccessPermissions(String(m.permissions))};
  return {id:memberId,user,roles:returnRoles(user)};
 });
 const existing=(await db.prepare("SELECT id,state,revision FROM duty_runs WHERE template_id=?").bind('sales-return:'+id).all()).results;
 const prior=new Map(existing.map(t=>[String(t.id),t])),wanted=new Set<string>(),writes:D1PreparedStatement[]=[];
 const actions=pendingReturnActions(d,saleState);
 const steps=actions.map(a=>({key:a,title:returnActions[a],roles:returnActionRoles[a]}));
 if(d.intake==='review'&&d.submission?.channel==='portal')steps.push({key:'review' as const,title:returnActions.review,roles:['sales']});
 const warehouse=d.factoryWarehouseId?(await warehouseDirectory()).find(w=>w.id===d.factoryWarehouseId&&w.data.active):null;
 for(const step of steps){
  const eligible=members.filter(m=>step.roles.some(role=>{
   if(!m.roles[role])return false;
   if(role==='rep')return m.user.permissions.salesAgentId===d.agentId;
   if(role==='sales')return m.id===buyer.ownerId||!members.some(x=>x.id===buyer.ownerId&&x.roles.sales)&&salesManager(m.user);
   if(role==='finance')return !buyer.financeId||m.id===buyer.financeId;
   if(role==='factory'&&warehouse)return warehouseMember(m.user,warehouse,'inventory');
   return true;
  }));
  for(const assignee of eligible.length?eligible.map(m=>m.id):['@admin']){
   const taskId='sales-return:'+id+':'+step.key+':'+assignee;
   if(wanted.has(taskId))continue;
   wanted.add(taskId);
   const data={salesReturnWorkflow:true,salesAgentId:d.agentId,sourceSection:'sales-returns',sourceId:id,title:step.title+' · '+d.serials[0],instructions:'پرونده مرجوعی این سریال را باز کنید و مرحله مربوط را در همان پرونده ثبت کنید.',positionName:'مرجوعی دستگاه',workflowRole:step.roles.join(','),evidence:'text',history:[]};
   const old=prior.get(taskId);
   if(old&&old.state!=='completed'&&old.state!=='cancelled')continue;
   writes.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,NULL,?,'open',?,1,?,?) ON CONFLICT(id) DO UPDATE SET state='open',revision=duty_runs.revision+1,updated=excluded.updated").bind(taskId,'sales-return:'+id,step.key,assignee,due,JSON.stringify(data),now,now));
   writes.push(notice(taskId,assignee,'assigned:'+String(Number(old?.revision||0)+1),data.title,now));
  }
 }
 for(const t of existing)if(!wanted.has(String(t.id))&&!['completed','cancelled'].includes(String(t.state)))
  writes.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=? AND revision=?").bind(now,t.id,t.revision));
 return writes;
}
