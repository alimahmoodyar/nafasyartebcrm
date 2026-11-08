type IssueSlot={location:string;receipt:{created:string;data:{expiry?:string;day?:string}}};
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;

export function compareIssueSlots(a:IssueSlot,b:IssueSlot){
 return compare(a.receipt.data.expiry||'9999',b.receipt.data.expiry||'9999')||
  compare(a.receipt.data.day||'',b.receipt.data.day||'')||
  compare(a.receipt.created,b.receipt.created)||
  compare(a.location,b.location);
}
export function issueAllocationKey(amounts:Record<string,number>){
 return JSON.stringify(Object.entries(amounts).sort(([a],[b])=>compare(a,b)));
}
