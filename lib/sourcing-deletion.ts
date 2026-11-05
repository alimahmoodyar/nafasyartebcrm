import {AccessError} from './authorization';
import {storage} from './storage';
import {hasSupply,decode,supplyLock} from './sourcing';
import type {Session} from './permissions';

// A budget/quote review is not payment approval. Issuing the purchase is the
// finance gate; cancellation cannot make a previously issued purchase deletable.
const externalReference=`EXISTS(SELECT 1 FROM flow_entities f,json_tree(f.data) j WHERE f.id NOT IN (SELECT value FROM json_each(?)) AND j.type='text' AND j.value IN (SELECT value FROM json_each(?)))`;
const recordReference=`EXISTS(SELECT 1 FROM records r,json_tree(r.payload) j WHERE j.type='text' AND j.value IN (SELECT value FROM json_each(?)))`;
const externalHold=`EXISTS(SELECT 1 FROM sourcing_holds WHERE plan_id<>? AND source_id IN (SELECT value FROM json_each(?)))`;
export async function inspectPurchaseRequestDeletion(u:Session,plan:any){
 const denied=(reason:string)=>({status:{allowed:false,reason,quoteCount:0,orderCount:0},related:[] as any[],ids:''});
 if(!hasSupply(u,'inventory'))return denied('حذف درخواست فقط در اختیار انبار است.');
 if(plan.data.origin!=='replenishment')return denied('این پرونده برنامه تولید است؛ از مسیر لغو برنامه استفاده کنید.');
 if(!['stock_check','stock_rejected','sourcing','direct_returned','cancelled'].includes(plan.data.state))return denied('درخواست در این مرحله قابل حذف نیست.');
 const db=storage(),related=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('purchase_order','sourcing_quote') AND json_extract(data,'$.planId')=?").bind(plan.id).all()).results.map(decode),orders=related.filter(r=>r.type==='purchase_order');
 if(orders.some(o=>o.data.issuedAt||o.data.issuedBy||o.data.fundingReference||!['awaiting_funding','cancelled'].includes(o.data.state)||(o.data.history||[]).some((h:any)=>h.stage==='paid'))||(plan.data.history||[]).some((h:any)=>h.mode==='issue_order'||h.mode==='track'&&h.stage==='paid'))return denied('تأیید وجه یا پرداخت توسط مالی ثبت شده؛ درخواست قابل حذف نیست.');
 const ids=JSON.stringify([plan.id,...related.map(r=>r.id)]),refs:any=await db.prepare(`SELECT (${externalReference}) OR (${recordReference}) OR (${externalHold}) AS blocked`).bind(ids,ids,ids,plan.id,ids).first();
 if(refs?.blocked)return denied('پرونده به دریافت کالا، سند مالی یا گردش دیگری متصل است و قابل حذف نیست.');
 return {status:{allowed:true,reason:'',quoteCount:related.filter(r=>r.type==='sourcing_quote').length,orderCount:orders.length},related,ids};
}
export async function deletePurchaseRequest(u:Session,b:any,signature:string,now:string){
 if(!hasSupply(u,'inventory'))throw new AccessError('حذف درخواست فقط در اختیار انبار است.',403);
 if(typeof b.planId!=='string'||!b.planId.trim()||b.planId.length>200||!Number.isInteger(b.revision)||b.revision<1)throw new AccessError('شناسه درخواست و نسخه معتبر لازم است.',400);
 if(b.confirmed!==true)throw new AccessError('تأیید حذف درخواست لازم است.',400);
 const db=storage(),raw:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='sourcing_plan'").bind(b.planId).first();
 if(!raw)throw new AccessError('درخواست پیدا نشد.',404);
 const plan=decode(raw);if(b.revision!==plan.revision)throw new AccessError('درخواست تغییر کرده؛ دوباره بررسی کنید.',409);
 const inspected=await inspectPurchaseRequestDeletion(u,plan);if(!inspected.status.allowed)throw new AccessError(inspected.status.reason,409);
 const checks=await supplyLock(db,b.id),guard=(condition:string,...params:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+condition+' THEN guard ELSE 0 END WHERE id=?').bind(...params,b.id));
 for(const row of [plan,...inspected.related])guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',row.id,row.revision);
 // Recheck references inside the atomic write, including newly created children.
 guard('NOT ('+externalReference+')',inspected.ids,inspected.ids);guard('NOT ('+recordReference+')',inspected.ids);guard('NOT ('+externalHold+')',plan.id,inspected.ids);
 const event={mode:'delete_request',actor:u.userId,name:u.name,at:now,note:'درخواست خرید توسط انبار پیش از تأیید وجه مالی حذف شد.'};
 await db.batch([
  db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'sourcing_delete_request',signature,u.userId,now),...checks,
  db.prepare('DELETE FROM sourcing_holds WHERE plan_id=?').bind(plan.id),
  db.prepare("UPDATE duty_runs SET state='cancelled',data=json_insert(data,'$.history[#]',json(?)),revision=revision+1,updated=? WHERE json_extract(data,'$.sourcePlanId')=? AND (json_extract(data,'$.sourcingWorkflow')=1 OR json_extract(data,'$.replenishmentWorkflow')=1) AND state NOT IN ('completed','cancelled')").bind(JSON.stringify(event),now,plan.id),
  db.prepare('DELETE FROM flow_entities WHERE id IN (SELECT value FROM json_each(?))').bind(inspected.ids),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,plan.id,'sourcing_delete_request',JSON.stringify({plan,related:inspected.related}),JSON.stringify({deleted:true,...event}),now)
 ]);
 return Response.json({saved:true,deleted:true,planId:plan.id},{headers:{'Cache-Control':'private, no-store'}});
}
