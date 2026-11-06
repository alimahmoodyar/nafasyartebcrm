import {AccessError} from './authorization';

export async function assertWarehouseNotCounting(db:D1Database,warehouseId:string){
 if(!warehouseId)return;
 const row=await db.prepare("SELECT id FROM flow_entities WHERE type='inventory_count' AND json_extract(data,'$.kind')='annual' AND json_extract(data,'$.warehouseId')=? AND json_extract(data,'$.state') IN ('counting','review','awaiting_reopen') LIMIT 1").bind(warehouseId).first();
 if(row)throw new AccessError('انبار در انبارگردانی سالانه است؛ ورود و جابه‌جایی عادی تا تأیید پایان انبارگردانی متوقف است.',409);
}
export type CountMovement={itemId:string;stage:string;delta:number};
/** Authorize only predeclared frozen deliveries, in the same inventory transaction. */
export async function annualCountMovementStatements(db:D1Database,operationId:string,body:any,movements:CountMovement[]):Promise<D1PreparedStatement[]>{
 const cases=(await db.prepare("SELECT * FROM flow_entities WHERE type='inventory_count' AND json_extract(data,'$.kind')='annual' AND json_extract(data,'$.state') IN ('counting','review','awaiting_reopen')").all()).results as any[],stmts:D1PreparedStatement[]=[];
 const totals=new Map<string,CountMovement>();for(const m of movements){if(m.delta>=0)continue;const k=m.itemId+'|'+m.stage,old=totals.get(k)||{...m,delta:0};old.delta+=m.delta;totals.set(k,old);}
 for(const row of cases){const d=JSON.parse(row.data);let changed=false;
  for(const m of totals.values()){if(!d.items.some((i:any)=>i.itemId===m.itemId&&i.stage===m.stage))continue;const referenceId=body.requestId||body.saleId||body.projectId||body.caseId||body.itemId||'',reserves=(d.reservations||[]).filter((r:any)=>r.itemId===m.itemId&&r.stage===m.stage&&r.referenceId===referenceId),q=-m.delta;if(!referenceId||reserves.reduce((n:number,r:any)=>n+r.remaining,0)<q)throw new AccessError('در انبارگردانی سالانه فقط مقدار فریز‌شده برای همین درخواست قابل تحویل است.',409);
   let left=q;for(const r of reserves){const take=Math.min(left,r.remaining);r.remaining-=take;left-=take;}
   const key='count-authorization:'+operationId+':'+row.id+':'+m.itemId+':'+m.stage;
   stmts.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'stocktake_authorization',?,1,?,?)").bind(key,JSON.stringify({operationId,caseId:row.id,itemId:m.itemId,stage:m.stage,quantity:q,referenceId}),new Date().toISOString(),new Date().toISOString()));changed=true;
  }
  if(changed){stmts.unshift(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(row.id,row.revision,operationId));stmts.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(d),new Date().toISOString(),row.id,row.revision));}
 }
 return stmts;
}
