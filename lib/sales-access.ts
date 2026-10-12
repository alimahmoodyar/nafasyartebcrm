import {accessPermissions} from './permissions';
import type {Session} from './permissions';
export const salesRep=(u:Session)=>!!accessPermissions(u.permissions).salesAgentId;
export const salesManager=(u:Session)=>u.isAdmin||!salesRep(u)&&!!accessPermissions(u.permissions).salesRoles?.includes('manager');
export const salesStaff=(u:Session)=>salesManager(u)||!salesRep(u)&&(!!accessPermissions(u.permissions).salesRoles?.includes('staff')||!!accessPermissions(u.permissions).flowRoles?.includes('sales'));
// Financial access is not a proxy for sales access. Treasury and purchasing
// finance roles must not inherit the sales pipeline or its reports.
export const salesFinance=(u:Session)=>u.isAdmin||!salesRep(u)&&!!accessPermissions(u.permissions).salesRoles?.includes('finance');
export const salesRead=(u:Session)=>salesRep(u)||salesStaff(u)||salesFinance(u)||!!accessPermissions(u.permissions).salesRoles?.includes('viewer');
export const salesWarehouse=(u:Session)=>u.isAdmin||!salesRep(u)&&!!accessPermissions(u.permissions).flowRoles?.includes('inventory')&&(!accessPermissions(u.permissions).warehouses||accessPermissions(u.permissions).warehouses?.includes('quarantine'));
