import {storage} from './storage';
import {notice} from './duties';
import {salesRows,salesDecode,salesLock,salesManager,salesStaff,salesFinance} from './sales';
import {localDay} from './persian-date';
import {monitorDefaults,detectSalesAlerts,dueReports,buildSalesReport,reportKinds} from './sales-monitor-contract';
import {rial} from './sales-contract';
export async function monitorMembers(){return (await storage().prepare("SELECT id,name,status,permissions FROM app_members WHERE status='active'").all()).results.map((m:any)=>{const u={isAdmin:false,permissions:JSON.parse(m.permissions)} as any;return {id:m.id,name:m.name,permissions:m.permissions,sales:salesStaff(u),finance:salesFinance(u),manager:salesManager(u)};});}
export async function monitorPolicy(){const r:any=await storage().prepare("SELECT * FROM flow_entities WHERE id='sales-monitor-policy' AND type='sales_monitor_policy'").first();return r?salesDecode(r):{id:'sales-monitor-policy',revision:0,data:{...monitorDefaults,startedDay:localDay()},created:null};}
export async function monitorTasks(){return (await storage().prepare("SELECT * FROM duty_runs WHERE json_extract(data,'$.salesWorkflow')=1").all()).results.map(salesDecode);}
export async function monitorDeliveries(){return (await storage().prepare("SELECT id,data,revision,updated FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesOrderId') IS NOT NULL").all()).results.map((r:any)=>{const d=JSON.parse(r.data);return {id:r.id,revision:r.revision,updated:r.updated,orderId:d.salesOrderId,productId:d.productId,count:d.count,state:d.state};});}
export async function monitorHealth(now=new Date()){
 const r:any=await storage().prepare("SELECT data,updated FROM flow_entities WHERE id='sales-monitor-health'").first(),d=r?JSON.parse(r.data):{};
 return {...d,lastScan:r?.updated||null,backgroundStale:!d.lastBackground||now.getTime()-Date.parse(d.lastBackground)>15*60000};
}
// A domain run is one guarded batch. The sales lock excludes competing ledger and monitoring writes.
export async function scanSalesMonitor({now=new Date(),source='interactive',reports=true}:{now?:Date;source?:string;reports?:boolean}={}){
 const db=storage(),op=crypto.randomUUID(),checks=await salesLock(db,op),policy=await monitorPolicy(),p={...monitorDefaults,...policy.data},at=now.toISOString(),today=localDay(now);
 if(!p.enabled)return {enabled:false,alerts:0,reports:0};
 const [rows,members,deliveries,tasks]=await Promise.all([salesRows(),monitorMembers(),monitorDeliveries(),monitorTasks()]),stmts:D1PreparedStatement[]=[],changed=new Set<string>();
 const oldAlerts=rows.filter(r=>r.type==='sales_alert'),nextAlerts=[...oldAlerts],wantedTasks=new Set<string>();
 const guard=(q:string,...v:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+q+' THEN guard ELSE 0 END WHERE id=?').bind(...v,op));
 for(const m of members)guard("EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND permissions=?)",m.id,m.permissions);
 // Fulfillment/transport may change while this report is read; include its source revisions.
 for(const s of deliveries)guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)",s.id,s.revision);
 function put(id:string,type:string,data:any,old?:any){const row={id,type,data,revision:(old?.revision||0)+1,created:old?.created||at,updated:at};stmts.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),at,id,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(data),at,at));if(old)guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',id,old.revision);return row;}
 if(!policy.revision)put(policy.id,'sales_monitor_policy',{...p,startedDay:today,history:[{mode:'defaults',actor:'workflow',at,notes:'قواعد اولیه پایش؛ مدیر می‌تواند تغییر دهد.'}]});
 const candidates=detectSalesAlerts(rows,deliveries,now,p),keys=new Set(candidates.map(c=>'sales-alert:'+c.key));
 for(const c of candidates){const id='sales-alert:'+c.key,old=oldAlerts.find(a=>a.id===id),agent=rows.find(a=>a.id===c.agentId)!,fingerprint=JSON.stringify(c.evidence);
  if(old?.data.state==='reviewed'&&old.data.reviewFingerprint===fingerprint)continue;
  const eligible=members.filter(m=>c.kind==='pending_payment'?m.finance:m.sales),assigned=c.kind==='pending_payment'?agent.data.financeId:agent.data.ownerId;
  const owner=eligible.find(m=>m.id===(old?.data.ownerId||assigned))||eligible.find(m=>m.id===assigned)||eligible[0],managers=members.filter(m=>m.manager),supervisor=managers.find(m=>m.id===agent.data.managerId&&m.id!==owner?.id)||managers.find(m=>m.id!==owner?.id);
  const reopening=old&&['resolved','reviewed'].includes(old.data.state),cycle=(old?.data.cycle||0)+(!old||reopening?1:0),due=reopening||!old?new Date(now.getTime()+p.responseHours*3600000).toISOString():old.data.due;
  const baseWeight=rial(old?.data.notifiedWeight||c.weight),worse=!!old&&(c.severity==='critical'&&old.data.severity!=='critical'||rial(c.weight)>baseWeight&&rial(c.weight)*BigInt(100)>=baseWeight*BigInt(120));
  const notifyChanged=!old||reopening||worse,version=(old?.data.notificationVersion||0)+(notifyChanged?1:0),state=reopening?'open':old?.data.state||'open';
  const data={...old?.data,...c,fingerprint,state,cycle,due,ownerId:owner?.id||'',supervisorId:supervisor?.id||'',managerIds:managers.map(m=>m.id),notificationVersion:version,notifiedWeight:notifyChanged?c.weight:old?.data.notifiedWeight||c.weight,firstSeen:old?.data.firstSeen||at,lastChanged:at,resolvedAt:'',history:[...(old?.data.history||[]),...(!old||reopening||worse?[{mode:reopening?'reopened':!old?'detected':'worsened',actor:'workflow',at,notes:c.summary}]:[])]};
  const same=old&&old.data.fingerprint===fingerprint&&old.data.ownerId===data.ownerId&&old.data.supervisorId===data.supervisorId&&JSON.stringify(old.data.managerIds)===JSON.stringify(data.managerIds)&&old.data.state===state;
  const row=same?old:put(id,'sales_alert',data,old);if(!same)changed.add(id);const pos=nextAlerts.findIndex(a=>a.id===id);if(pos<0)nextAlerts.push(row);else nextAlerts[pos]=row;
 }
 for(const a of oldAlerts)if(!keys.has(a.id)&&!['resolved','reviewed'].includes(a.data.state)){const row=put(a.id,'sales_alert',{...a.data,state:'resolved',resolvedAt:at,history:[...a.data.history,{mode:'resolved',actor:'workflow',at,notes:'شرط هشدار با داده و قواعد فعلی دیگر برقرار نیست؛ سابقه حفظ شد.'}]},a);nextAlerts[nextAlerts.findIndex(r=>r.id===a.id)]=row;changed.add(a.id);}
 function upsertTask(id:string,template:string,member:string,supervisor:string|null,due:string,data:any){wantedTasks.add(id);const old=tasks.find(t=>t.id===id);if(old&&JSON.stringify(old.data)===JSON.stringify({...old.data,...data})&&old.due===due&&old.supervisor===supervisor&&!['completed','cancelled'].includes(old.state))return;
  if(old)stmts.push(db.prepare("UPDATE duty_runs SET data=?,supervisor=?,due=?,state=CASE WHEN state IN ('completed','cancelled') THEN 'open' ELSE state END,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(JSON.stringify({...old.data,...data}),supervisor,due,at,id,old.revision));
  else stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,?,?,'open',?,1,?,?)").bind(id,template,today,member,supervisor,due,JSON.stringify({history:[],answer:'',extensionRequested:'',evidence:'text',sourceSection:'sales',salesWorkflow:true,...data}),at,at));
 }
 for(const a of nextAlerts.filter(a=>!['resolved','reviewed'].includes(a.data.state))){const d=a.data,recipients=members.filter(m=>m.id===d.ownerId||d.managerIds.includes(m.id));for(const m of recipients){const id='sales-watch:'+a.id+':'+m.id,old=tasks.find(t=>t.id===id),phase='alert:'+d.cycle+':'+d.notificationVersion;
  upsertTask(id,'sales-watch:'+a.id,m.id,m.id===d.ownerId?d.supervisorId||null:null,d.due,{title:d.title,instructions:d.summary+'\n'+d.action+'\nپرونده هشدار را در «گزارش مدیر و هشدارها» باز کنید. پاسخ متنی هشدار را نمی‌بندد.',positionName:m.manager?'مدیر فروش':'پیگیری فروش',salesMonitorWorkflow:true,salesAlertId:a.id,salesAgentId:d.agentId,workflowRole:'monitor',remindHours:24,escalateHours:p.escalationHours});
  if(!old||changed.has(a.id)){stmts.push(notice(id,m.id,phase,d.title+' — '+d.summary,at));}
  if(now.getTime()>=Date.parse(d.due)){const bucket=Math.min(6,Math.floor((now.getTime()-Date.parse(d.due))/86400000));stmts.push(notice(id,m.id,'late:'+d.cycle+':'+d.due+':'+bucket,'پیگیری عقب‌افتاده: '+d.title,at));}
  if(m.manager&&now.getTime()>=Date.parse(d.due)+p.escalationHours*3600000)stmts.push(notice(id,m.id,'escalated:'+d.cycle+':'+d.due,'نیاز به مداخله مدیر: '+d.title,at));
 }}
 for(const t of tasks.filter(t=>t.data.salesMonitorWorkflow&&!wantedTasks.has(t.id)&&!['completed','cancelled'].includes(t.state)))stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=? AND revision=?").bind(at,t.id,t.revision));
 let generated=0;
 if(reports)for(const window of dueReports(now,p)){const id='sales-report:'+window.kind+':'+window.scheduled;if(await db.prepare("SELECT id FROM flow_entities WHERE id=? AND type='sales_report'").bind(id).first())continue;const data={...buildSalesReport(window.kind,rows,deliveries,tasks,nextAlerts,members,now,window),scheduledDay:window.scheduled,policyRevision:policy.revision||1,source,history:[]};put(id,'sales_report',data);generated++;
  for(const m of members.filter(m=>m.manager)){const tid='sales-report:'+id+':'+m.id;upsertTask(tid,'sales-report:'+id,m.id,null,new Date(now.getTime()+24*3600000).toISOString(),{title:'گزارش '+reportKinds[window.kind]+' فروش آماده است',instructions:data.summary.join('\n')+'\nگزارش مدیر فروش را باز کنید؛ مشاهده گزارش به معنی رفع هشدارهای آن نیست.',positionName:'مدیر فروش',salesReport:true,salesReportId:id,workflowRole:'manager',remindHours:24,escalateHours:48});stmts.push(notice(tid,m.id,'ready','گزارش '+reportKinds[window.kind]+' فروش آماده است.',at));}
 }
 const health:any=await db.prepare("SELECT * FROM flow_entities WHERE id='sales-monitor-health'").first(),previous=health?salesDecode(health):null;
 put('sales-monitor-health','workflow_health',{...previous?.data,lastSource:source,lastBackground:source==='background'?at:previous?.data.lastBackground||null,managers:members.filter(m=>m.manager).length,unassignedAlerts:nextAlerts.filter(a=>!['resolved','reviewed'].includes(a.data.state)&&!a.data.ownerId).length,scanSucceeded:true},previous);
 await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'sales_monitor_scan',?,'workflow',?,1)").bind(op,JSON.stringify({source,alerts:changed.size,reports:generated}),at),...checks,...stmts]);
 return {enabled:true,alerts:changed.size,reports:generated,at};
}
