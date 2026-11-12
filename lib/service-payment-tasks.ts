import {storage} from './storage';
import {bankEntities} from './sales-bank';
import {bankPaymentReviewDue,coveredBankPeriods} from './sales-bank-coverage';
import {readyBankRowForPayment} from './sales-bank-contract';
import {servicePaymentFinance} from './service-payments';
import {storedAccessPermissions} from './permissions';
import {salesLock,salesFinance} from './sales';
import {dayAt} from './duties';
export async function syncServicePaymentTasks(){
 const db=storage(),op=crypto.randomUUID(),checks=await salesLock(db,op),all=await bankEntities(),periods=coveredBankPeriods(all),today=dayAt(),now=new Date().toISOString();
 const members=(await db.prepare("SELECT id,permissions FROM app_members WHERE status='active'").all()).results.filter((m:any)=>servicePaymentFinance({isAdmin:false,permissions:storedAccessPermissions(m.permissions)} as any)),old=(await db.prepare("SELECT * FROM duty_runs WHERE template_id LIKE 'service-payment:%'").all()).results as any[],wanted=new Set<string>(),statements:D1PreparedStatement[]=[];
 for(const p of all.filter(p=>p.type==='sales_payment'&&p.data.serviceDomain==='home'&&p.data.state==='pending'&&bankPaymentReviewDue(p,periods,today)&&!readyBankRowForPayment(p,all)))for(const m of members as any[]){
  const key='service-payment:'+p.id,id=key+':'+m.id,data={servicePaymentWorkflow:true,serviceAgentId:p.data.agentId,sourceSection:salesFinance({isAdmin:false,permissions:storedAccessPermissions(m.permissions)} as any)?'sales-bank':'after-sales',sourceId:(salesFinance({isAdmin:false,permissions:storedAccessPermissions(m.permissions)} as any)?'sales-bank-row:':'')+'service-payments:'+p.data.agentId,title:'بررسی واریزی خدمات — '+p.data.reference,instructions:'حساب مقصد، مبلغ '+p.data.amount+' ریال، تاریخ '+p.data.day+' و کد رهگیری را در تطبیق بانکی بررسی کنید. بدون ردیف معتبر بانک وصول ثبت نمی‌شود.',positionName:'مالی فروش',remindHours:24,escalateHours:48};wanted.add(id);
  const previous=old.find(t=>t.id===id);if(previous){const d=JSON.parse(previous.data);if(d.instructions!==data.instructions||['completed','cancelled'].includes(previous.state))statements.push(db.prepare("UPDATE duty_runs SET state='open',data=?,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(JSON.stringify({...d,...data}),now,id,previous.revision));}else statements.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?, ?,NULL,?,'open',?,1,?,?)").bind(id,key,today,m.id,today+'T12:30:00Z',JSON.stringify(data),now,now));
 }
 for(const t of old)if(!wanted.has(t.id)&&!['completed','cancelled'].includes(t.state))statements.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=? AND revision=?").bind(now,t.id,t.revision));
 if(statements.length)await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'service_payment_tasks','{}','scheduler',?,1)").bind(op,now),...checks,...statements]);
}
