import {AccessError} from './authorization';
import {personnelStaff} from './personnel-profile';

const action='cleanup_test_staff';
const profileType='staff_test_archive';

export async function testStaffWasCleaned(db:D1Database,id:string){
 return !!await db.prepare("SELECT 1 FROM access_audit WHERE target=? AND action=? LIMIT 1").bind(id,action).first();
}

export async function testStaffCleanup(db:D1Database,member:any,subject:string|null,actor:string,now:string){
 if(!personnelStaff({...member,status:'active'}))throw new AccessError('پاک‌سازی آزمایشی فقط برای حساب کارکنان داخلی در دسترس است.',400);
 const references=JSON.stringify([...new Set([member.id,'local:'+member.id,subject].filter(Boolean))]);
 const query=`
 WITH identities(value) AS (SELECT value FROM json_each(?)),
 profiles AS (
   SELECT id FROM flow_entities WHERE type='hr_employee' AND json_extract(data,'$.memberId')=?
 ),
 refs(value) AS (SELECT value FROM identities UNION SELECT id FROM profiles)
 SELECT CASE
   WHEN (SELECT count(*) FROM profiles)>1 THEN 'multiple'
   WHEN EXISTS(
     SELECT 1 FROM flow_entities f
     WHERE f.id NOT IN (SELECT id FROM profiles)
       AND f.type NOT IN ('personnel_code','personnel_code_claim','personnel_code_sequence')
       AND NOT (f.type IN ('member_contact','member_role_assignment') AND json_extract(f.data,'$.memberId')=?)
       AND EXISTS(
         SELECT 1 FROM json_tree(CASE WHEN json_valid(f.data) THEN f.data ELSE '{}' END) j
         WHERE j.atom IN (SELECT value FROM refs) OR j.key IN (SELECT value FROM refs)
       )
   ) OR EXISTS(
     SELECT 1 FROM records r
     WHERE EXISTS(
       SELECT 1 FROM json_tree(CASE WHEN json_valid(r.payload) THEN r.payload ELSE '{}' END) j
       WHERE j.atom IN (SELECT value FROM refs) OR j.key IN (SELECT value FROM refs)
     )
   ) OR EXISTS(SELECT 1 FROM inventory_operations WHERE actor IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM duty_runs WHERE assignee IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM production_orders WHERE actor IN (SELECT value FROM identities) OR operator IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM accounting_journals WHERE actor IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM economic_events WHERE actor IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM quality_reports WHERE created_by IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM service_ledger WHERE actor IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM personal_reminders WHERE owner IN (SELECT value FROM identities) OR json_extract(data,'$.linkId') IN (SELECT id FROM profiles))
   THEN 'used'
   ELSE ''
 END AS blocker`;
 const args=[references,member.id,member.id];
 const result=await db.prepare(query).bind(...args).first<{blocker:string}>();
 if(result?.blocker==='multiple')throw new AccessError('بیش از یک پرونده به این حساب وصل است. ابتدا اتصال پرونده‌ها را بررسی کنید.',409);
 if(result?.blocker)throw new AccessError('این حساب یا پرونده سابقه یا وابستگی دارد و از مسیر پاک‌سازی آزمایشی برداشته نمی‌شود.',409);
 const op=crypto.randomUUID();
 return [
  db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)").bind(op,action,JSON.stringify({memberId:member.id}),actor,now),
  db.prepare(`UPDATE inventory_operations SET guard=CASE WHEN (${query})='' AND EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=? AND status=?) THEN guard ELSE 0 END WHERE id=?`).bind(...args,member.id,member.revision,member.status,op),
  db.prepare("UPDATE flow_entities SET type=?,revision=revision+1,updated=? WHERE type='hr_employee' AND json_extract(data,'$.memberId')=?").bind(profileType,now,member.id),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(op,actor,member.id,action,JSON.stringify({memberId:member.id}),now),
 ];
}
