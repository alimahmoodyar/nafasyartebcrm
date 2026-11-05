export function domesticQuoteDraft(detail:any,request:{planId:string;partCode:string;round:number;supplierLinkId:string}){
 const p=detail.plan,line=detail.lines?.find((l:any)=>l.partCode===request.partCode);
 if(p?.id!==request.planId||p.data.state!=='sourcing'||!detail.roles?.includes('domestic')||!line?.routes?.includes('domestic')||line.shortage<=0||['technical','design'].includes(line.procurement?.status)||line.round!==request.round)throw Error('این کار تغییر کرده یا دیگر قابل استعلام نیست؛ کارتابل را دوباره بررسی کنید.');
 const target=request.supplierLinkId?(p.data.supplierTargets||[]).find((t:any)=>t.linkId===request.supplierLinkId&&t.partCode===line.partCode&&t.route==='domestic'&&t.round===line.round&&!t.missing):null;
 if(request.supplierLinkId&&!target)throw Error('منبع استعلام تغییر کرده؛ کارتابل را دوباره بررسی کنید.');
 return {planId:p.id,revision:p.revision,partCode:line.partCode,route:'domestic',specs:line.specs||'',supplierLinkId:target?.linkId||'',supplier:target?.name||'',eta:'',validUntil:'',needBy:p.data.needBy};
}
