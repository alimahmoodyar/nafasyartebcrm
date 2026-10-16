import {storage} from './storage';
import {AccessError} from './authorization';
import {flowRole,warehouseAccess} from './material-flow';
import type {Session} from './permissions';
export async function materialWarehouses(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type='material_warehouse' ORDER BY created,id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));}
export function warehousePerson(u:Session,owner:string){return u.isAdmin||!!owner&&(u.userId===owner||u.userId==='local:'+owner);}
export function canReceiveWarehouse(u:Session,w:any){return flowRole(u,'inventory')&&warehouseAccess(u,'quarantine')&&warehousePerson(u,w.data.warehouseOwner);}
export async function receiptWarehouse(u:Session,warehouseId:any){
 const rows=await materialWarehouses();
 // Pre-existing integrations without a configured physical warehouse remain unassigned;
 // no owner or location is taken from the material master.
 if(!warehouseId&&!rows.length)return {warehouseId:'',warehouseRevision:0,warehouseOwner:'',qcOwner:''};
 const eligible=rows.filter(w=>w.data.active&&canReceiveWarehouse(u,w)),w=warehouseId?rows.find(w=>w.id===warehouseId):eligible.length===1?eligible[0]:null;
 if(!w||!w.data.active)throw new AccessError('انبار مقصد فعال را انتخاب کنید.',400);
 if(!canReceiveWarehouse(u,w))throw new AccessError('دریافت در این انبار در مسئولیت شما نیست.',403);
 return {warehouseId:w.id,warehouseRevision:w.revision,warehouseOwner:w.data.warehouseOwner,qcOwner:w.data.qcOwner};
}
export const storageLocation=(warehouseId:string,location:string)=>warehouseId?warehouseId+'|'+location:location;
export const displayLocation=(location:string)=>location.includes('|')?location.slice(location.indexOf('|')+1):location;
