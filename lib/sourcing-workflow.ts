import {storedAccessPermissions} from './permissions';
import {moneyMicro,moneyText} from './costing';

export const supplyTerminalStates=['completed','released','rejected','cancelled','stock_rejected'];
export const isMaterialSupply=(p:any)=>['replenishment','project_material'].includes(p.data?.origin||p.origin);
export const isOpenSupply=(p:any)=>!supplyTerminalStates.includes(p.data?.state||p.state);

/** One demand, one source. Never merge unrelated projects just because codes match. */
export function projectMaterialSupply(project:any,request:any,material:any,quantity:number,actor:any,now:string){
 const needBy=project.data.due<now.slice(0,10)?now.slice(0,10):project.data.due;
 return {supplierTargets:[] as any[],origin:'project_material',source:{kind:'project',projectId:project.id,requestId:request.id},materialId:material.id,productId:'',productName:material.data.name,count:0,needBy,reference:project.data.title+' · '+request.partCode,state:'sourcing',requestedBy:actor.userId,inventoryConfirmed:{actor:actor.userId,name:actor.name,at:now,notes:'کسری درخواست پروژه پس از بررسی موجودی'},finance:{status:'pending',budgetRial:'0'},history:[{mode:'project_shortage',actor:actor.userId,name:actor.name,at:now}],lines:[{materialId:material.id,partCode:material.data.code,name:material.data.name,unit:material.data.unit,specs:material.data.specs||'',designVersion:material.data.designVersion||0,materialRevision:material.revision,required:quantity,stock:0,pending:0,pipeline:0,shortage:quantity,routes:material.data.sourcingRoutes||[],round:1}]};
}

export function supplyRoleMember(member:any,role:string){
 if(member.status!=='active')return false;
 const p=storedAccessPermissions(member.permissions);
 if(p.salesAgentId||p.serviceAgentId||p.hospitalCenterId)return false;
 return role==='qc'?!!p.flowRoles?.includes('qc'):!!p.supplyRoles?.includes(role);
}
export function supplyAssignment(plan:any,step:any,members:any[],policy:any={}){
 const legacy=plan.data.origin==='replenishment'&&!plan.data.manualRequest;
 const candidates=members.filter(m=>{if(!supplyRoleMember(m,step.role))return false;if(legacy&&step.role==='inventory'){const p=storedAccessPermissions(m.permissions);return p.flowRoles?.includes('inventory')&&(p.warehouses??['raw','quarantine']).includes('raw')&&(p.warehouses??['raw','quarantine']).includes('quarantine');}return true;});
 if(step.sourceSection==='flow'){const owner=members.find(m=>m.id===step.ownerId&&m.status==='active');return {owner:owner||null,candidates:[],missingOwner:!owner};}
 // Receipt custody is stronger than a general role assignment.
 const selected=step.ownerId||plan.data.workOwners?.[step.role]||policy.owners?.[step.role];
 const owner=candidates.find(m=>m.id===selected)||(!legacy&&!selected&&candidates.length===1?candidates[0]:null);
 return {owner:owner||null,candidates:candidates.map(m=>({id:m.id,name:m.name})),missingOwner:!owner};
}

/** Derive actual paid amounts from active payable documents, never from a buyer report.
 * Invoice allocations spanning orders are apportioned deterministically in micro-rials.
 * Direct order payments are counted once, including their subsequent allocations. */
export function orderFinancialSummary(order:any,cases:any[]){
 let paid=BigInt(0),invoiced=BigInt(0),unallocated=BigInt(0);const references=new Set<string>();
 for(const c of cases){
  const d=c.data,valid=(xs:any[]=[])=>xs.filter(x=>!x.voided),payments=valid(d.payments),invoices=valid(d.invoices),allocations=valid(d.allocations);
  for(const p of payments){
   const linked=p.orderId||valid(d.advances).find((a:any)=>a.id===p.advanceId)?.orderId;
   if(linked===order.id){const n=moneyMicro(p.amount);paid+=n;references.add(p.reference);const used=allocations.filter((a:any)=>a.paymentId===p.id).reduce((n:bigint,a:any)=>n+moneyMicro(a.amount),BigInt(0));unallocated+=n>used?n-used:BigInt(0);}
  }
  for(const i of invoices){
   const lines=i.lines||[],total=lines.reduce((n:bigint,l:any)=>n+moneyMicro(l.amount),BigInt(0));
   const part=lines.filter((l:any)=>l.orderId===order.id).reduce((n:bigint,l:any)=>n+moneyMicro(l.amount),BigInt(0));invoiced+=part;
   if(!part||!total)continue;
   for(const a of allocations.filter((a:any)=>a.invoiceId===i.id)){
    const p=payments.find((p:any)=>p.id===a.paymentId);if(!p)continue;
    const direct=p.orderId||valid(d.advances).find((x:any)=>x.id===p.advanceId)?.orderId;if(direct)continue;
    // Cumulative allocation deltas avoid rounding loss over installment payments.
    const before=allocations.filter((x:any)=>x.invoiceId===i.id&&allocations.indexOf(x)<allocations.indexOf(a)&&payments.some((p:any)=>p.id===x.paymentId&&!(p.orderId||valid(d.advances).find((v:any)=>v.id===p.advanceId)?.orderId))).reduce((n:bigint,x:any)=>n+moneyMicro(x.amount),BigInt(0));
    paid+=(before+moneyMicro(a.amount))*part/total-before*part/total;references.add(p.reference);
   }
  }
 }
 return {paidRial:moneyText(paid),invoicedRial:moneyText(invoiced),unallocatedRial:moneyText(unallocated),references:[...references],state:paid===BigInt(0)?'unpaid':paid>=BigInt(order.data.totalRial||'0')*BigInt(1000000)?'paid':'partial'};
}

export function orderDelivery(order:any,receipts:any[]){
 const rs=receipts.filter(r=>r.data.purchaseOrderId===order.id);
 const accepted=rs.filter(r=>r.data.state==='stored').reduce((n,r)=>n+(r.data.accepted||0),0);
 return {accepted,rejected:rs.reduce((n,r)=>n+(r.data.rejected||0),0),pending:rs.some(r=>!['stored','rejected'].includes(r.data.state)),remaining:Math.max(0,order.data.quantity-accepted)};
}

/** A later receipt/QC correction invalidates the disposition; nothing is assumed accepted. */
export function currentRemainderResolution(order:any,rows:any[]){
 const decision=order?.data?.remainderResolution;if(!decision?.receipts||order.data.state!=='closed')return false;
 const receipts=rows.filter(r=>r.type==='receipt'&&r.data.purchaseOrderId===order.id),d=orderDelivery(order,receipts);
 return !d.pending&&d.accepted===decision.accepted&&d.remaining===decision.remaining&&receipts.length===decision.receipts.length&&receipts.every(r=>decision.receipts.some((s:any)=>s.id===r.id&&s.revision===r.revision));
}
