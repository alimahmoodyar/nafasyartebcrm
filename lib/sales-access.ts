import type {Session} from './permissions';
export const salesRep=(u:Session)=>!!u.permissions.salesAgentId;
export const salesManager=(u:Session)=>u.isAdmin||!salesRep(u)&&!!u.permissions.salesRoles?.includes('manager');
export const salesStaff=(u:Session)=>salesManager(u)||!salesRep(u)&&(!!u.permissions.salesRoles?.includes('staff')||!!u.permissions.flowRoles?.includes('sales'));
export const salesFinance=(u:Session)=>u.isAdmin||!salesRep(u)&&(u.permissions.finance==='write'||!!u.permissions.salesRoles?.includes('finance'));
export const salesRead=(u:Session)=>salesRep(u)||salesStaff(u)||salesFinance(u)||u.permissions.finance==='read'||!!u.permissions.salesRoles?.includes('viewer');
export const salesWarehouse=(u:Session)=>u.isAdmin||!salesRep(u)&&!!u.permissions.flowRoles?.includes('inventory')&&(!u.permissions.warehouses||u.permissions.warehouses.includes('quarantine'));
