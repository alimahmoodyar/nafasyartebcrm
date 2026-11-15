import {addPaymentDays} from './sales-payment-terms';
import {tehranDay} from './serials';
// Called within the owning physical/production transaction, never by a scan or
// report read. Existing invoice identity/allocations are preserved.
export async function productionStageStatements(db:D1Database,operationId:string,orderId:string,stage:'production'|'dispatch'|'delivery',at:string,actualDay?:string){
 const rows=(await db.prepare("SELECT id,revision,data FROM flow_entities WHERE type='sales_invoice' AND json_extract(data,'$.orderId')=?").bind(orderId).all()).results;
 const checks:D1PreparedStatement[]=[],writes:D1PreparedStatement[]=[];
 for(const row of rows){const data=JSON.parse(String(row.data));if(!data.productionTerms)continue;let changed=false;const installments=data.installments.map((p:any)=>{if(p.productionStage!==stage||p.stageAt)return p;changed=true;return {...p,stageAt:at,stageDay:actualDay||tehranDay(new Date(at)),due:addPaymentDays(actualDay||tehranDay(new Date(at)),p.stageDays||0)};});if(!changed)continue;checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(row.id,row.revision,operationId));writes.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify({...data,installments}),at,row.id,row.revision));}
 return [...checks,...writes];
}
export async function productionDeliveryStatements(db:D1Database,operationId:string,orderId:string,receivedSaleIds:string[],at:string,actualDay?:string){
 const order:any=await db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='sales_order'").bind(orderId).first();if(!order)return [];const d=JSON.parse(order.data);if(!d.productionTerms||d.deliveryMode==='consignment')return [];
 const sales=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='sale' AND json_extract(data,'$.salesOrderId')=?").bind(orderId).all()).results;const received=new Set<string>();for(const row of sales){const data=JSON.parse(String(row.data));if(data.state==='delivered'||receivedSaleIds.includes(String(row.id)))for(const id of data.deviceIds||[])received.add(id);}
 const expected=d.lines.reduce((n:number,l:any)=>n+l.quantity,0);if(received.size<expected)return [];return productionStageStatements(db,operationId,orderId,'delivery',at,actualDay);
}
