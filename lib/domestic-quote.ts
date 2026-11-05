export function sourcingQuoteDraft(detail:any,request:{planId:string;partCode:string;round:number;route:string;supplierLinkId?:string}){
 const p=detail.plan,line=detail.lines?.find((l:any)=>l.partCode===request.partCode);
 if(!['domestic','foreign'].includes(request.route)||p?.id!==request.planId||p.data.state!=='sourcing'||!detail.roles?.includes(request.route)||!line?.routes?.includes(request.route)||line.shortage<=0||['technical','design'].includes(line.procurement?.status)||line.round!==request.round||(detail.orders||[]).some((o:any)=>o.data.partCode===request.partCode&&!['closed','cancelled'].includes(o.data.state)))throw Error('این کار تغییر کرده یا دیگر قابل استعلام نیست؛ کارتابل را دوباره بررسی کنید.');
 const target=request.supplierLinkId?(p.data.supplierTargets||[]).find((t:any)=>t.linkId===request.supplierLinkId&&t.partCode===line.partCode&&t.route===request.route&&t.round===line.round&&!t.missing):null;
 if(request.supplierLinkId&&!target)throw Error('منبع استعلام تغییر کرده؛ کارتابل را دوباره بررسی کنید.');
 const answered=target&&(detail.quotes||[]).some((q:any)=>q.data.partCode===line.partCode&&q.data.round===line.round&&q.data.route===request.route&&q.data.supplierLinkId===target.linkId);
 return {planId:p.id,revision:p.revision,partCode:line.partCode,route:request.route,specs:line.specs||'',supplierLinkId:!answered&&target?.linkId||'',supplier:!answered&&target?.name||'',deliveryDays:'',deliveryStart:'confirmation',eta:'',validUntil:'',needBy:p.data.needBy};
}
export function domesticQuoteDraft(detail:any,request:{planId:string;partCode:string;round:number;supplierLinkId:string}){return sourcingQuoteDraft(detail,{...request,route:'domestic'});}
