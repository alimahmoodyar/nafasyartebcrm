// Finance read/write is retained for stored-account compatibility, never as a domain grant.
export type FinancialDomain='costing'|'control'|'purchase'|'treasury'|'guarantees'|'hospital'|'transport';
export function financialAccess(u:any,domain:FinancialDomain,write=false){
 const p=u.permissions||{};
 if(p.salesAgentId||p.serviceAgentId||p.hospitalCenterId||p.salesRoles?.includes('agent')||p.serviceRoles?.includes('agent'))return false;
 if(u.isAdmin)return true;
 const roles:string[]=p.roleAssignment?.roles||[];
 const has=(ids:string[])=>roles.some(r=>ids.includes(r));
 if(domain==='treasury')return !write&&(!!p.treasuryWorkflowRoles?.length||!!p.supplyRoles?.includes('finance'));
 if(domain==='guarantees')return !write&&!!p.treasuryWorkflowRoles?.some((r:string)=>['treasury','manager'].includes(r));
 if(domain==='purchase')return !!p.supplyRoles?.includes('finance');
 if(domain==='hospital')return !!p.serviceRoles?.includes('finance')&&!!p.serviceDomains?.includes('hospital');
 if(!p.roleAssignment)return p.financialRead?.includes(domain)===true&&(!write||p.financialWrite?.includes(domain)===true);
 if(domain==='transport')return has(['finance','finance_director']);
 if(domain==='control')return has(['finance','finance_director','accounting_head']);
 return has(write?['finance']:['finance','finance_director','accounting_head','warehouse_finance']);
}
