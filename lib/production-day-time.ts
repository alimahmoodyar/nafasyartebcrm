// One day limit across custom projects and routine work, checked again inside the write batch.
const totalSql=`(
 (SELECT COALESCE(SUM(CAST(json_extract(t.value,'$.minutes') AS INTEGER)),0)
 FROM flow_entities p,json_each(p.data,'$.times') t
 WHERE p.type='build_project' AND json_extract(t.value,'$.memberId')=? AND json_extract(t.value,'$.day')=?
 AND (json_extract(t.value,'$.voided') IS NULL OR json_extract(t.value,'$.voided')=0))
 + (SELECT COALESCE(SUM(COALESCE(json_extract(j.data,'$.actualMinutes'),0)+COALESCE(json_extract(j.data,'$.overtimeMinutes'),0)),0)
 FROM flow_entities j WHERE j.type='routine_job' AND j.id<>? AND json_extract(j.data,'$.state')='closed'
 AND json_extract(j.data,'$.day')=? AND (json_extract(j.data,'$.memberId')=? OR EXISTS(SELECT 1 FROM json_each(j.data,'$.crew') c WHERE json_extract(c.value,'$.id')=?)))
)`;
const args=(member:string,day:string,exclude:string)=>[member,day,exclude,day,member,member];
export async function productionDayMinutes(db:D1Database,member:string,day:string,excludeRoutine=''){const r:any=await db.prepare('SELECT '+totalSql+' AS minutes').bind(...args(member,day,excludeRoutine)).first();return Number(r?.minutes||0);}
export function productionDayGuard(db:D1Database,operationId:string,member:string,day:string,minutes:number,excludeRoutine=''){return db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+totalSql+'+?<=1440 THEN guard ELSE 0 END WHERE id=?').bind(...args(member,day,excludeRoutine),minutes,operationId);}
