import {warehouseDirectory,receiptQcOwners,receiptQcOwner} from './material-warehouses';
import {receiptQCWarehouse} from './warehouse-receipt-policy';
import {storedAccessPermissions} from './permissions';
import {storage} from './storage';
import {supplyLock} from './sourcing';
export async function syncMaterialTasks(){
 const db=storage(),op=crypto.randomUUID(),checks=await supplyLock(db,op),now=new Date().toISOString();
 const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('receipt','request')").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const members=(await db.prepare("SELECT id,permissions FROM app_members WHERE status='active'").all()).results.map((r:any)=>({...r,p:storedAccessPermissions(r.permissions)}));
 const warehouses=await warehouseDirectory();
 const old=(await db.prepare("SELECT * FROM duty_runs WHERE template_id LIKE 'material:%'").all()).results as any[],wanted=new Set<string>(),stmts:D1PreparedStatement[]=[];
 for(const r of rows){const d=r.data,isTemplate=r.type==='receipt'&&d.state==='awaiting_qc_template',isQC=r.type==='receipt'&&d.state==='pending_qc',isShelf=r.type==='receipt'&&d.state==='awaiting_warehouse',isIssue=r.type==='request'&&d.state==='pending';if(!isTemplate&&!isQC&&!isShelf&&!isIssue)continue;
  const taskWarehouseId=d.warehouseId;const role=isTemplate?'engineering':isQC?'qc':'inventory',warehouse=isQC?receiptQCWarehouse(r,warehouses):warehouses.find(w=>w.id===d.warehouseId),owner=isQC?(warehouse?receiptQcOwner(r,warehouse):d.qcOwner):d.warehouseOwner,title=isTemplate?'تعریف فرم کنترل کیفیت محموله قرنطینه':isQC?'کنترل کیفیت ورودی محموله':isShelf?'جانمایی محموله تأییدشده':'تحویل مواد به تولید';
  const eligible=members.filter(m=>isTemplate?m.p.supplyRoles?.includes('engineering'):m.p.flowRoles?.includes(role)||m.p.warehouseResponsibilities?.some((r:any)=>r.role===role&&r.warehouseId===taskWarehouseId)||warehouse?.[role+'Members']?.some((person:any)=>person.id===m.id));
  const selected=isTemplate?eligible:warehouse?(isQC?eligible.filter(m=>receiptQcOwners(r,warehouse).includes(m.id)):eligible.filter(m=>warehouse.inventoryMembers.some((x:any)=>x.id===m.id))):owner?eligible.filter(m=>receiptQcOwners(r,warehouse).includes(m.id)):[];
  for(const m of selected){const id='material:'+r.id+':'+d.state+':'+m.id;wanted.add(id);const prior=old.find(t=>t.id===id);if(prior&&!['completed','cancelled'].includes(prior.state)){if((JSON.parse(prior.data).warehouseId!==(taskWarehouseId||'')||JSON.parse(prior.data).quarantineWarehouseId!==(isQC?d.quarantineWarehouseId||'':'')))stmts.push(db.prepare('UPDATE duty_runs SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify({...JSON.parse(prior.data),warehouseId:taskWarehouseId||'',quarantineWarehouseId:isQC?d.quarantineWarehouseId||'':''}),now,id));continue;}
   const data={title,warehouseId:taskWarehouseId||'',quarantineWarehouseId:isQC?d.quarantineWarehouseId||'':'',sourceSection:'flow',materialWorkflow:true,workflowRole:role,sourceId:isTemplate?d.materialId:r.id,receiptId:r.id,instructions:title+'؛ پرونده '+r.id+' را در گردش مواد و تولید باز کنید. وظیفه با انجام همان مرحله بسته می‌شود.',positionName:isQC?'کنترل کیفیت':'انبار',evidence:'text',remindHours:24,escalateHours:48,history:[],answer:'',extensionRequested:''};
   if(prior)stmts.push(db.prepare("UPDATE duty_runs SET state='open',revision=revision+1,updated=? WHERE id=?").bind(now,id));else{
    stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,due,state,data,revision,created,updated) VALUES(?,?,?,?,?,'open',?,1,?,?)").bind(id,'material:'+r.id+':'+d.state,now.slice(0,10),m.id,new Date(Date.now()+86400000).toISOString(),JSON.stringify(data),now,now));
    stmts.push(db.prepare('INSERT INTO duty_notices(id,task_id,recipient,phase,message,created) VALUES(?,?,?,?,?,?)').bind(id+':notice',id,m.id,'initial',title,now));
   }
  }
 }
 for(const t of old)if(!wanted.has(t.id)&&!['completed','cancelled'].includes(t.state)){const data=JSON.parse(t.data),source=rows.find(r=>r.id===(data.receiptId||data.sourceId)),stillPending=source&&['awaiting_qc_template','pending_qc','awaiting_warehouse','pending'].includes(source.data.state),qc=source?.data.qc;if(data.workflowRole==='qc'&&qc){const message='کنترل کیفیت توسط '+qc.by+' انجام شد؛ این کار غیرفعال شد.';data.history=[...(data.history||[]),{mode:'completed_by_inspector',actor:qc.actor,by:qc.by,at:now,message}];stmts.push(db.prepare("INSERT OR IGNORE INTO duty_notices(id,task_id,recipient,phase,message,created) VALUES(?,?,?,'completed_by_inspector',?,?)").bind(t.id+':qc-completed',t.id,t.assignee,message,now));}stmts.push(db.prepare('UPDATE duty_runs SET state=?,data=?,revision=revision+1,updated=? WHERE id=?').bind(qc?'completed':stillPending?'cancelled':'completed',JSON.stringify(data),now,t.id));}
 if(stmts.length)await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'material_tasks','{}','workflow',?,1)").bind(op,now),...checks,...stmts]);
 return {updated:stmts.length};
}
