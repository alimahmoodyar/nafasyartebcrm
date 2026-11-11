import {storage} from './storage';
import {purchaseOrderCanAutoClose} from './purchase-fulfillment';

/** Close only against a current warehouse and finance snapshot. */
export async function syncPurchaseOrderClosures(){
 const db=storage(),types="('purchase_order','receipt','purchase_payable')";
 const records=async()=>(await db.prepare('SELECT id,type,data,revision FROM flow_entities WHERE type IN '+types).all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const snapshot=await records();
 for(const order of snapshot.filter(r=>r.type==='purchase_order'&&purchaseOrderCanAutoClose(r,snapshot))){
  const current=await records(),latest=current.find(r=>r.id===order.id);
  if(!latest||!purchaseOrderCanAutoClose(latest,current))continue;
  const now=new Date().toISOString(),id=crypto.randomUUID(),data={...latest.data,state:'closed',closedAt:now,closeNote:'تحویل و مانده پرداخت تکمیل شد.',history:[...(latest.data.history||[]),{stage:'auto_closed',actor:'workflow',at:now}]};
  const count=current.length,revisions=current.reduce((sum,r)=>sum+r.revision,0);
  try{await db.batch([
   db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'purchase_auto_close',?,'workflow',?,CASE WHEN (SELECT COUNT(*) FROM flow_entities WHERE type IN "+types+")=? AND (SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE type IN "+types+")=? THEN 1 ELSE 0 END)").bind(id,JSON.stringify({orderId:latest.id}),now,count,revisions),
   db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,latest.id,latest.revision),
   db.prepare("DELETE FROM sourcing_holds WHERE source_type='po' AND source_id=?").bind(latest.id),
   db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,'workflow',?,'purchase_auto_close',?,?)").bind(crypto.randomUUID(),latest.id,JSON.stringify({state:'closed',reason:data.closeNote}),now)
  ]);}catch(error){if(!/constraint|guard|RESET_MAINTENANCE/i.test(String(error)))throw error;}
 }
}
