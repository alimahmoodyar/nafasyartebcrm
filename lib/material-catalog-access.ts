/** Catalog editing is distinct from physical inventory, receipt inspection and finance. */
export function materialCatalogEngineer(u:any){
 const p=u.permissions||{};
 return !p.hospitalCenterId&&!p.salesAgentId&&!p.serviceAgentId&&!p.salesRoles?.includes('agent')&&!p.serviceRoles?.includes('agent')&&!!p.supplyRoles?.includes('engineering');
}
export function canEditMaterialCatalog(u:any){
 const p=u.permissions||{},internal=!p.hospitalCenterId&&!p.salesAgentId&&!p.serviceAgentId&&!p.salesRoles?.includes('agent')&&!p.serviceRoles?.includes('agent');
 return u.isAdmin||internal&&(!!p.flowRoles?.includes('inventory')||materialCatalogEngineer(u));
}
