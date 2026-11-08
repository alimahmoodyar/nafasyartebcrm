export type ProcessRow = {
 id:string; process:string; date:string; status:string; waiting?:boolean;
 title:string; reference:string; section?:string; target?:string;
 material?:string; batches?:string; place?:string; actor?:string; supplier?:string; order?:string; receivedAt?:string;
 quantity?:number; received?:number; unit?:string;
};

export const materialProcesses = {
 issue:'تحویل مواد به خط', lineReceipt:'تأیید دریافت مواد در خط', receipt:'دریافت کالا', quality:'کنترل کیفیت ورودی', placement:'جانمایی',
};

export function materialHistory(entities:any[], warehouses:any[], processes:string[], waitingForLine:boolean):ProcessRow[]{
 const materials=new Map(entities.filter(e=>e.type==='material').map(e=>[e.id,e.data]));
 const names=new Map(warehouses.map(w=>[w.id,w.data.name]));
 const rows:ProcessRow[]=[];
 for(const e of entities){
  if(e.type!=='request'&&e.type!=='receipt')continue;
  const d=e.data,m=materials.get(d.materialId),material=[m?.name,m?.code].filter(Boolean).join(' · ');
  const base={title:m?.name||e.id,reference:e.id,material,unit:m?.unit,section:'flow',target:e.id};
  const place=names.get(d.warehouseId)||'';
  if(e.type==='request'&&(processes.includes('issue')||processes.includes('lineReceipt'))){
   const deliveries=Array.isArray(d.deliveries)?d.deliveries:[];
   const pending=['awaiting_line_receipt','line_discrepancy'].includes(d.state);
   const shipments=[...deliveries];
   if(pending||(!deliveries.length&&d.state==='issued'&&d.issuedAt))shipments.push(d);
   shipments.forEach((s:any,i:number)=>{
    if(!s.issuedAt)return;
    const waiting=s===d&&pending;
    const shipment={...base,id:e.id+':issue:'+i,process:'issue',date:s.issuedAt,waiting:waiting&&waitingForLine&&d.state==='awaiting_line_receipt',
     status:waiting?(d.state==='line_discrepancy'?'مغایرت دریافت':'در انتظار تأیید خط'):'دریافت تأیید شد',
     place:[place,d.lineName||'خط تولید'].filter(Boolean).join(' ← '),actor:s.issuedBy,
     batches:(s.allocations||[]).map((a:any)=>String(a.batchId).replace(/^batch:/,'')).join('، '),
     quantity:((s.originalQuantity??s.quantity)||0)/1000,received:waiting?undefined:s.quantity/1000,receivedAt:waiting?undefined:s.receivedAt};
    if(processes.includes('issue'))rows.push(shipment);
    if(processes.includes('lineReceipt')&&shipment.receivedAt)rows.push({...shipment,id:e.id+':lineReceipt:'+i,process:'lineReceipt',date:shipment.receivedAt,actor:s.receivedBy,quantity:shipment.received});
   });
  }
  if(e.type!=='receipt')continue;
  const batch=String(d.batchId||e.id).replace(/^batch:/,'');
  const receipt={...base,batches:batch,place};
  if(processes.includes('receipt')&&(d.registeredAt||d.day||e.created))rows.push({...receipt,id:e.id+':receipt',process:'receipt',date:d.registeredAt||d.day||e.created,
   waiting:waitingForLine&&['awaiting_qc_template','pending_qc'].includes(d.state),
   status:({awaiting_qc_template:'در انتظار تعریف فرم کنترل',pending_qc:'در انتظار کنترل کیفیت',awaiting_relabel:'در انتظار تعویض لیبل',awaiting_warehouse:'آماده جانمایی',stored:'انبار شده'} as Record<string,string>)[d.state]||'دریافت ثبت شد',
   actor:d.receivedBy||d.quantityCheck?.by,quantity:d.quantity/1000,supplier:d.purchaseCompletion?.supplierName||d.supplierName,order:d.purchaseCompletion?.reference||d.purchaseOrderId});
  if(processes.includes('quality')&&d.qc?.at)rows.push({...receipt,id:e.id+':quality',process:'quality',date:d.qc.at,actor:d.qc.by,status:d.rejected?(d.accepted?'پذیرش بخشی':'رد شده'):'پذیرفته شد',quantity:d.accepted/1000});
  if(processes.includes('placement')&&d.storedAt)rows.push({...receipt,id:e.id+':placement',process:'placement',date:d.storedAt,actor:d.storedBy,status:'جانمایی شد',quantity:d.accepted/1000,place:[place,d.locationLabel].filter(Boolean).join(' · ')});
 }
 return rows;
}
