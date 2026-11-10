import {storedAccessPermissions} from './permissions';
import {storage} from './storage';
import {dayAt,addDay} from './duties';
import {salesRows,salesLock,salesStaff,salesFinance,salesRep,salesManager} from './sales';
import {rewardPeriods,salesRewardProgress} from './sales-rewards';
import {salesAccounts,salesCheckPosition,salesTargetProgress,rial} from './sales-contract';
export async function syncSalesTasks(){
 const db=storage(),op=crypto.randomUUID(),checks=await salesLock(db,op),rows=await salesRows(),today=dayAt(),now=new Date().toISOString();
 const members=(await db.prepare("SELECT id,name,permissions FROM app_members WHERE status='active'").all()).results.map((m:any)=>({...m,permissions:storedAccessPermissions(m.permissions)}));
 const old=(await db.prepare("SELECT * FROM duty_runs WHERE template_id LIKE 'sales:%'").all()).results as any[],wanted=new Set<string>(),stmts:D1PreparedStatement[]=[];
 function task(agent:any,key:string,title:string,due:string,role:string,instructions:string,sourceId=''){
  const assigned=role==='staff'?agent.data.ownerId:role==='finance'?agent.data.financeId:'';
  const eligible=members.filter(m=>{const u={isAdmin:false,permissions:m.permissions} as any;if(role==='agent')return salesRep(u)&&m.permissions.salesAgentId===agent.id;if(salesRep(u))return false;return role==='finance'?salesFinance(u):role==='manager'?salesManager(u):salesStaff(u);});
  const candidates=assigned&&eligible.some(m=>m.id===assigned)?eligible.filter(m=>m.id===assigned):role==='staff'?eligible.filter(m=>salesManager({isAdmin:false,permissions:m.permissions} as any)):eligible;
  for(const m of candidates){const managers=members.filter(v=>v.id!==m.id&&salesManager({isAdmin:false,permissions:v.permissions} as any)).sort((a,b)=>a.id.localeCompare(b.id)),supervisor=(managers.find(v=>v.id===agent.data.managerId)||managers[0])?.id||null;const tid='sales:'+key+':'+role+':'+m.id;wanted.add(tid);const existing=old.find(t=>t.id===tid),data={title:title+' · '+agent.data.name,instructions:instructions+'\nپرونده را در «فروش و نمایندگان» باز کنید. پاسخ متنی جای انجام مرحله واقعی را نمی‌گیرد.',evidence:'text',positionName:'فروش و نمایندگان',sourceSection:'sales',sourceId:sourceId||(/^(payment|check|due):/.test(key)?'account:'+agent.id:''),salesWorkflow:true,salesAgentId:agent.id,workflowRole:role,remindHours:24,escalateHours:48,history:[],answer:'',extensionRequested:''};
   const at=due+'T12:30:00Z';if(existing){const d=JSON.parse(existing.data);if(d.title===data.title&&d.instructions===data.instructions&&d.sourceId===data.sourceId&&existing.due===at&&existing.supervisor===supervisor&&!['completed','cancelled'].includes(existing.state))continue;stmts.push(db.prepare("UPDATE duty_runs SET state=CASE WHEN state IN ('completed','cancelled') THEN 'open' ELSE state END,due=?,supervisor=?,data=?,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(at,supervisor,JSON.stringify({...d,...data,history:d.history,answer:d.answer,extensionRequested:d.extensionRequested}),now,tid,existing.revision));}
   else stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,?,?,'open',?,1,?,?)").bind(tid,'sales:'+key,today,m.id,supervisor,at,JSON.stringify(data),now,now));
  }
 }
 for(const a of rows.filter(r=>r.type==='sales_agent'&&r.data.active)){
  const own=rows.filter(r=>r.data.agentId===a.id),account=salesAccounts(rows,a.id,today);
  const contacts=own.filter(r=>r.type==='sales_contact').sort((a,b)=>b.created.localeCompare(a.created));if(a.data.contactDays)task(a,'contact','پیگیری تماس / بازدید',contacts[0]?.data.nextDue||addDay(a.created.slice(0,10),a.data.contactDays),'staff',contacts[0]?.data.nextAction||'تماس با شریک فروش و ثبت نتیجه');for(const c of own.filter(r=>r.type==='sales_case'&&r.data.state==='open'))task(a,'network-case:'+c.id,c.data.title,c.data.nextDue,'staff',c.data.nextAction);
  for(const o of own.filter(r=>r.type==='sales_order'))if(['submitted','credit_review','sales_approved'].includes(o.data.state))task(a,'order:'+o.id+':'+o.data.state,o.data.state==='submitted'?'بررسی سفارش '+o.data.code:'تأیید مالی سفارش '+o.data.code,addDay(o.created.slice(0,10),1),o.data.state==='submitted'?(o.data.securedPolicy||o.data.salesTerms?'manager':'staff'):'finance','قیمت، مهلت پرداخت و موجودی قابل تحویل را بررسی کنید.');else if(o.data.state==='approved'){
   const sales=(await db.prepare("SELECT data FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesOrderId')=?").bind(o.id).all()).results.map((s:any)=>JSON.parse(s.data));const complete=o.data.lines.every((l:any)=>sales.filter(s=>!s.replacementReturnId&&s.productId===l.productId&&s.state==='delivered').reduce((n,s)=>n+s.count,0)>=l.quantity);if(!complete)task(a,'delivery:'+o.id,'پیگیری تحویل '+o.data.code,o.data.promisedDay||addDay(o.created.slice(0,10),2),'staff','رزرو سریال، ارسال و تأیید دریافت هر محموله را پیگیری کنید. اگر نماینده از سامانه استفاده نمی‌کند، مستند دریافت را بگیرید و از حساب خودتان ثبت کنید. مانع یا موعد جدید را ثبت کنید.');
  }
  for(const p of account.payments)if(p.data.state==='pending')task(a,'payment:'+p.id,p.data.checkPurpose==='collateral'?'تأیید چک ضمانت':'بررسی رسید پرداخت',addDay(p.created.slice(0,10),1),'finance',p.data.checkPurpose==='collateral'?'اعتبار و مدرک چک ضمانت '+p.data.reference+' را بررسی کنید.':'رسید '+p.data.reference+' را با بانک تطبیق دهید؛ سپس تأیید و به اقساط تخصیص دهید.');else if(p.data.state==='received'){
   const review=p.data.disposition?.state==='pending'||salesCheckPosition(p,account,today).requiresReview;
   task(a,'check:'+p.id,review?'تعیین تکلیف چک':'پیگیری وصول چک',review?today:p.data.checkDue,'finance',review?'درخواست یا اختلاف مبلغ چک '+p.data.reference+' را در حساب نماینده بررسی کنید.':'نتیجه وصول یا برگشت چک '+p.data.reference+' را ثبت کنید.');
  }
  for(const i of account.invoices)for(const p of i.installments)if(rial(p.remaining)>BigInt(0)&&p.days<=7){for(const role of ['agent','staff','finance'])task(a,'due:'+i.id+':'+p.id,'سررسید فاکتور '+i.data.reference,p.due,role,'مانده قسط '+p.id+': '+p.remaining+' ریال. پرداخت اعلامی تنها پس از تأیید و تخصیص مالی در مانده اثر دارد.');}
  for(const t of own.filter(r=>r.type==='sales_target')){const progress=salesTargetProgress(t,rows,today);if(progress.active&&progress.next)for(const role of ['agent','staff'])task(a,'target:'+t.id,'پیگیری تارگت '+t.data.title,t.data.end,role,'تا پلکان بعدی '+progress.next.remaining+(t.data.basis==='units'?' دستگاه':' ریال')+' باقی مانده است.');}
  for(const reward of own.filter(r=>r.type==='sales_reward'&&r.data.state==='active')){
   if(!salesRewardProgress(reward,rows,today).ready)continue;
   const period=reward.data.period as keyof typeof rewardPeriods;
   task(a,'reward:'+reward.id,'تأیید '+rewardPeriods[period],addDay(reward.data.end,1),'finance','خرید خالص و پاداش دوره را بررسی و نتیجه را ثبت کنید.','sales-view:reward-'+period+':'+reward.id);
  }
  for(const o of own.filter(r=>r.type==='sales_opening'&&r.data.state==='pending'))task(a,'opening:'+o.id,'تطبیق مانده افتتاحیه',addDay(o.created.slice(0,10),1),'finance','جمع بدهی و اعتبار را با منبع '+o.data.source+' / '+o.data.reference+' تطبیق دهید.');
  for(const r of account.returns)if(r.data.state==='returned')task(a,'return:'+r.id,'تأیید مالی برگشتی',addDay(r.updated.slice(0,10),1),'finance','رسید انبار '+r.data.receipt+' و فاکتور اصلی را برای صدور اعتبار بررسی کنید.');
 }
 for(const t of old)if(!wanted.has(t.id)&&!['completed','cancelled'].includes(t.state))stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=? AND revision=?").bind(now,t.id,t.revision));
 if(stmts.length)await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'sales_tasks','{}','workflow',?,1)").bind(op,now),...checks,...stmts]);return {updated:stmts.length};
}
