import {storage} from './storage';
import {materialQualityFields} from './quality';
import type {Session} from './permissions';
/** Repair only missing-template waiting receipts from their EXACT existing master.
 * Never match names, reinterpret a product template, approve QC or move stock. */
export async function syncReceiptTemplates(actor:Session){
 const p=actor.permissions;if(p.hospitalCenterId||p.salesAgentId||p.serviceAgentId||!actor.isAdmin&&!p.flowRoles?.some(r=>['inventory','qc','production','procurement'].includes(r))&&!p.warehouseResponsibilities?.length&&!p.supplyRoles?.includes('engineering'))return {activated:[] as string[],needsTaskSync:false};
 const db=storage(),control:any=await db.prepare('SELECT phase FROM reset_control WHERE id=1').first();if(control?.phase==='maintenance')return {activated:[] as string[],needsTaskSync:false};
 const candidates=(await db.prepare("SELECT r.id,r.data,r.revision,m.id material_id,m.data material_data,m.revision material_revision FROM flow_entities r JOIN flow_entities m ON m.id=json_extract(r.data,'$.materialId') AND m.type='material' WHERE r.type='receipt' AND json_extract(r.data,'$.state')='awaiting_qc_template' AND json_extract(r.data,'$.qc') IS NULL AND json_extract(r.data,'$.qcStartedAt') IS NULL AND json_array_length(m.data,'$.fields')>0 AND EXISTS(SELECT 1 FROM inventory_balances i WHERE i.item_id=r.id AND i.warehouse='quarantine' AND i.quantity=json_extract(r.data,'$.quantity')) AND NOT EXISTS(SELECT 1 FROM inventory_balances i WHERE i.item_id=r.id AND i.warehouse<>'quarantine' AND i.quantity<>0) AND NOT EXISTS(SELECT 1 FROM flow_slots s WHERE s.batch_id=r.id AND s.quantity>0)").all()).results as any[],activated:string[]=[];
 for(const r of candidates){const d=JSON.parse(r.data),m=JSON.parse(r.material_data);let fields;try{fields=materialQualityFields(m.fields.map((f:any)=>({...f,unit:f.unit??'',min:f.min??'',max:f.max??'',textGuide:f.textGuide??''})));}catch{continue;}const id='template-activation:'+r.id+':'+r.material_revision,prior=await db.prepare('SELECT id FROM inventory_operations WHERE id=?').bind(id).first();if(prior)continue;
 const at=new Date().toISOString(),data={...d,fields,materialRevision:r.material_revision,state:'pending_qc',templateActivatedBy:actor.userId,templateActivatedAt:at,templateActivationSource:'exact_material_master'},payload=JSON.stringify({receiptId:r.id,materialId:r.material_id,materialRevision:r.material_revision});
 try{await db.batch([
 db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'receipt_template_activation',?,?,?,1)").bind(id,payload,actor.userId,at),
 db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND json_extract(data,'$.state')='awaiting_qc_template' AND json_extract(data,'$.qc') IS NULL AND json_extract(data,'$.qcStartedAt') IS NULL) AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse='quarantine' AND quantity=?) AND NOT EXISTS(SELECT 1 FROM inventory_balances WHERE item_id=? AND warehouse<>'quarantine' AND quantity<>0) AND NOT EXISTS(SELECT 1 FROM flow_slots WHERE batch_id=? AND quantity>0) THEN 1 ELSE 0 END WHERE id=?").bind(r.id,r.revision,r.material_id,r.material_revision,r.id,d.quantity,r.id,r.id,id),
 db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),at,r.id,r.revision),
 db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,r.id,'receipt_template_activated',payload,at)
 ]);activated.push(r.id);}catch(e){if(!/constraint|RESET_MAINTENANCE|RESET_FREEZE/i.test(String(e)))throw e;}
 }
 const pending=await db.prepare("SELECT id FROM flow_entities WHERE type='receipt' AND json_extract(data,'$.templateActivationSource')='exact_material_master' AND json_extract(data,'$.state')='pending_qc' LIMIT 1").first();
 return {activated,needsTaskSync:activated.length>0||!!pending};
}
