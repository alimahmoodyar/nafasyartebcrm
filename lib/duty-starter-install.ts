import {storage} from './storage';
import {dayAt} from './duties';
import {dutyStarter,DUTY_STARTER_VERSION} from './duty-starter';
import {AccessError} from './authorization';
import type {Session} from './permissions';
export const positionProfileFields=['mission','responsibilities','authorityBoundaries','reportingTo','handoffs','metrics'] as const;
export const normalizePosition=(s:string)=>s.replace(/[\s\u200c]+/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک');
/** Explicit write entry points only: admin startup POST or install_starter. Never a read side effect. */
export async function installDutyStarter(user:Session,operationId:string=crypto.randomUUID(),payload='{"mode":"install_starter","source":"admin-startup"}'){
 if(!user.isAdmin)throw new AccessError('تعریف برنامه‌های اولیه فقط برای مدیر مجاز است.',403);
 const db=storage(),markerId='duty_catalog:'+DUTY_STARTER_VERSION;
 const installed=await db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(markerId).first();if(installed)return {saved:true,alreadyInstalled:true};
 const now=new Date().toISOString(),today=dayAt();
 const existing=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('position','duty_template') ORDER BY created,id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const statements:D1PreparedStatement[]=[],mapping:any[]=[];let addedPositions=0,addedTemplates=0;
 const insert=(id:string,type:string,data:any)=>db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(data),now,now);
 for(const p of dutyStarter){
  const old=existing.find(r=>r.type==='position'&&normalizePosition(r.data.name)===normalizePosition(p.name));
  const positionId=old?.id||'starter-position:'+p.key;
  const profile=Object.fromEntries(positionProfileFields.map(k=>[k,p[k]]));
  if(old){ // Fill only missing/blank profile fields; preserve names, assignments, flags and every prior edit.
   const merged={...old.data,...Object.fromEntries(positionProfileFields.map(k=>[k,typeof old.data[k]==='string'&&old.data[k].trim()?old.data[k]:p[k]]))};if(JSON.stringify(merged)!==JSON.stringify(old.data)){
    statements.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN 1 ELSE 0 END WHERE id=?').bind(old.id,old.revision,operationId));
    statements.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(merged),now,old.id,old.revision));
   }
  }else{statements.push(insert(positionId,'position',{name:p.name,unit:p.unit,...profile,members:[],supervisor:'',active:true,starterVersion:DUTY_STARTER_VERSION}));addedPositions++;}
  for(const t of p.tasks){
   if(existing.some(r=>r.type==='duty_template'&&r.data.positionId===positionId&&normalizePosition(r.data.title)===normalizePosition(t.title)))continue;
   statements.push(insert('starter-duty:'+p.key+':'+t.key,'duty_template',{positionId,title:t.title,instructions:t.instructions,cadence:t.cadence,evidence:t.evidence,startDate:today,time:'16:00',weekdays:[6,0,1,2,3,4],weekday:4,monthDay:5,remindHours:24,escalateHours:24,sourceSection:p.sourceSection,active:false,starterVersion:DUTY_STARTER_VERSION}));addedTemplates++;
  }
  mapping.push({key:p.key,positionId});
 }
 const summary={version:DUTY_STARTER_VERSION,addedPositions,addedTemplates,mapping,installedAt:now,actor:user.userId};
 try{await db.batch([
  db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(operationId,'duty_install_starter',payload,user.userId,now),
  insert(markerId,'duty_catalog_install',summary),...statements,
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,markerId,'duty_install_starter',JSON.stringify(summary),now)
 ]);}catch(e){ // Concurrent bootstrap is safe: marker and all definitions commit atomically.
  if(await db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(markerId).first())return {saved:true,alreadyInstalled:true};throw e;
 }
 return {saved:true,addedPositions,addedTemplates};
}
