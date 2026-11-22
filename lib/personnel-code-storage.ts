import {storage} from './storage';
import {AccessError} from './authorization';
import {automaticLegacyPersonnelCode,personnelCodeKey} from './personnel-code';

const sequenceId='personnel-code-sequence:v1',recordId=(id:string)=>'personnel-code:'+id,claimId=(key:string)=>'personnel-code-claim:'+encodeURIComponent(key);
const fail=(message:string):never=>{throw new AccessError(message,409)};
const decode=(r:any)=>r?{...r,data:JSON.parse(r.data)}:null;
// SQLite's numeric comparison also reserves Persian/Arabic digits and leading zeros.
let normalized="trim(CAST(json_extract(data,'$.code') AS TEXT))";
for(const alphabet of ['۰۱۲۳۴۵۶۷۸۹','٠١٢٣٤٥٦٧٨٩'])for(let i=0;i<10;i++)normalized="replace("+normalized+",'"+alphabet[i]+"','"+i+"')";
const sameCode=(key:string)=>/^\d+$/.test(key)?normalized+"<>'' AND "+normalized+" NOT GLOB '*[^0-9]*' AND ltrim("+normalized+",'0')=?":"upper("+normalized+")=?";
const compareCode=(key:string)=>/^\d+$/.test(key)?key.replace(/^0+/, ''):key;
const identitySql="SELECT json_group_array(json_object('id',id,'revision',revision,'code',CASE WHEN json_valid(data) THEN json_extract(data,'$.code') ELSE '@invalid' END)) value FROM (SELECT id,data,revision FROM flow_entities WHERE type IN ('hr_employee','hr_link_archive','staff_test_archive') ORDER BY id)";
async function identitySnapshot(db:D1Database){return (await db.prepare(identitySql).first<any>()).value;}
export function personnelIdentityGuard(db:D1Database,op:string,snapshot:string){return db.prepare('UPDATE inventory_operations SET guard=CASE WHEN ('+identitySql+')=? THEN guard ELSE 0 END WHERE id=?').bind(snapshot,op);}


