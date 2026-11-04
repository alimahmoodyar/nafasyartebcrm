import {requireAccess,accessResponse} from '@/lib/authorization';
import {needSupply,supplyEntities,coverage} from '@/lib/sourcing';
export async function GET(){try{
 const u=await requireAccess();needSupply(u,'domestic');
 const plans=await supplyEntities('sourcing_plan'),quotes=(await supplyEntities('sourcing_quote')).filter(q=>q.data.route==='domestic'),orders=(await supplyEntities('purchase_order')).filter(o=>o.data.route==='domestic');
 const needs:any[]=[],cases:any[]=[];
 for(const p of plans){const history=quotes.some(q=>q.data.planId===p.id)||orders.some(o=>o.data.planId===p.id);const active=['sourcing','ready'].includes(p.data.state);if(!active&&!history)continue;
  const lines=(await coverage(p)).filter(l=>l.routes?.includes('domestic'));
  if(!lines.length&&!history)continue;cases.push({id:p.id,reference:p.data.reference,name:p.data.productName,needBy:p.data.needBy,state:p.data.state});
  if(active)for(const l of lines){if(l.shortage<=0||orders.some(o=>o.data.planId===p.id&&o.data.partCode===l.partCode&&!['closed','cancelled'].includes(o.data.state)))continue;
   needs.push({planId:p.id,reference:p.data.reference,productName:p.data.productName,needBy:p.data.needBy,partCode:l.partCode,name:l.name,unit:l.unit,shortage:l.shortage,round:l.round,quoted:quotes.some(q=>q.data.planId===p.id&&q.data.partCode===l.partCode&&q.data.round===l.round)});
  }
 }
 return Response.json({needs,cases,quotes:quotes.map(q=>({id:q.id,planId:q.data.planId,partCode:q.data.partCode,supplier:q.data.supplier,round:q.data.round,technical:q.data.technical,financial:q.data.financial,unavailable:q.data.unavailable,validUntil:q.data.validUntil})),orders:orders.map(o=>({id:o.id,planId:o.data.planId,partCode:o.data.partCode,supplier:o.data.supplier,quantity:o.data.quantity,unit:o.data.unit,state:o.data.state,eta:o.data.eta}))},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت کارتابل بازرگانی داخلی ممکن نشد.'},{status:503})}}
