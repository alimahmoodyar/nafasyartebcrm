import {warehouseMember} from './material-warehouses';
import type {Session} from './permissions';

// Slot custody, rather than the original receipt, owns stock after a physical move.
export const slotWarehouse=(location:string,fallback='')=>location.includes('|')?location.slice(0,location.indexOf('|')):fallback;
export function ownsSlot(u:Session,warehouses:any[],location:string,fallback=''){
 const id=slotWarehouse(location,fallback),w=warehouses.find(w=>w.id===id);
 return id?!!w?.data.active&&warehouseMember(u,w,'inventory'):u.isAdmin||!!u.permissions.flowRoles?.includes('inventory');
}
export function internalWarehouseUser(u:Session){const p=u.permissions;return u.isAdmin||!p.hospitalCenterId&&!p.salesAgentId&&!p.serviceAgentId&&!p.qmsRoles?.includes('observer')&&!p.salesRoles?.includes('agent')&&!p.serviceRoles?.includes('agent');}