/** All reservations and the owning HR mutation must execute in one D1 batch. */
export async function personnelCodePlan(db:D1Database,changes:any[],op:string,actor:string){
 const employees=changes.filter(r=>r.type==='hr_employee'&&(typeof r.data.code==='string'&&r.data.code.trim()||r.data.code===''));
 if(!employees.length)return {statements:[] as D1PreparedStatement[],assigned:[] as any[]};
 const now=new Date().toISOString(),sequence=decode(await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='personnel_code_sequence'").bind(sequenceId).first()),snapshot=await identitySnapshot(db);
 let next=sequence?.data.next??1001;if(!Number.isSafeInteger(next)||next<1001||next>999999999)fail('شمارنده کد پرسنلی نیازمند بررسی است.');
 const statements:D1PreparedStatement[]=[],assigned:any[]=[],localKeys=new Set<string>();
 for(const employee of employees){
  const existing=decode(await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='personnel_code'").bind(recordId(employee.id)).first());
  if(existing){if(existing.data.employeeId!==employee.id||!personnelCodeKey(existing.data.code))fail('رزرو کد پرسنلی معتبر نیست.');const claim=decode(await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='personnel_code_claim'").bind(claimId(personnelCodeKey(existing.data.code))).first());if(claim?.data.employeeId!==employee.id)fail('رزرو کد پرسنلی نیازمند بررسی است.');employee.data={...employee.data,code:existing.data.code};continue;}
  const original=String(employee.data.code||''),automatic=!original||automaticLegacyPersonnelCode(original);let code=original,key=automatic?'':personnelCodeKey(original);
  const occupied=async(k:string)=>{
   if(localKeys.has(k))return true;
   const claim=decode(await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='personnel_code_claim'").bind(claimId(k)).first());
   if(claim)return true;
   return !!await db.prepare("SELECT id FROM flow_entities WHERE type IN ('hr_employee','hr_link_archive','staff_test_archive') AND id<>? AND "+sameCode(k)+" LIMIT 1").bind(employee.id,compareCode(k)).first();
  };
  if(automatic){
   const claimKey="json_extract(data,'$.key')";
   const allocation=await db.prepare("WITH occupied(value) AS (SELECT CAST("+claimKey+" AS INTEGER) FROM flow_entities WHERE type='personnel_code_claim' AND "+claimKey+"<>'' AND "+claimKey+" NOT GLOB '*[^0-9]*' UNION SELECT CAST("+normalized+" AS INTEGER) FROM flow_entities WHERE type IN ('hr_employee','hr_link_archive','staff_test_archive') AND json_valid(data) AND "+normalized+"<>'' AND "+normalized+" NOT GLOB '*[^0-9]*'),candidates(value) AS (SELECT ? UNION SELECT value+1 FROM occupied WHERE value>=? AND value<999999999) SELECT MIN(c.value) n FROM candidates c WHERE c.value BETWEEN ? AND 999999999 AND NOT EXISTS(SELECT 1 FROM occupied o WHERE o.value=c.value)").bind(next,next,next).first<any>();
   if(!Number.isSafeInteger(allocation?.n)||allocation.n<next||allocation.n>999999999)fail('تخصیص شماره بعدی نیازمند بررسی است.');
   code=String(allocation.n);key=code;if(localKeys.has(key))fail('کد پرسنلی تکراری است؛ تخصیص دوباره بررسی شود.');next=allocation.n+1;
  }
  else if(!key||await occupied(key))fail('کد پرسنلی «'+original+'» تکراری است؛ کدهای قبلی تا بررسی تغییر نمی‌کنند.');
  localKeys.add(key);
  const data={employeeId:employee.id,code,originalCode:original,automatic,assignedAt:now,assignedBy:actor};
  statements.push(db.prepare("UPDATE inventory_operations SET guard=CASE WHEN "+(employee.revision?"EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)":"NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?)")+" THEN guard ELSE 0 END WHERE id=?").bind(employee.id,...(employee.revision?[employee.revision]:[]),op),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'personnel_code',?,1,?,?)").bind(recordId(employee.id),JSON.stringify(data),now,now),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'personnel_code_claim',?,1,?,?)").bind(claimId(key),JSON.stringify({employeeId:employee.id,code,key,assignedAt:now}),now,now));
  assigned.push(data);employee.data={...employee.data,code};
 }
 if(!assigned.length)return {statements:[],assigned};
 statements.unshift(personnelIdentityGuard(db,op,snapshot),db.prepare("UPDATE inventory_operations SET guard=CASE WHEN COALESCE((SELECT revision FROM flow_entities WHERE id=?),0)=? THEN guard ELSE 0 END WHERE id=?").bind(sequenceId,sequence?.revision||0,op));
 const data=JSON.stringify({next});statements.push(sequence?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(data,now,sequenceId,sequence.revision):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'personnel_code_sequence',?,1,?,?)").bind(sequenceId,data,now,now));
 statements.push(db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind('staff-code:'+op,actor,'personnel-codes','assign_personnel_codes',JSON.stringify(assigned.map(a=>({employeeId:a.employeeId,code:a.originalCode}))),JSON.stringify(assigned),now));
 return {statements,assigned};
}

/** Owner-approved, identity-only backfill. No HR row/revision, monetary snapshot or actor is rewritten. */
export async function ensurePersonnelCodes(){
 const db=storage();
 // Bounded, restartable pages; subsequent portal/catalog reads continue large imports.
 for(let page=0;page<4;page++){
  const raw=(await db.prepare("SELECT e.id,e.type,e.data,e.revision FROM flow_entities e WHERE e.type IN ('hr_employee','hr_link_archive','staff_test_archive') AND json_valid(e.data) AND length(trim(COALESCE(json_extract(e.data,'$.code'),'')))>0 AND NOT EXISTS(SELECT 1 FROM flow_entities c WHERE c.id='personnel-code:'||e.id AND c.type='personnel_code') ORDER BY e.created,e.id LIMIT 25").all()).results.map(decode);
  if(!raw.length)return;
  // Archived dossiers reserve their previous numbers too, but never become new employees.
  const changes=raw.map(r=>({...r,type:'hr_employee',data:{...r.data,code:typeof r.data.code==='string'?r.data.code:Number.isSafeInteger(r.data.code)?String(r.data.code):fail('کد پرسنلی قبلی نیازمند بررسی است.')}})),op=crypto.randomUUID(),now=new Date().toISOString();
  const plan=await personnelCodePlan(db,changes,op,'@system:personnel-codes-v1');
  try{await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'personnel_code_backfill',?,'@system:personnel-codes-v1',?,1)").bind(op,JSON.stringify({version:1,employeeIds:raw.map(r=>r.id),reason:'Owner-approved short personnel codes; retain original dossier and history'}),now),...plan.statements]);}
  catch(e){if(/guard|UNIQUE/.test(String(e))){if(page===3)fail('کدهای پرسنلی هم‌زمان در حال تخصیص‌اند؛ صفحه را تازه کنید.');continue;}throw e;}
 }
}

export async function projectPersonnelCodes(rows:any[]){
 const employees=rows.filter(r=>r.type==='hr_employee'),codes=new Map<string,string>(),db=storage();
 for(let i=0;i<employees.length;i+=80){const ids=employees.slice(i,i+80).map(r=>recordId(r.id));const found=(await db.prepare("SELECT id,data FROM flow_entities WHERE type='personnel_code' AND id IN ("+ids.map(()=>'?').join(',')+")").bind(...ids).all()).results;
  for(const r of found as any[]){const d=JSON.parse(r.data);if(typeof d.employeeId!=='string'||typeof d.code!=='string'||!personnelCodeKey(d.code)||r.id!==recordId(d.employeeId))fail('کد پرسنلی ثبت‌شده معتبر نیست.');codes.set(d.employeeId,d.code);}
 }
 return rows.map(r=>codes.has(r.id)?{...r,data:{...r.data,code:codes.get(r.id)}}:r);
}
