export const custodyKinds:Record<string,string>={demo:'دستگاه دمو',equipment:'تجهیزات',other:'سایر اقلام',pos:'دستگاه پوز'};
export const custodyConditions:Record<string,string>={good:'سالم',damaged:'آسیب‌دیده',repair:'نیازمند تعمیر'};
export const salesCustodyActions={custody_issue:'ثبت تحویل امانی',custody_recall:'شروع جمع‌آوری امانت‌ها',custody_cancel_recall:'لغو جمع‌آوری امانت‌ها',custody_return:'ثبت دریافت امانت'};
export const isSalesCustody=(row:any)=>row.type==='sales_custody_item'||row.type==='sales_bank_terminal'&&(row.data.handedDay||row.data.active||row.data.returnedDay);
export function heldSalesCustody(rows:any[],agentId:string){
 return rows.filter(row=>isSalesCustody(row)&&row.data.agentId===agentId&&!row.data.returnedDay);
}
export function publicSalesCustody(rows:any[],ids:string[],bankTitles:Map<string,string>){
 const allowed=new Set(ids);
 return rows.filter(row=>isSalesCustody(row)&&allowed.has(row.data.agentId)).map(({id,type,revision,data:d})=>{
  const pos=type==='sales_bank_terminal';
  return {id,type,revision,data:{agentId:d.agentId,kind:pos?'pos':d.kind,name:pos?'دستگاه پوز':d.name,serial:d.serial||'',quantity:pos?1:d.quantity,handedDay:d.handedDay||(pos?d.validFrom:''),issueReference:d.issueReference||'',returnedQuantity:d.returnedQuantity||(d.returnedDay?(pos?1:d.quantity):0),returns:d.returns||[],returnedDay:d.returnedDay||'',returnCondition:d.returnCondition||'',returnReference:d.returnReference||'',...(pos?{terminalCode:d.terminalCode,provider:d.provider,bankName:d.bankName||bankTitles.get(d.accountId)||''}:{})}};
 });
}
