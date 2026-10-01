import {tehranDay} from './serials';
import type {Session} from './permissions';
export const flowRoles=['inventory','qc','production','procurement'] as const;
export const roleNames:Record<string,string>={inventory:'انبار',qc:'کنترل کیفیت',production:'تولید',procurement:'تأمین'};
export function flowRole(u:Session,role:string){return u.isAdmin||u.permissions.flowRoles?.includes(role)||false;}
export const entity=(r:any)=>({...r,data:JSON.parse(r.data)});
export const qty=(n:number)=>String(n/1000);
export function suggestion(material:any,balances:any[],receipts:any[],builds:any[],boms:any[]){
 const ids=new Set(receipts.filter(r=>r.data.materialId===material.id&&(!r.data.expiry||r.data.expiry>=tehranDay())).map(r=>r.data.batchId));
 const total=balances.filter(b=>ids.has(b.item_id)&&['raw','line'].includes(b.warehouse)).reduce((n,b)=>n+b.quantity,0);
 const raw=balances.filter(b=>ids.has(b.item_id)&&b.warehouse==='raw').reduce((n,b)=>n+b.quantity,0);
 const demand=builds.filter(b=>b.data.state==='planned').reduce((n,b)=>{const bom=boms.find(x=>x.id===b.data.bomId);return n+(bom?JSON.parse(bom.lines).filter((l:any)=>l.partCode===material.data.code).reduce((a:number,l:any)=>a+Math.round(Number(l.quantity)*1000),0):0)},0);
 return {raw,total,demand,available:total-demand,low:total-demand<material.data.reorderPoint,proposed:Math.max(0,material.data.targetStock+ demand-total)};
}
