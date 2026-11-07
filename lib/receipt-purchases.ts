export type ReceiptPurchase={id:string;materialId:string;supplier:string;quantity:number;received:number;remaining:number;unit:string;state:string;replacements?:{id:string;remaining:number}[];shipments?:{id:string;declaredQuantity:number;expectedDay:string;waybill:string;driverName:string}[]};
export function receiptPurchases(entities:any[],receipts:any[]):ReceiptPurchase[]{
 return entities.filter(e=>e.type==='purchase_order'&&!e.data.pendingSupplierCredit&&['issued','paid','preparing','shipped'].includes(e.data.state)).map(o=>{
  // Physical arrivals count once, including pending QC and rejected quantities.
  // A replacement receipt still requires the existing discrepancy explanation.
  const received=receipts.filter(r=>r.data.purchaseOrderId===o.id).reduce((n,r)=>n+r.data.quantity,0);
  return {id:o.id,materialId:o.data.materialId,supplier:o.data.supplier,quantity:o.data.quantity,unit:o.data.unit,state:o.data.state,replacements:receipts.filter(r=>r.data.purchaseOrderId===o.id&&!r.data.replacementFor&&r.data.rejected>0).map(r=>({id:r.id,remaining:r.data.rejected-receipts.filter(x=>x.data.replacementFor===r.id).reduce((sum,x)=>sum+x.data.quantity-(x.data.rejected||0),0)})).filter(r=>r.remaining>0),shipments:(o.data.shipments||[]).filter((s:any)=>!receipts.some(r=>r.data.purchaseOrderId===o.id&&r.data.purchaseShipmentId===s.id)).map((s:any)=>({id:s.id,declaredQuantity:s.declaredQuantity,expectedDay:s.expectedDay,waybill:s.waybill,driverName:s.driverName})),received,remaining:Math.max(0,o.data.quantity-received)};
 });
}
export const materialPurchases=(orders:ReceiptPurchase[],materialId:string)=>materialId?orders.filter(o=>o.materialId===materialId):[];
export function defaultReceiptPurchase(orders:ReceiptPurchase[],materialId:string){const matches=materialPurchases(orders,materialId);return matches.length===1?{purchaseOrderId:matches[0].id,supplier:matches[0].supplier}:{purchaseOrderId:'',supplier:''};}
