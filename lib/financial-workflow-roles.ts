import type {Permissions} from './permissions';
export type FinancialWorkflowRole='treasury'|'manager'|'accountant'|'ceo';
const names:Record<FinancialWorkflowRole,string[]>={treasury:['خزانه دار'],manager:['مدیر مالی'],accountant:['مدیر حسابداری','رئیس حسابداری'],ceo:['مدیر عامل']};
const norm=(s:string)=>s.replace(/[\s\u200c]/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک');
export function financialWorkflowRole(p:Permissions,id:string,rows:any[],role:FinancialWorkflowRole){
 if(p.salesAgentId||p.serviceAgentId||p.hospitalCenterId)return false;
 if(!['read','write'].includes(p.finance||''))return false;
 if(p.treasuryWorkflowRoles?.includes(role))return true;
 return p.finance==='write'&&rows.some(r=>r.type==='position'&&r.data.active&&names[role].some(n=>norm(n)===norm(r.data.name))&&r.data.members?.includes(id));
}
