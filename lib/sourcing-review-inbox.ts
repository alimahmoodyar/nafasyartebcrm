import {storage} from './storage';
import {memberId} from './duties';
import {hasSupply,needSupply,supplyEntities,nextWork,coverage} from './sourcing';
import {supplyAssignment} from './sourcing-workflow';
import {replenishmentPolicy} from './replenishment';
import type {SourcingReviewWorkspace} from './sourcing-review-contract';

/** Module inboxes expose decision inputs, never the full sourcing case. */
export async function sourcingReviewInbox(u:any,plans:any[],workspace:SourcingReviewWorkspace,planId=''){
 needSupply(u,workspace);
 const [quotes,orders,staff,policy,mid]=await Promise.all([supplyEntities('sourcing_quote'),supplyEntities('purchase_order'),storage().prepare("SELECT * FROM app_members WHERE status='active'").all(),replenishmentPolicy(),memberId(u)]);
 const items:any[]=[],members=staff.results as any[],canAssign=u.isAdmin||hasSupply(u,'ceo')||hasSupply(u,'commerce_manager'),files=workspace==='finance'?await supplyEntities('sourcing_quote_attachment'):[];
 for(const p of plans.filter(p=>!planId||p.id===planId)){
  const pq=quotes.filter(q=>q.data.planId===p.id),po=orders.filter(o=>o.data.planId===p.id),lines=await coverage(p);
  for(const step of nextWork(p,pq,po,lines).filter(s=>s.role===workspace)){
   const assignment=supplyAssignment(p,step,members,policy.data),explicit=p.data.workOwners?.[workspace];
   const canAct=u.isAdmin||assignment.owner?.id===mid||!explicit&&!assignment.owner&&assignment.candidates.some(m=>m.id===mid);
   // An assigned colleague's work is not another employee's approval queue.
   if(!canAct&&!canAssign)continue;
   const base={planId:p.id,planRevision:p.revision,taskKey:step.key,taskTitle:step.title,productName:p.data.productName,needBy:p.data.needBy,ownerName:assignment.owner?.name||'',ownerId:assignment.owner?.id||'',canAct,canClaim:!assignment.owner&&assignment.candidates.some(m=>m.id===mid),candidates:canAssign?assignment.candidates:[],role:workspace};
   if(step.key.startsWith('technical:')||step.key.startsWith('financial:')){
    const line=lines.find(l=>step.key===(workspace==='engineering'?'technical:':'financial:')+l.partCode+':'+l.round);if(!line)continue;
    for(const q of pq.filter(q=>q.data.partCode===line.partCode&&q.data.round===line.round&&!q.data.unavailable&&(workspace==='engineering'?q.data.technical==='pending':q.data.technical==='pass'&&q.data.financial!=='pass'))){
     const d=q.data;
     items.push({...base,id:q.id,mode:workspace==='engineering'?'technical':'financial_review',quoteId:q.id,quoteRevision:q.revision,partCode:line.partCode,materialName:line.name,unit:line.unit,quantity:d.quantity,supplier:d.supplier,route:d.route,round:d.round,specs:d.specs||'',requiredSpecs:line.specs||'',technical:d.technical,technicalNote:d.technicalNote||'',...(workspace==='finance'?{unitPrice:d.unitPrice,currency:d.currency,extrasRial:d.extrasRial,totalRial:d.totalRial,freight:d.freight,paymentTerms:d.paymentTerms,deliveryDays:d.deliveryDays,eta:d.eta,validUntil:d.validUntil,financial:d.financial,financialNote:d.financialNote||'',files:files.filter(f=>f.data.state==='attached'&&f.data.quoteId===q.id).map(f=>({id:f.id,filename:f.data.filename}))}:{})});
    }
   }else if(workspace==='finance'&&step.key==='budget')items.push({...base,id:p.id+':budget',mode:'finance',finance:p.data.finance});
   else if(workspace==='finance'){
    const order=po.find(o=>step.key==='po:'+o.id&&o.data.state==='awaiting_funding');
    if(order)items.push({...base,id:order.id,mode:'issue_order',orderId:order.id,supplier:order.data.supplier,totalRial:order.data.totalRial,quantity:order.data.quantity,unit:order.data.unit,partCode:order.data.partCode,finance:p.data.finance});
   }else items.push({...base,id:p.id+':'+step.key,mode:''});
  }
 }
 return {workspace,canAssign,items,count:items.length};
}
