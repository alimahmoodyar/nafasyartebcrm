import {storage} from './storage';
import {dayAt,addDay} from './duties';
import {salesRows,salesLock,salesStaff,salesFinance,salesRep} from './sales';
import {salesAccounts,salesTargetProgress,rial} from './sales-contract';
export async function syncSalesTasks(){
 const db=storage(),op=crypto.randomUUID(),checks=await salesLock(db,op),rows=await salesRows(),today=dayAt(),now=new Date().toISOString();
 const members=(await db.prepare("SELECT id,name,permissions FROM app_members WHERE status='active'").all()).results.map((m:any)=>({...m,permissions:JSON.parse(m.permissions)}));
 const old=(await db.prepare("SELECT * FROM duty_runs WHERE template_id LIKE 'sales:%'").all()).results as any[],wanted=new Set<string>(),stmts:D1PreparedStatement[]=[];
 function task(agent:any,key:string,title:string,due:string,role:string,instructions:string){
  const assigned=role==='staff'?agent.data.ownerId:role==='finance'?agent.data.financeId:'';
  const candidates=members.filter(m=>{const u={isAdmin:false,permissions:m.permissions} as any;if(role==='agent')return salesRep(u)&&m.permissions.salesAgentId===agent.id;if(salesRep(u))return false;if(assigned&&assigned!==m.id)return false;return role==='finance'?salesFinance(u):salesStaff(u);});
  for(const m of candidates){const tid='sales:'+key+':'+role+':'+m.id;wanted.add(tid);const existing=old.find(t=>t.id===tid),data={title:title+' · '+agent.data.name,instructions:instructions+'\nپرونده را در «فروش و نمایندگان» باز کنید. پاسخ متنی جای انجام مرحله واقعی را نمی‌گیرد.',evidence:'text',positionName:'فروش و نمایندگان',sourceSection:'sales',salesWorkflow:true,salesAgentId:agent.id,workflowRole:role,remindHours:24,escalateHours:48,history:[],answer:'',extensionRequested:''};
   const at=due+'T12:30:00Z';if(existing){const d=JSON.parse(existing.data);if(d.title===data.title&&d.instructions===data.instructions&&existing.due===at&&!['completed','cancelled'].includes(existing.state))continue;stmts.push(db.prepare("UPDATE duty_runs SET state=CASE WHEN state IN ('completed','cancelled') THEN 'open' ELSE state END,due=?,data=?,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(at,JSON.stringify({...d,...data,history:d.history,answer:d.answer,extensionRequested:d.extensionRequested}),now,tid,existing.revision));}
   else stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,NULL,?,'open',?,1,?,?)").bind(tid,'sales:'+key,today,m.id,at,JSON.stringify(data),now,now));
  }
 }
 for(const a of rows.filter(r=>r.type==='sales_agent'&&r.data.active)){
  const own=rows.filter(r=>r.data.agentId===a.id),account=salesAccounts(rows,a.id,today);
  for(const o of own.filter(r=>r.type==='sales_order'))if(['submitted','sales_approved'].includes(o.data.state))task(a,'order:'+o.id+':'+o.data.state,o.data.state==='submitted'?'بررسی سفارش '+o.data.code:'تأیید مالی سفارش '+o.data.code,addDay(o.created.slice(0,10),1),o.data.state==='submitted'?'staff':'finance','قیمت، مهلت پرداخت و موجودی قابل تحویل را بررسی کنید.');else if(o.data.state==='approved'){
   const sales=(await db.prepare("SELECT data FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesOrderId')=?").bind(o.id).all()).results.map((s:any)=>JSON.parse(s.data));const complete=o.data.lines.every((l:any)=>sales.filter(s=>s.productId===l.productId&&s.state==='delivered').reduce((n,s)=>n+s.count,0)>=l.quantity);if(!complete)task(a,'delivery:'+o.id,'پیگیری تحویل '+o.data.code,o.data.promisedDay||addDay(o.created.slice(0,10),2),'staff','سریال رزرو، تحویل جزئی و مانع یا موعد جدید را پیگیری کنید.');
  }
  for(const p of account.payments)if(p.data.state==='pending')task(a,'payment:'+p.id,'بررسی رسید پرداخت',addDay(p.created.slice(0,10),1),'finance','رسید '+p.data.reference+' را با بانک تطبیق دهید؛ سپس تأیید و به اقساط تخصیص دهید.');else if(p.data.state==='received')task(a,'check:'+p.id,'پیگیری وصول چک',p.data.checkDue,'finance','نتیجه وصول یا برگشت چک '+p.data.reference+' را ثبت کنید.');
  for(const i of account.invoices)for(const p of i.installments)if(rial(p.remaining)>BigInt(0)&&p.days<=7){for(const role of ['agent','finance'])task(a,'due:'+i.id+':'+p.id,'سررسید فاکتور '+i.data.reference,p.due,role,'مانده قسط '+p.id+': '+p.remaining+' ریال. پرداخت اعلامی تنها پس از تأیید و تخصیص مالی در مانده اثر دارد.');}
  for(const t of own.filter(r=>r.type==='sales_target')){const progress=salesTargetProgress(t,rows,today);if(progress.active&&progress.next)for(const role of ['agent','staff'])task(a,'target:'+t.id,'پیگیری تارگت '+t.data.title,t.data.end,role,'تا پلکان بعدی '+progress.next.remaining+(t.data.basis==='units'?' دستگاه':' ریال')+' باقی مانده است.');}
  for(const o of own.filter(r=>r.type==='sales_opening'&&r.data.state==='pending'))task(a,'opening:'+o.id,'تطبیق مانده افتتاحیه',addDay(o.created.slice(0,10),1),'finance','جمع بدهی و اعتبار را با منبع '+o.data.source+' / '+o.data.reference+' تطبیق دهید.');
  for(const r of account.returns)if(r.data.state==='returned')task(a,'return:'+r.id,'تأیید مالی برگشتی',addDay(r.updated.slice(0,10),1),'finance','رسید انبار '+r.data.receipt+' و فاکتور اصلی را برای صدور اعتبار بررسی کنید.');
 }
 for(const t of old)if(!wanted.has(t.id)&&!['completed','cancelled'].includes(t.state))stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=? AND revision=?").bind(now,t.id,t.revision));
 if(stmts.length)await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'sales_tasks','{}','workflow',?,1)").bind(op,now),...checks,...stmts]);return {updated:stmts.length};
}
