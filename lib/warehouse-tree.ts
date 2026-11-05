// Hierarchy is reporting structure only; it never grants stock custody or access.
export function warehouseDisplayName(w:any,snapshotName=''){const name=snapshotName||w?.data.name||'انبار ثبت‌شده';return w?.data.deletedAt?name+' (حذف‌شده)':name;}
export function warehouseDescendants(warehouses:any[],id:string){
 const ids=new Set<string>([id]);let changed=true;
 while(changed){changed=false;for(const w of warehouses)if(w.data.parentId&&ids.has(w.data.parentId)&&!ids.has(w.id)){ids.add(w.id);changed=true;}}
 return ids;
}
export function warehousePath(warehouses:any[],id:string){
 const names:string[]=[],seen=new Set<string>();let w=warehouses.find(w=>w.id===id);
 while(w&&!seen.has(w.id)){seen.add(w.id);names.unshift(warehouseDisplayName(w));w=warehouses.find(v=>v.id===w.data.parentId);}
 return names.join(' / ');
}
