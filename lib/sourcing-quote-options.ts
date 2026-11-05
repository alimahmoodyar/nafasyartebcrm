import {buildSupplierTargets,checkPurchaseTechnical,checkSupplierPurchase} from './suppliers';
import {AccessError} from './authorization';
// Only registered supplier/material identities; no prices or cross-route data.
export async function quoteSupplierChoices(plan:any,lines:any[],canRoute:(route:string)=>boolean){
 const candidates=await buildSupplierTargets(lines.filter(l=>l.shortage>0&&!['technical','design'].includes(l.procurement?.status)).map(l=>({...l,routes:(l.routes||[]).filter(canRoute)})));
 return candidates.filter(t=>!t.missing).map(t=>({...t,inRound:(plan.data.supplierTargets||[]).some((s:any)=>s.linkId===t.linkId&&s.partCode===t.partCode&&s.round===t.round&&s.route===t.route)}));
}
export async function assessSourcingQuotes(lines:any[],quotes:any[]){
 for(const q of quotes)if(!q.data.unavailable){try{const l=lines.find(l=>l.partCode===q.data.partCode);if(!l)throw new AccessError('کالا در نیاز جاری نیست.',409);await checkPurchaseTechnical(l.materialId,q.data.supplierLinkId||'',{specs:l.specs,designVersion:l.designVersion});if(q.data.supplierLinkId)await checkSupplierPurchase(q.data.supplierLinkId,l.materialId,q.data.route,q.data.quantity);q.data.supplierBlock='';}catch(e){q.data.supplierBlock=e instanceof AccessError?e.message:'صلاحیت قابل بررسی نیست';}}
 return quotes;
}
