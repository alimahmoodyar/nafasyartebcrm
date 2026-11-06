import {storage} from './storage';
import {tehranDay} from './serials';
import {slotWarehouse} from './warehouse-custody';
export async function countItems(warehouseId:string){
 const db=storage(),[raw,entities,balances,records]=await Promise.all([db.prepare('SELECT * FROM flow_slots WHERE quantity>0 ORDER BY location').all(),db.prepare("SELECT * FROM flow_entities WHERE type IN ('receipt','build')").all(),db.prepare('SELECT * FROM inventory_balances WHERE quantity>0').all(),db.prepare("SELECT id,kind,payload FROM records WHERE kind IN ('batch','device')").all()]);
 const es=entities.results.map((e:any)=>({...e,data:JSON.parse(e.data)})),rs=new Map(records.results.map((r:any)=>[r.id,JSON.parse(r.payload)])),items:any[]=[];
 for(const slot of raw.results as any[]){const receipt=es.find(e=>e.type==='receipt'&&e.id===slot.batch_id);if(slotWarehouse(slot.location,receipt?.data.warehouseId)!==warehouseId)continue;const r=rs.get(slot.batch_id)||{};items.push({key:'raw:'+slot.location,itemId:slot.batch_id,stage:'raw',location:slot.location,partCode:r.partCode||'',name:r.part||r.code||slot.batch_id,code:r.code||slot.batch_id,unit:r.unit||'',quantity:slot.quantity,expected:slot.quantity,actual:null});}
 for(const b of balances.results as any[]){const r=rs.get(b.item_id)||{},receipt=es.find(e=>e.type==='receipt'&&e.id===b.item_id),build=es.find(e=>e.type==='build'&&e.id===b.item_id);if(!(b.warehouse==='quarantine'&&receipt?.data.warehouseId===warehouseId||b.warehouse==='finished'&&build?.data.warehouseId===warehouseId))continue;items.push({key:b.warehouse+':'+b.item_id,itemId:b.item_id,stage:b.warehouse,location:'',partCode:r.partCode||r.productCode||'',name:r.part||r.productName||r.code||b.item_id,code:r.code||b.item_id,unit:r.unit||'دستگاه',quantity:b.quantity,expected:b.quantity,actual:null});}
 return items;
}

/** Policy-authorized generation is idempotent; no stock change or personal account. */
export async function syncInventoryCounts(){
 await syncWorkerCounts();
 const db=storage(),today=tehranDay(),policies=(await db.prepare("SELECT * FROM flow_entities WHERE type='inventory_count_policy' AND json_extract(data,'$.active')=1").all()).results as any[];
 for(const row of policies){const p=JSON.parse(row.data);if(p.nextDay>today)continue;const open=await db.prepare("SELECT id FROM flow_entities WHERE type='inventory_count' AND json_extract(data,'$.warehouseId')=? AND json_extract(data,'$.state')<>'completed' LIMIT 1").bind(p.warehouseId).first();if(open)continue;
  const all=await countItems(p.warehouseId),keys=[...new Set(all.map(i=>i.partCode||i.itemId))].sort();if(!keys.length)continue;let remaining=(p.remaining||[]).filter((k:string)=>keys.includes(k));if(!remaining.length)remaining=keys;
  const urgent=(p.priorityCodes||[]).filter((k:string)=>keys.includes(k)).slice(0,p.itemCount),selected=[...new Set([...urgent,...remaining])].slice(0,p.itemCount),items=all.filter(i=>selected.includes(i.partCode||i.itemId)),now=new Date().toISOString(),id='inventory-count:'+row.id+':'+p.nextDay,op='count-schedule:'+row.id+':'+p.nextDay,after={...p,remaining:remaining.filter((k:string)=>!selected.includes(k)),priorityCodes:[],nextDay:new Date(Date.parse(today)+p.everyDays*86400000).toISOString().slice(0,10)},data={kind:'cycle',warehouseId:p.warehouseId,warehouseName:p.warehouseName,policyId:row.id,state:'counting',items,reservations:[],createdAt:now,due:new Date(Date.now()+p.dueHours*3600000).toISOString(),escalateAt:new Date(Date.now()+p.escalateHours*3600000).toISOString(),history:[{mode:'scheduled',at:now}],financeApproval:null,ceoApproval:null};
  try{await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'inventory_count_schedule','{}','workflow',?,1)").bind(op,now),db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(row.id,row.revision,op),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inventory_count',?,1,?,?)").bind(id,JSON.stringify(data),now,now),db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(after),now,row.id,row.revision)]);}catch(error){const existing=await db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(id).first();if(!existing)throw error;}
 }
}

export async function syncWorkerCounts(){
 const db=storage(),today=tehranDay(),policies=(await db.prepare("SELECT * FROM flow_entities WHERE type='worker_count_policy' AND json_extract(data,'$.active')=1").all()).results as any[];
 for(const row of policies){const p=JSON.parse(row.data);if(p.nextDay>today||await db.prepare("SELECT id FROM flow_entities WHERE type='worker_count_round' AND json_extract(data,'$.positionId')=? AND json_extract(data,'$.state')='counting' LIMIT 1").bind(p.positionId).first())continue;
  const items=(await db.prepare('SELECT item_id AS batchId,quantity FROM inventory_balances WHERE warehouse=? AND quantity>0 ORDER BY item_id').bind('worker:'+p.positionId).all()).results,now=new Date().toISOString(),id='worker-count-round:'+row.id+':'+p.nextDay,op='worker-count-schedule:'+row.id+':'+p.nextDay,nextDay=new Date(Date.parse(today)+p.everyDays*86400000).toISOString().slice(0,10);
  try{await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'worker_count_schedule','{}','workflow',?,1)").bind(op,now),db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(row.id,row.revision,op),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'worker_count_round',?,1,?,?)").bind(id,JSON.stringify({positionId:p.positionId,items,state:items.length?'counting':'completed',due:today,createdAt:now}),now,now),db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify({...p,nextDay}),now,row.id,row.revision)]);}catch(e){if(!await db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(id).first())throw e;}
 }
}

export function countShortageAtLocation(cases:any[],itemId:string,stage:string,location=''){
 return cases.filter(c=>c.type==='inventory_count'&&c.data.state==='review').flatMap(c=>c.data.items||[]).filter(i=>i.itemId===itemId&&i.stage===stage&&(!location||i.location===location)&&Number.isSafeInteger(i.actual)).reduce((n,i)=>n+Math.max(0,i.expected-i.actual),0);
}
