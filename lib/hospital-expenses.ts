import {session,AccessError} from './authorization';
import {hospitalManager,hospitalFinance,hospitalTech,hrow} from './hospital';
import {storage} from './storage';
import {salesLock} from './sales';
import {memberId} from './duties';
import type {Session} from './permissions';
export const expenseStates:Record<string,string>={manager:'منتظر مدیر مستقیم',finance:'منتظر تأیید تنخواه مالی',approved:'تأیید نهایی هزینه',rejected:'رد شده'};
export async function expenseUser(){const u=await session();if(u.permissions.hospitalCenterId||u.permissions.serviceAgentId||!hospitalTech(u)&&!hospitalFinance(u))throw new AccessError('دسترسی تنخواه مأموریت ندارید.',403);return u;}
export async function expenseRows(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type GLOB 'expense_*' ORDER BY created,id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));}
export async function expenseMembers(){return (await storage().prepare("SELECT id,name,permissions FROM app_members WHERE status='active'").all()).results.map((m:any)=>{const u={isAdmin:false,permissions:JSON.parse(m.permissions)} as Session;return {id:m.id,name:m.name,tech:!!hospitalTech(u),manager:!!hospitalManager(u),finance:!!hospitalFinance(u)};});}
export function expenseVisible(u:Session,mid:string,r:any){return u.isAdmin||r.data.ownerId===mid||hospitalManager(u)&&r.data.managerId===mid||hospitalFinance(u)&&r.data.financeId===mid;}
export async function expenseJob(u:Session,id:string){const j=await hrow(id,'hospital_job');if(!hospitalTech(u)||!hospitalManager(u)&&j.data.technicianId!==await memberId(u))throw new AccessError('مأموریت متعلق به شما نیست.',403);if(!['scheduled','dispatched','completed','confirmed','disputed'].includes(j.data.state))throw new AccessError('مأموریت برنامه‌ریزی‌شده لازم است.',400);return j;}
export function expensePolicy(rows:any[],day:string){return rows.find(r=>r.type==='expense_policy'&&r.data.start<=day&&r.data.end>=day);}
export function expenseControl(rows:any[],ownerId:string,day:string,groupId:string,cap:string,amount='0',exclude=''){
 const existing=rows.filter(r=>r.type==='expense_claim'&&r.id!==exclude&&r.data.ownerId===ownerId&&r.data.day===day&&r.data.groupId===groupId&&r.data.state!=='rejected');
 const spent=existing.reduce((n,r)=>n+BigInt(r.data.amount),BigInt(0)),total=spent+BigInt(amount),limit=BigInt(cap),excess=total>limit?total-limit:BigInt(0);
 return {spent:String(spent),total:String(total),limit:cap,remaining:String(spent<limit?limit-spent:BigInt(0)),excess:String(excess)};
}
export async function syncExpenseTasks(){const db=storage(),operation=crypto.randomUUID(),checks=await salesLock(db,operation),rows=await expenseRows(),now=new Date().toISOString(),stmts:D1PreparedStatement[]=[];
 for(const r of rows.filter(r=>r.type==='expense_claim')){const d=r.data;for(const stage of ['manager','finance']){const tid='expense:'+r.id+':'+stage,assignee=stage==='manager'?d.managerId:d.financeId,title=(stage==='manager'?'بررسی هزینه مأموریت':'تأیید تنخواه مالی')+' · '+d.categoryName+(BigInt(d.control.excess)>BigInt(0)?' · بیش از سقف روزانه':'');if(d.state===stage){const data={title,sourceSection:'hospital',sourceId:r.id,hospitalWorkflow:true,workflowRole:stage,instructions:'در خدمات بیمارستانی، بخش تنخواه مأموریت، فاکتور و کنترل سقف روزانه را بررسی کنید.',positionName:stage==='manager'?'مدیر مستقیم خدمات':'مسئول تأیید تنخواه مالی',evidence:'text',history:[],answer:'',remindHours:24,escalateHours:48};stmts.push(db.prepare("INSERT OR IGNORE INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,?,?,'open',?,1,?,?)").bind(tid,'hospital:expense:'+r.id+':'+stage,d.day,assignee,d.managerId,new Date(Date.now()+86400000).toISOString(),JSON.stringify(data),now,now),db.prepare('INSERT OR IGNORE INTO duty_notices(id,task_id,recipient,phase,message,created) VALUES(?,?,?,?,?,?)').bind(tid+':notice',tid,assignee,'initial',title,now));}else stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=? AND state='open'").bind(now,tid));}}
 if(stmts.length)await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'expense_tasks','{}','workflow',?,1)").bind(operation,now),...checks,...stmts]);
}
