import {storage} from '@/lib/storage';
import {memberId} from '@/lib/duties';
import {replenishmentPolicy} from '@/lib/replenishment';
import {supplyAssignment} from '@/lib/sourcing-workflow';
import {requireAccess,accessResponse} from '@/lib/authorization';
import {needSupply,supplyEntities,coverage,nextWork} from '@/lib/sourcing';
export async function GET(){try{
 const u=await requireAccess();needSupply(u,'domestic');
 const plans=await supplyEntities('sourcing_plan'),allQuotes=await supplyEntities('sourcing_quote'),allOrders=await supplyEntities('purchase_order'),quotes=allQuotes.filter(q=>q.data.route==='domestic'),orders=allOrders.filter(o=>o.data.route==='domestic');
 const receipts=await supplyEntities('receipt');
 const needs:any[]=[],cases:any[]=[],tasks:any[]=[],members=(await storage().prepare("SELECT * FROM app_members WHERE status='active'").all()).results as any[],mid=await memberId(u),policy=(await replenishmentPolicy()).data;
 for(const p of plans){const history=p.data.lines?.some((l:any)=>l.procurement?.history?.length)||quotes.some(q=>q.data.planId===p.id)||orders.some(o=>o.data.planId===p.id);const active=['sourcing','ready'].includes(p.data.state);if(!active&&!history)continue;
  const covered=await coverage(p),lines=covered.filter(l=>l.routes?.includes('domestic'));
  if(active)for(const step of nextWork(p,allQuotes,allOrders,covered,receipts).filter(s=>s.role==='domestic')){
   const assignment=supplyAssignment(p,step,members,policy);if(!u.isAdmin&&assignment.owner&&assignment.owner.id!==mid)continue;
   const line=lines.find(l=>(step.key.startsWith('quote:'+l.partCode+':'+l.round+':domestic')||step.key.startsWith('search:'+l.partCode+':'))),target=line?(p.data.supplierTargets||[]).find((t:any)=>t.partCode===line.partCode&&t.round===line.round&&t.route==='domestic'&&step.key.endsWith(':'+t.supplierId)):null;
   const quote=line&&!step.key.endsWith(':missing')?{partCode:line.partCode,round:line.round,supplierLinkId:target?.linkId||''}:null;
   tasks.push({ownerId:assignment.owner?.id||'',ownerName:assignment.owner?.name||'',missingOwner:assignment.missingOwner,id:p.id+':'+step.key,planId:p.id,name:step.title,productName:p.data.productName,reference:p.data.reference,needBy:step.key.startsWith('search:')?line?.procurement?.nextFollowup||p.data.needBy:p.data.needBy,quote});
  }
  if(!lines.length&&!history)continue;cases.push({id:p.id,reference:p.data.reference,name:p.data.productName,needBy:p.data.needBy,state:p.data.state,procurement:(p.data.lines||[]).filter((l:any)=>l.procurement).map((l:any)=>({partCode:l.partCode,name:l.name,status:l.procurement.status,foundSupplier:!!l.procurement.resolvedAt,notes:l.procurement.notes,nextFollowup:l.procurement.nextFollowup,routes:l.routes}))});
  if(active)for(const l of lines){if(l.shortage<=0||orders.some(o=>o.data.planId===p.id&&o.data.partCode===l.partCode&&!['closed','cancelled'].includes(o.data.state)))continue;
   const assignment=supplyAssignment(p,{role:'domestic'},members,policy),mine=u.isAdmin||!assignment.owner||assignment.owner.id===mid,quoteCount=quotes.filter(q=>q.data.planId===p.id&&q.data.partCode===l.partCode&&q.data.round===l.round).length;needs.push({planId:p.id,reference:p.data.reference,productName:p.data.productName,needBy:p.data.needBy,partCode:l.partCode,name:l.name,unit:l.unit,shortage:l.shortage,round:l.round,quoted:quoteCount>0,quoteCount,quote:mine&&p.data.state==='sourcing'&&!['technical','design'].includes(l.procurement?.status)?{partCode:l.partCode,round:l.round,supplierLinkId:''}:null});
  }
 }
 return Response.json({tasks,needs,cases,quotes:quotes.map(q=>({id:q.id,planId:q.data.planId,partCode:q.data.partCode,supplier:q.data.supplier,round:q.data.round,technical:q.data.technical,financial:q.data.financial,unavailable:q.data.unavailable,validUntil:q.data.validUntil})),orders:orders.map(o=>({id:o.id,planId:o.data.planId,partCode:o.data.partCode,supplier:o.data.supplier,quantity:o.data.quantity,unit:o.data.unit,state:o.data.state,eta:o.data.eta}))},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت کارتابل بازرگانی داخلی ممکن نشد.'},{status:503})}}
