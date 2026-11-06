// Quantities use the inventory's integer thousandths. QC does not physically
// move rejected units, so one quarantine balance can contain two quality states.
export function stockQuality(stage:string,quantity:number,receipt?:any,batch?:any,today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'})){
 const q=Math.max(0,quantity),r=receipt?.data||receipt,b=batch?.data||batch;
 if(stage==='nonconforming'||(b?.expiry||r?.expiry||'')&&String(b?.expiry||r?.expiry)<today)return {usable:0,pending:0,rejected:q};
 if(stage==='quarantine'){
  const pending=['pending_qc','awaiting_qc_template'].includes(r?.state)?q:r?.state==='awaiting_warehouse'?Math.min(q,Math.max(0,r.accepted||0)):!r&&b?.status!=='رد'?q:0;
  return {usable:0,pending,rejected:q-pending};
 }
 if(b?.status==='رد')return {usable:0,pending:0,rejected:q};
 return {usable:q,pending:0,rejected:0};
}
