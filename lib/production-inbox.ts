// Read-only projection: the approved supply order remains the source of demand.
// Existing daily serial plans allocate its count; no duplicate order/task is stored.
export function productionInbox(entities:any[],jobs:any[],lots:any[],canReadOrders:boolean,records:any[]=[],canReadFinished=false){
 const orders=canReadOrders?entities.filter(e=>e.type==='sourcing_plan'&&e.data.state==='released'&&e.data.approvedBy).map(e=>{
  const planned=entities.filter(p=>p.type==='plan'&&p.data.sourcingPlanId===e.id).reduce((n,p)=>n+Number(p.data.count||0),0);
  return {id:e.id,productId:e.data.productId,productName:e.data.productName,count:e.data.count,planned,remaining:Math.max(0,e.data.count-planned),needBy:e.data.needBy,reference:e.data.reference||''};
 }).filter(e=>Number.isSafeInteger(e.remaining)&&e.remaining>0).sort((a,b)=>String(a.needBy||'9999').localeCompare(String(b.needBy||'9999'))||a.id.localeCompare(b.id)):[];
 const finished=canReadFinished?entities.filter(e=>e.type==='build'&&['planned','prepared'].includes(e.data.state)).map(e=>{const r=records.find(r=>r.id===e.id),d=r?JSON.parse(r.payload):{};return {id:e.id,serial:d.code||'',name:d.productName||d.model||'محصول',state:e.data.state,assembler:e.data.assembler||''};}):[];
 return {orders,finished,jobs:jobs.filter(j=>['open','scheduled'].includes(j.data.state)),quality:lots.filter(l=>l.canQuality&&l.data.pending>0)};
}
