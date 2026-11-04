import {storage} from './storage';
import {AccessError} from './authorization';
import {flowRole,warehouseAccess} from './material-flow';
import {storedAccessPermissions,type Permissions,type Session,type WarehouseResponsibility} from './permissions';
import {receiptQuarantine,receiptPolicyEnabled} from './warehouse-receipt-policy';
export async function materialWarehouses(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type='material_warehouse' ORDER BY created,id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));}
export function warehousePerson(u:Session,owner:string){return u.isAdmin||!!owner&&(u.userId===owner||u.userId==='local:'+owner);}
export function warehouseResponsibilities(member:any,warehouses:any[]):WarehouseResponsibility[]{
 const p:Permissions=typeof member.permissions==='string'?storedAccessPermissions(member.permissions):member.permissions;
 if(p.warehouseResponsibilities!==undefined)return p.warehouseResponsibilities.filter(r=>warehouses.some(w=>w.id===r.warehouseId));
 // Preserve old assignments until that profile is explicitly saved, including an empty selection.
 return warehouses.flatMap(w=>([['qc','qcOwner'],['inventory','warehouseOwner']] as const).filter(([role,key])=>w.data[key]===member.id&&p.flowRoles?.includes(role)).map(([role])=>({warehouseId:w.id,role})));
}
export function warehouseProfilePermissions(member:any,warehouses:any[]){const p:Permissions=typeof member.permissions==='string'?storedAccessPermissions(member.permissions):member.permissions,roles=warehouseResponsibilities(member,warehouses);return {...p,warehouseResponsibilities:roles,...(p.roleAssignment?{roleAssignment:{...p.roleAssignment,warehouseResponsibilities:roles}}:{})};}
export async function warehouseDirectory(warehouses?:any[],members?:any[]){
 const ws=warehouses||await materialWarehouses(),ms=members||(await storage().prepare("SELECT id,name,subject,permissions FROM app_members WHERE status='active'").all()).results as any[];
 const directory=ws.map(w=>({...w,...Object.fromEntries((['qc','inventory'] as const).map(role=>[role+'Members',ms.filter(m=>warehouseResponsibilities(m,ws).some(r=>r.warehouseId===w.id&&r.role===role)).map(m=>({id:m.id,name:m.name,subject:m.subject||''}))]))}));
 // Only a linked internal quarantine area shares its receiving warehouse's staff.
 // Ordinary parent/child warehouses still have independent custody.
 const internal=directory.map(w=>{const parent=directory.find(p=>p.id===w.data.quarantineFor&&w.data.internalQuarantine===true&&w.data.warehouseType==='quarantine'&&w.data.parentId===p.id);if(!parent)return w;return {...w,inventoryMembers:[...new Map([...parent.inventoryMembers,...w.inventoryMembers].map((m:any)=>[m.id,m])).values()],qcMembers:w.qcMembers.length?w.qcMembers:parent.qcMembers};});
 return internal.map(w=>{const q=receiptQuarantine(w,internal);return {...w,receiptQuarantine:q?{id:q.id,name:q.data.name,revision:q.revision,active:true}:null,receiptQcMembers:q?.qcMembers||[]};});
}
export function warehouseMember(u:Session,w:any,role:'inventory'|'qc'){return u.isAdmin||!!w?.[role+'Members']?.some((m:any)=>[m.id,'local:'+m.id,m.subject].filter(Boolean).includes(u.userId));}
export function canReceiveWarehouse(u:Session,w:any){return !!receiptPolicyEnabled(w)&&flowRole(u,'inventory')&&warehouseAccess(u,'quarantine')&&warehouseMember(u,w,'inventory');}
export function receiptQcOwner(receipt:any,w:any){const candidates=w?.qcMembers||[];return candidates.some((m:any)=>m.id===receipt.data.qcOwner)?receipt.data.qcOwner:candidates.length===1?candidates[0].id:'';}
export async function receiptWarehouse(u:Session,warehouseId:any,qcOwner?:unknown){
 const rows=await warehouseDirectory();
 if(!rows.length)throw new AccessError('مدیر باید ابتدا انبار مجاز برای دریافت مستقیم و قرنطینه زیرمجموعه آن را تعریف کند.',400);
 const eligible=rows.filter(w=>w.data.active&&canReceiveWarehouse(u,w)),w=warehouseId?rows.find(w=>w.id===warehouseId):eligible.length===1?eligible[0]:null;
 if(!w||!w.data.active)throw new AccessError('انبار مقصد فعال را انتخاب کنید.',400);
 if(!receiptPolicyEnabled(w))throw new AccessError('ورود مستقیم به این انبار مجاز نیست؛ انبار دریافت دارای قرنطینه فعال را انتخاب کنید. ورود مستقیم به خط تولید ممنوع است.',400);
 if(!canReceiveWarehouse(u,w))throw new AccessError('دریافت در این انبار در مسئولیت شما نیست.',403);
 if(qcOwner!==undefined&&typeof qcOwner!=='string')throw new AccessError('مسئول کیفیت معتبر انتخاب کنید.',400);
 const candidates=w.receiptQcMembers,selected=String(qcOwner||'');if(selected&&!candidates.some((m:any)=>m.id===selected))throw new AccessError('مسئول کنترل کیفیت از افراد فعال قرنطینه همین انبار انتخاب شود.',400);
 if(candidates.length>1&&!selected)throw new AccessError('برای این محموله یکی از مسئولان کنترل کیفیت قرنطینه را انتخاب کنید.',400);
 const owner=selected||candidates[0]?.id||'';
 return {warehouseId:w.id,warehouseRevision:w.revision,quarantineWarehouseId:w.receiptQuarantine.id,quarantineWarehouseRevision:w.receiptQuarantine.revision,quarantineWarehouseName:w.receiptQuarantine.name,receiptPolicyVersion:1,warehouseOwner:w.inventoryMembers.length===1?w.inventoryMembers[0].id:'',qcOwner:owner,qcAssignment:owner?'assigned':'unassigned'};
}
export async function warehouseResponsibilityGuards(permissions:string,op:string){const p=storedAccessPermissions(permissions),db=storage(),statements:D1PreparedStatement[]=[];for(const r of p.warehouseResponsibilities||[]){const w:any=await db.prepare("SELECT revision FROM flow_entities WHERE id=? AND type='material_warehouse'").bind(r.warehouseId).first();if(!w)throw new AccessError('انبار انتخاب‌شده دیگر وجود ندارد؛ فهرست را تازه کنید.',409);statements.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='material_warehouse' AND revision=?) THEN guard ELSE 0 END WHERE id=?").bind(r.warehouseId,w.revision,op));}return statements;}
export const storageLocation=(warehouseId:string,location:string)=>warehouseId?warehouseId+'|'+location:location;
export const displayLocation=(location:string)=>location.includes('|')?location.slice(location.indexOf('|')+1):location;
