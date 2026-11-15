import {storage} from './storage';
import {trainingContext} from './training-context';
import type {AccountingKind} from './accounting-contract';
export type EconomicInput={kind:AccountingKind;sourceId:string;sourceVersion:number;operationId:string;part?:string;day:string;actor:string;payload:any};
/** Transactional outbox: callers include these statements in their original domain batch. */
export function economicStatements(db:D1Database,e:EconomicInput):D1PreparedStatement[]{
 if(trainingContext.getStore())return [];
 const key=e.kind+':'+e.operationId+':'+(e.part||e.sourceId),payload=JSON.stringify({contractVersion:1,...e.payload}),now=new Date().toISOString();
 return [db.prepare("INSERT INTO economic_events(id,source_key,kind,source_id,source_version,occurred_day,created,actor,payload,state,attempts) VALUES(?,?,?,?,?,?,?,?,?,'pending',0) ON CONFLICT(source_key) DO UPDATE SET payload=excluded.payload").bind(key,key,e.kind,e.sourceId,e.sourceVersion,e.day,now,e.actor,payload)];
}
export function receiptProvisionalPrice(order:any,quantity:number){
 const d=order?.data||order,q=d.quoteSnapshot;
 if(!d.financialApprovedAt||!q?.financial||q.baseRial==null||!Number.isSafeInteger(d.quantity)||d.quantity<=0||!Number.isSafeInteger(quantity)||quantity<=0)return null;
 const net=BigInt(q.baseRial)-BigInt(q.discountRial||'0');if(net<0)return null;
 // Commercial snapshot amounts are integer IRR; preserve six fractional digits.
 const micro=net*BigInt(1000000)*BigInt(quantity)/BigInt(d.quantity);return {amount:(micro/BigInt(1000000)).toString()+(micro%BigInt(1000000)?'.'+(micro%BigInt(1000000)).toString().padStart(6,'0').replace(/0+$/,''):''),basis:{orderId:order.id,orderRevision:order.revision,baseRial:q.baseRial,discountRial:q.discountRial||'0',quantity:d.quantity}};
}
export async function economicBacklog(limit=50){return (await storage().prepare("SELECT * FROM economic_events WHERE state IN ('pending','exception') ORDER BY created,id LIMIT ?").bind(Math.min(100,Math.max(1,limit))).all()).results as any[];}

/** The domain mutation and reversal outbox are committed together, without editing prior events. */
export async function economicReversalStatements(db:D1Database,input:{sourceId:string;operationId:string;actor:string;day:string;reason:string;invoiceId?:string;allocationId?:string}){
 const rows=(await db.prepare("SELECT * FROM economic_events WHERE source_id=? AND kind!='reversal' AND state NOT IN ('cancelled','superseded') AND NOT EXISTS(SELECT 1 FROM economic_events r WHERE r.kind='reversal' AND json_extract(r.payload,'$.originalEventId')=economic_events.id AND r.state!='cancelled') AND ((? IS NOT NULL AND kind IN ('purchase_invoice','purchase_variance') AND json_extract(payload,'$.invoiceId')=?) OR (? IS NOT NULL AND source_key LIKE ?)) ORDER BY created,id LIMIT 101").bind(input.sourceId,input.invoiceId||null,input.invoiceId||null,input.allocationId||null,'purchase_allocation:'+input.allocationId+':%').all()).results as any[];
 if(rows.length>100)throw Error('تعداد آثار اصلاح بیشتر از حد یک عملیات است؛ رسیدگی مالی لازم است.');
 const statements:D1PreparedStatement[]=[];for(const row of rows){const journal:any=await db.prepare('SELECT id,state FROM accounting_journals WHERE event_id=?').bind(row.id).first();if(journal?.state==='posted'){statements.push(...economicStatements(db,{kind:'reversal',sourceId:input.sourceId,sourceVersion:row.source_version,operationId:input.operationId,part:row.id,day:input.day,actor:input.actor,payload:{originalEventId:row.id,reason:input.reason,currency:'IRR'}}));}else{
  statements.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN "+(journal?"EXISTS(SELECT 1 FROM accounting_journals WHERE id=? AND state='draft')":"NOT EXISTS(SELECT 1 FROM accounting_journals WHERE event_id=?)")+" THEN guard ELSE 0 END WHERE id=?").bind(journal?.id||row.id,input.operationId));if(journal)statements.push(db.prepare("UPDATE accounting_journals SET state='cancelled' WHERE id=? AND state='draft'").bind(journal.id));statements.push(db.prepare("UPDATE economic_events SET state='cancelled',issue=? WHERE id=?").bind('برگشت مبدأ پیش از قطعی‌شدن: '+input.reason,row.id));
 }}return statements;
}
