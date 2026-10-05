import {storage} from './storage';
import {supplyLock} from './sourcing';
export async function syncMaterialTasks(){
 const db=storage(),op=crypto.randomUUID(),checks=await supplyLock(db,op),now=new Date().toISOString();
 const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('receipt','request')").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const members=(await db.prepare("SELECT id,permissions FROM app_members WHERE status='active'").all()).results.map((r:any)=>({...r,p:JSON.parse(r.permissions)}));
 const old=(await db.prepare("SELECT * FROM duty_runs WHERE template_id LIKE 'material:%'").all()).results as any[],wanted=new Set<string>(),stmts:D1PreparedStatement[]=[];
 for(const r of rows){const d=r.data,isQC=r.type==='receipt'&&d.state==='pending_qc',isShelf=r.type==='receipt'&&d.state==='awaiting_warehouse',isIssue=r.type==='request'&&d.state==='pending';if(!isQC&&!isShelf&&!isIssue)continue;
  const role=isQC?'qc':'inventory',owner=isQC?d.qcOwner:d.warehouseOwner,title=isQC?'کنترل کیفیت ورودی محموله':isShelf?'جانمایی محموله تأییدشده':'تحویل مواد به تولید';
  const eligible=members.filter(m=>m.p.flowRoles?.includes(role));const selected=owner?eligible.filter(m=>m.id===owner):eligible;
  for(const m of selected){const id='material:'+r.id+':'+d.state+':'+m.id;wanted.add(id);const prior=old.find(t=>t.id===id);if(prior&&!['completed','cancelled'].includes(prior.state))continue;
   const data={title,sourceSection:'flow',materialWorkflow:true,workflowRole:role,sourceId:r.id,instructions:title+'؛ پرونده '+r.id+' را در گردش مواد و تولید باز کنید. وظیفه با انجام همان مرحله بسته می‌شود.',positionName:isQC?'کنترل کیفیت':'انبار',evidence:'text',remindHours:24,escalateHours:48,history:[],answer:'',extensionRequested:''};
   if(prior)stmts.push(db.prepare("UPDATE duty_runs SET state='open',revision=revision+1,updated=? WHERE id=?").bind(now,id));else{
    stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,due,state,data,revision,created,updated) VALUES(?,?,?,?,?,'open',?,1,?,?)").bind(id,'material:'+r.id+':'+d.state,now.slice(0,10),m.id,new Date(Date.now()+86400000).toISOString(),JSON.stringify(data),now,now));
    stmts.push(db.prepare('INSERT INTO duty_notices(id,task_id,recipient,phase,message,created) VALUES(?,?,?,?,?,?)').bind(id+':notice',id,m.id,'initial',title,now));
   }
  }
 }
 for(const t of old)if(!wanted.has(t.id)&&!['completed','cancelled'].includes(t.state))stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=?").bind(now,t.id));
 if(stmts.length)await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'material_tasks','{}','workflow',?,1)").bind(op,now),...checks,...stmts]);
 return {updated:stmts.length};
}
