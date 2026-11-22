import {AccessError} from './authorization';
import {personnelStaff} from './personnel-profile';
import {trainingContext} from './training-context';

const action='cleanup_test_staff';
const profileType='staff_test_archive';
const optionalChecks={
 accounting_journals:"actor IN (SELECT value FROM identities) OR reviewer IN (SELECT value FROM identities)",
 economic_events:"actor IN (SELECT value FROM identities)",
 personal_reminders:"owner IN (SELECT value FROM identities) OR CASE WHEN json_valid(data) THEN json_extract(data,'$.linkId') IN (SELECT id FROM profiles) ELSE EXISTS(SELECT 1 FROM refs WHERE instr(data,refs.value)>0) END",
} as const;
const optionalTables=Object.keys(optionalChecks) as (keyof typeof optionalChecks)[];
const installedModules="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('"+optionalTables.join("','")+"')";
const memberIdFrom=(column:string)=>`CASE WHEN json_valid(${column}) THEN json_extract(${column},'$.memberId') END`;
function mentionsReference(column:string){
 return `CASE WHEN json_valid(${column}) THEN EXISTS(
   SELECT 1 FROM json_tree(${column}) j
   WHERE (j.type='text' AND j.value IN (SELECT value FROM refs)) OR j.key IN (SELECT value FROM refs)
 ) ELSE EXISTS(SELECT 1 FROM refs WHERE instr(${column},refs.value)>0) END`;
}

export async function testStaffWasCleaned(db:D1Database,id:string){
 return !!await db.prepare("SELECT 1 FROM access_audit WHERE target=? AND action=? LIMIT 1").bind(id,action).first();
}

export async function testStaffCleanup(db:D1Database,member:any,subject:string|null,actor:string,now:string){
 if(trainingContext.getStore())throw new AccessError('پاک‌سازی حساب‌های قدیمی فقط در محیط اصلی در دسترس است.',403);
 if(!personnelStaff({...member,status:'active'}))throw new AccessError('پاک‌سازی آزمایشی فقط برای حساب کارکنان داخلی در دسترس است.',400);
 const references=JSON.stringify([...new Set([member.id,'local:'+member.id,subject].filter(Boolean))]);
 const installed=new Set((await db.prepare(installedModules).all<{name:string}>()).results.map(row=>row.name));
 const moduleChecks=optionalTables.filter(table=>installed.has(table)).map(table=>`OR EXISTS(SELECT 1 FROM ${table} WHERE ${optionalChecks[table]})`).join('\n');
 const query=`
 WITH identities(value) AS (SELECT value FROM json_each(?)),
 profiles AS (
   SELECT id FROM flow_entities WHERE type='hr_employee' AND ${memberIdFrom('data')}=?
 ),
 refs(value) AS (SELECT value FROM identities UNION SELECT id FROM profiles)
 SELECT CASE
   WHEN (SELECT count(*) FROM profiles)>1 THEN 'multiple'
   WHEN EXISTS(
     SELECT 1 FROM flow_entities f
     WHERE f.id NOT IN (SELECT id FROM profiles)
       AND f.type NOT IN ('personnel_code','personnel_code_claim','personnel_code_sequence')
       AND NOT (f.type IN ('member_contact','member_role_assignment') AND coalesce(${memberIdFrom('f.data')},'')=?)
       AND ${mentionsReference('f.data')}
   ) OR EXISTS(
     SELECT 1 FROM records r
     WHERE ${mentionsReference('r.payload')}
   ) OR EXISTS(SELECT 1 FROM inventory_operations WHERE actor IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM duty_runs WHERE assignee IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM production_orders WHERE actor IN (SELECT value FROM identities) OR operator IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM quality_reports WHERE created_by IN (SELECT value FROM identities))
     OR EXISTS(SELECT 1 FROM service_ledger WHERE actor IN (SELECT value FROM identities))
     ${moduleChecks}
   THEN 'used'
   ELSE ''
 END AS blocker`;
 const args=[references,member.id,member.id];
 const result=await db.prepare(query).bind(...args).first<{blocker:string}>();
 if(!result)throw new Error('Staff cleanup dependency check returned no result');
 if(result?.blocker==='multiple')throw new AccessError('بیش از یک پرونده به این حساب وصل است. ابتدا اتصال پرونده‌ها را بررسی کنید.',409);
 if(result?.blocker)throw new AccessError('این حساب یا پرونده سابقه یا وابستگی دارد و از مسیر پاک‌سازی آزمایشی برداشته نمی‌شود.',409);
 const op=crypto.randomUUID();
 return [
  db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)").bind(op,action,JSON.stringify({memberId:member.id}),actor,now),
  db.prepare(`UPDATE inventory_operations SET guard=CASE WHEN (${query})='' AND NOT EXISTS(SELECT name FROM (${installedModules}) EXCEPT SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=? AND status=?) THEN guard ELSE 0 END WHERE id=?`).bind(...args,JSON.stringify([...installed]),member.id,member.revision,member.status,op),
  db.prepare(`UPDATE flow_entities SET type=?,revision=revision+1,updated=? WHERE type='hr_employee' AND ${memberIdFrom('data')}=?`).bind(profileType,now,member.id),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(op,actor,member.id,action,JSON.stringify({memberId:member.id}),now),
 ];
}
