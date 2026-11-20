import {accountPersonnelLink,personnelAccountLinkPlan} from '@/lib/personnel-account-link';
import {hrRows} from '@/lib/personnel';
import {personnelBaseApproved} from '@/lib/personnel-documents';
import {requiredPersonnel} from '@/lib/personnel-employment';
import {materialWarehouses,warehouseProfilePermissions,warehouseResponsibilityGuards} from '@/lib/material-warehouses';
import {syncMaterialTasks} from '@/lib/material-tasks';
import {storedAccessPermissions} from '@/lib/permissions';
import {username,password,hashPassword} from "@/lib/password-auth";
import {env} from "cloudflare:workers";
import {storage} from "@/lib/storage";
import {requireAdmin, checkOrigin, accessResponse, AccessError} from "@/lib/authorization";
import {validatePermissions} from "@/lib/permissions";
import {personnelStaff,personnelProfileStatements} from "@/lib/personnel-profile";
import {contactPatch,memberContactsForAccounts,memberContactAdminContext,memberContactGuards,contactRevisionGuard,memberContactWrite} from '@/lib/member-contact';

function present(row: any) {return {...row,canDelete:!row.protected,email:row.username?"":row.email, userId: row.subject, permissions: storedAccessPermissions(row.permissions)};}
function payload(value: any) {
  if (!value || typeof value !== "object") throw new Error("اطلاعات حساب معتبر نیست.");
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const unit = typeof value.unit === "string" && value.unit.trim() ? value.unit.trim() : "کارکنان";
  if (unit === "بازرگانی") throw new Error("زیرمجموعه بازرگانی را انتخاب کنید: داخلی یا خارجی.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 100 || unit.length > 100) throw new Error("نام و ایمیل معتبر را وارد کنید.");
  if (email === env.TRACE_OWNER_EMAIL?.trim().toLowerCase()) throw new Error("حساب مدیر اصلی از این بخش قابل تغییر نیست.");
  if (!["active", "disabled"].includes(value.status)) throw new Error("وضعیت حساب معتبر نیست.");
  return {email, name, unit, status: value.status, permissions: JSON.stringify(validatePermissions(value.permissions))};
}
async function checkServiceAgent(permissions:string){const p=JSON.parse(permissions);if(p.salesAgentId){const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='sales_agent'").bind(p.salesAgentId).first();if(!row||!JSON.parse(row.data).active)throw new Error('نماینده فروش فعال انتخاب کنید.');}if(p.serviceAgentId){const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='as_agent'").bind(p.serviceAgentId).first();if(!row||!JSON.parse(row.data).active||p.serviceDomains.length!==1||p.serviceDomains[0]!==JSON.parse(row.data).domain)throw new Error('نماینده فعال و حوزه منطبق را انتخاب کنید.');}}
function failure(error: unknown, identity: 'username' | 'email' | 'both' = 'both') {
  console.error(error);
  const denied = accessResponse(error); if (denied) return denied;
  const message = error instanceof Error ? error.message : "";
  if(/inventory_operation_guard/.test(message))return conflict();
  if (/UNIQUE/.test(message)) {
    const errorText = identity === 'username' ? 'این نام کاربری قبلاً تعریف شده است.' : identity === 'email' ? 'این ایمیل قبلاً تعریف شده است.' : 'این ایمیل یا نام کاربری قبلاً تعریف شده است.';
    return Response.json({error: errorText}, {status: 409});
  }
  return Response.json({error: /D1|SQLITE|Database/.test(message) ? "ذخیره حساب انجام نشد؛ دوباره تلاش کنید." : message || "درخواست معتبر نیست."}, {status: /D1|SQLITE|Database/.test(message) ? 503 : 400});
}
function checkAccount(request:Request,actor:{userId:string}) {
  const expected=request.headers.get('x-assistant-account');
  if(expected&&expected!==actor.userId)throw new AccessError('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.',409);
}
async function protectedAccount(row:any,actor:{userId:string}) {
  const identities=(await storage().prepare("SELECT subject FROM app_identity WHERE id IN ('owner','local_admin')").all()).results as {subject:string}[];
  return actor.userId==='local:'+row.id || (!!row.subject&&row.subject===actor.userId) || row.email===env.TRACE_OWNER_EMAIL?.trim().toLowerCase() || identities.some(i=>i.subject===row.id||(!!row.subject&&i.subject===row.subject));
}
const conflict=()=>Response.json({error:'حساب توسط فرد دیگری تغییر کرده است؛ فهرست را تازه کنید.'},{status:409});
// Login credentials are intentionally destroyed on deletion. Recover only display/login hints,
// never a password, from the last trusted account audit. Old installations may retain the login.
async function archivedIdentity(row:any) {
  const db=storage(),credential:any=await db.prepare('SELECT username FROM password_accounts WHERE member_id=?').bind(row.id).first();
  const audits=(await db.prepare("SELECT before,after FROM access_audit WHERE target=? AND action IN ('create_member','update_member','delete_member','restore_member','automatic_representative_account') ORDER BY at DESC,rowid DESC").bind(row.id).all()).results as any[];
  let login=credential?.username&&!credential.username.startsWith('@deleted:')?credential.username:'';
  let email=row.email?.endsWith('@deleted.invalid')?'':row.email,subject=row.subject||null;
  for(const audit of audits)for(const raw of [audit.after,audit.before]){
    let d:any;try{d=JSON.parse(raw||'null')}catch{continue}if(!d||typeof d!=='object')continue;
    if(!login&&typeof d.username==='string'&&!d.username.startsWith('@deleted:'))login=d.username;
    if(!email&&typeof d.email==='string'&&!d.email.endsWith('@deleted.invalid'))email=d.email;
    if(!subject&&typeof d.subject==='string')subject=d.subject;
  }
  return {localAccount:!!credential,username:login,email:credential?'':email||'',subject};
}
async function restoreAccount(body:any,actor:{userId:string}) {
  if(body.confirmed!==true)throw new AccessError('بازیابی حساب به تأیید صریح شما نیاز دارد.',400);
  if(typeof body.id!=='string'||!Number.isSafeInteger(body.revision)||body.revision<1)throw new AccessError('شناسه و نسخه حساب معتبر لازم است.',400);
  const db=storage(),old=await db.prepare('SELECT * FROM app_members WHERE id=?').bind(body.id).first<any>();
  if(!old)throw new AccessError('حساب یافت نشد.',404);
  if(old.status!=='deleted'||old.revision!==body.revision||body.accountName!==old.name)return Response.json({error:'وضعیت حساب تغییر کرده است؛ فهرست حذف‌شده‌ها را تازه کنید.',code:'STALE_ACCOUNT'},{status:409});
  if(await protectedAccount(old,actor))throw new AccessError('حساب مدیر اصلی یا حساب جاری از این مسیر قابل بازیابی نیست.',403);
  const identity=await archivedIdentity(old),login=identity.localAccount?username(body.username):null;
  const passwordHash=identity.localAccount?await hashPassword(password(body.password)):null;
  const data=payload({...old,status:'active',permissions:storedAccessPermissions(old.permissions),email:identity.localAccount?crypto.randomUUID()+'@local.invalid':identity.email||body.email});
  await checkServiceAgent(data.permissions);
  const now=new Date().toISOString(),auditId=crypto.randomUUID(),operationId=crypto.randomUUID(),subject=identity.localAccount?null:identity.subject;
  const warehouseGuards=await warehouseResponsibilityGuards(data.permissions,operationId);
  const next={...old,...data,subject,username:login||undefined,updated:now,revision:old.revision+1};
  const gate='EXISTS(SELECT 1 FROM access_audit WHERE id=?)';
  try {
    await db.batch([
      db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(operationId,'restore_member',JSON.stringify({memberId:old.id}),actor.userId,now),
      db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=? AND status='deleted') THEN guard ELSE 0 END WHERE id=?").bind(old.id,old.revision,operationId),
      ...warehouseGuards,
      db.prepare("INSERT INTO access_audit(id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? FROM app_members WHERE id=? AND revision=? AND status='deleted'").bind(auditId,actor.userId,old.id,'restore_member',JSON.stringify(old),JSON.stringify(next),now,old.id,old.revision),
      db.prepare('UPDATE app_members SET email=?,subject=?,status=?,permissions=?,updated=?,revision=revision+1 WHERE id=? AND '+gate).bind(data.email,subject,'active',data.permissions,now,old.id,auditId),
      ...(login?[db.prepare('UPDATE password_accounts SET username=?,password_hash=?,password_ciphertext=NULL,version=version+1 WHERE member_id=? AND '+gate).bind(login,passwordHash,old.id,auditId)]:[]),
      db.prepare('DELETE FROM password_sessions WHERE member_id=? AND '+gate).bind(old.id,auditId),
      db.prepare('UPDATE mcp_tokens SET revoked=1 WHERE (subject=? OR subject=?) AND '+gate).bind('local:'+old.id,identity.subject||'local:'+old.id,auditId),
      db.prepare('DELETE FROM mcp_streams WHERE token_id IN (SELECT id FROM mcp_tokens WHERE subject=? OR subject=?) AND '+gate).bind('local:'+old.id,identity.subject||'local:'+old.id,auditId),
      db.prepare('DELETE FROM role_preview_sessions WHERE member_id=? AND '+gate).bind(old.id,auditId),
    ]);
  }catch(error){if(/UNIQUE/.test(String(error)))return Response.json({error:login?'این نام کاربری اکنون متعلق به حساب دیگری است؛ نام دیگری انتخاب کنید.':'این ایمیل اکنون متعلق به حساب دیگری است؛ ابتدا تداخل حساب‌ها را بررسی کنید.',code:'LOGIN_CONFLICT'},{status:409});throw error;}
  try{await syncMaterialTasks()}catch{}
  const contact=(await memberContactsForAccounts([old.id]))[0];
  return Response.json({restored:true,member:present({...next,personnelLink:accountPersonnelLink(next,await hrRows()),permissions:JSON.stringify(warehouseProfilePermissions(next,await materialWarehouses())),mobile:contact.mobile,contactEmail:contact.contactEmail,contactRevision:contact.revision,protected:false})});
}
async function linkExistingPersonnel(body:any,actor:any){
  const allowed=['mode','requestId','id','revision','accountName','personnelId','personnelRevision','personnelName','contactRevision','reason','confirmed'];
  if(!body||Object.keys(body).some(k=>!allowed.includes(k))||body.confirmed!==true)throw new AccessError('اطلاعات اتصال و تأیید صریح دو هویت لازم است.',400);
  if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)||typeof body.id!=='string'||typeof body.personnelId!=='string'||!Number.isSafeInteger(body.revision)||body.revision<1||!Number.isSafeInteger(body.personnelRevision)||body.personnelRevision<1||!Number.isSafeInteger(body.contactRevision)||body.contactRevision<0||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>4000)throw new AccessError('شناسه، نسخه حساب و پرونده و دلیل اتصال لازم است.',400);
  const db=storage(),scope=await memberContactAdminContext(actor),signature=JSON.stringify({id:body.id,revision:body.revision,accountName:body.accountName,personnelId:body.personnelId,personnelRevision:body.personnelRevision,personnelName:body.personnelName,contactRevision:body.contactRevision,reason:body.reason.trim()});
  const prior:any=await db.prepare('SELECT kind,actor,payload FROM inventory_operations WHERE id=?').bind(body.requestId).first();
  if(prior){if(prior.kind!=='link_personnel_account'||prior.actor!==actor.userId||prior.payload!==signature)throw new AccessError('شناسه عملیات قبلاً با اطلاعات دیگری استفاده شده است.',409);return Response.json({linked:true,repeated:true,personnelId:body.personnelId});}
  const old:any=await db.prepare('SELECT m.*,a.username FROM app_members m LEFT JOIN password_accounts a ON a.member_id=m.id WHERE m.id=?').bind(body.id).first();if(!old||old.status==='deleted')throw new AccessError('ابتدا حساب حذف‌شده را بازیابی کنید؛ حساب موجود و حذف‌نشده لازم است.',404);
  const rows=await hrRows(),profile=rows.find(r=>r.id===body.personnelId&&r.type==='hr_employee');
  if(!profile)throw new AccessError('پرونده پرسنلی یافت نشد.',404);
  if(old.revision!==body.revision||old.name!==body.accountName||profile.revision!==body.personnelRevision||profile.data.name!==body.personnelName)return conflict();
  const contact=(await memberContactsForAccounts([old.id]))[0];if(contact.revision!==body.contactRevision)return conflict();
  const now=new Date().toISOString(),plan=personnelAccountLinkPlan(rows,scope.members,old,profile,actor,body.reason.trim(),now),nextContact=contactPatch({mobile:profile.data.mobile},contact);
  const externalGuard="NOT EXISTS(SELECT 1 FROM flow_entities f,json_tree(CASE WHEN json_valid(f.data) THEN f.data ELSE '{}' END) j WHERE f.type NOT GLOB 'hr_*' AND (j.value=? OR j.key=?))";
  if(!await db.prepare('SELECT 1 AS valid WHERE '+externalGuard).bind(plan.from,plan.from).first())throw new AccessError('شناسه موقت در بخش دیگری سابقه دارد؛ پیش از اتصال باید ارتباط آن بررسی شود.',409);
  const next={...old,name:profile.data.name,updated:now,revision:old.revision+1};
  await db.batch([
    db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(body.requestId,'link_personnel_account',signature,actor.userId,now),
    ...memberContactGuards(db,body.requestId,scope),contactRevisionGuard(db,body.requestId,old.id,contact.revision),
    db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=? AND status!='deleted') AND (SELECT COUNT(*) FROM flow_entities WHERE type GLOB 'hr_*')=? AND (SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE type GLOB 'hr_*')=? AND "+externalGuard+' THEN guard ELSE 0 END WHERE id=?').bind(old.id,old.revision,rows.length,rows.reduce((n,r)=>n+r.revision,0),plan.from,plan.from,body.requestId),
    ...plan.changes.map(r=>db.prepare('UPDATE flow_entities SET type=?,data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(r.type,JSON.stringify(r.data),now,r.id,r.revision)),
    db.prepare('UPDATE app_members SET name=?,updated=?,revision=revision+1 WHERE id=? AND revision=?').bind(next.name,now,old.id,old.revision),
    memberContactWrite(db,old.id,nextContact,now),
    db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(body.requestId,actor.userId,profile.id,'link_personnel_account',JSON.stringify({member:{id:old.id,name:old.name,revision:old.revision},contact,records:plan.changes.map(r=>rows.find(x=>x.id===r.id))}),JSON.stringify({member:{id:old.id,name:next.name,revision:next.revision},personnelId:profile.id,previousMemberId:plan.from,reason:body.reason.trim(),previousBaseId:plan.previousBaseId,records:plan.changes.map(r=>({id:r.id,type:r.type,revision:r.revision+1}))}),now),
  ]);
  const linkedRows=rows.map(r=>{const changed=plan.changes.find(c=>c.id===r.id);return changed?{...changed,revision:r.revision+1}:r;});
  try{await syncMaterialTasks()}catch{}
  return Response.json({linked:true,personnelId:profile.id,member:present({...next,permissions:JSON.stringify(warehouseProfilePermissions(next,await materialWarehouses())),...nextContact,contactRevision:contact.revision+1,protected:await protectedAccount(next,actor),personnelLink:accountPersonnelLink(next,linkedRows)})});
}
export async function GET() {
  try {
    const actor=await requireAdmin();
    await memberContactAdminContext(actor);
    const personnelRows=await hrRows();
    const result=await storage().prepare("SELECT m.*,a.username FROM app_members m LEFT JOIN password_accounts a ON a.member_id=m.id WHERE m.status!='deleted' ORDER BY m.created DESC").all();
    const deletedRows=(await storage().prepare("SELECT * FROM app_members WHERE status='deleted' ORDER BY updated DESC,id").all()).results;
    const deletedMembers=await Promise.all(deletedRows.map(async(row:any)=>{const identity=await archivedIdentity(row);return {id:row.id,name:row.name,unit:row.unit,status:'deleted',revision:row.revision,deletedAt:row.updated,localAccount:identity.localAccount,username:identity.username,email:identity.email,permissions:storedAccessPermissions(row.permissions)};}));
    const warehouses=await materialWarehouses();
    const contacts=await memberContactsForAccounts(result.results.map((row:any)=>row.id));
    const personnelCandidates=(await storage().prepare("SELECT e.id,e.revision,e.data FROM flow_entities e WHERE e.type='hr_employee' AND NOT EXISTS(SELECT 1 FROM app_members m WHERE m.id=json_extract(e.data,'$.memberId')) ORDER BY e.created,e.id").all()).results.map((r:any)=>{const d=JSON.parse(r.data);return {id:r.id,revision:r.revision,name:d.name,unit:d.unit,code:d.code,mobile:d.mobile||'',ready:personnelBaseApproved(d)}});
    const members=await Promise.all(result.results.map(async (row:any)=>{const c=contacts.find(c=>c.memberId===row.id)!;return present({...row,personnelLink:accountPersonnelLink(row,personnelRows),permissions:JSON.stringify(warehouseProfilePermissions(row,warehouses)),mobile:c.mobile,contactEmail:c.contactEmail,contactRevision:c.revision,protected:await protectedAccount(row,actor)})}));
    return Response.json({members,deletedMembers,personnelCandidates,accountId:actor.userId,warehouses:warehouses.map(w=>({id:w.id,name:w.data.name,active:w.data.active}))},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return failure(error);}
}
export async function POST(request: Request) {
  let localAccount = false;
  try {
    checkOrigin(request); const actor = await requireAdmin(); checkAccount(request,actor); const body=await request.json() as any;localAccount=!!body.username;const login=localAccount?username(body.username):null;const passwordHash=localAccount?await hashPassword(password(body.password)):null;contactPatch(body);const internalNew=personnelStaff({status:'active',permissions:JSON.stringify(validatePermissions(body.permissions))});let personnel:any=null;
    if(internalNew){if(typeof body.personnelId!=='string')throw new AccessError('ابتدا پرونده شخص را در مسئول اداری تکمیل و سپس همین پرونده را انتخاب کنید.',400);const found:any=await storage().prepare("SELECT * FROM flow_entities WHERE id=? AND type='hr_employee'").bind(body.personnelId).first();if(!found)throw new AccessError('پرونده پرسنلی یافت نشد.',404);personnel={...found,data:JSON.parse(found.data)};const d=personnel.data;if(!personnelBaseApproved(d))throw new AccessError('اطلاعات پایه پرونده هنوز توسط اداری تأیید نشده است.',409);requiredPersonnel(d,d.mobile);if(await storage().prepare('SELECT id FROM app_members WHERE id=?').bind(d.memberId).first())throw new AccessError('برای این شخص قبلاً حساب ساخته شده است.',409);}
    const data = payload({...body,...(personnel?{name:personnel.data.name,unit:personnel.data.unit}:{}),unit:personnel?personnel.data.unit:localAccount?'کارکنان':body.unit,email:localAccount?crypto.randomUUID()+"@local.invalid":body.email});
    await checkServiceAgent(data.permissions);
    const contact=contactPatch(personnel?{mobile:personnel.data.mobile,contactEmail:body.contactEmail||''}:body),scope=await memberContactAdminContext(actor);
    const id = personnel?.data.memberId||crypto.randomUUID(), now = new Date().toISOString(),operationId=crypto.randomUUID();
    const warehouseGuards=await warehouseResponsibilityGuards(data.permissions,operationId);
    const row = {id, ...data, subject: null, username:login||undefined, revision: 1, created: now, updated: now};
    const db = storage();
    await db.batch([
      db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(operationId,'create_member',JSON.stringify({memberId:id}),actor.userId,now),
      ...warehouseGuards,
      ...(personnel?[db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='hr_employee' AND revision=?) THEN guard ELSE 0 END WHERE id=?").bind(personnel.id,personnel.revision,operationId)]:[]),
      ...memberContactGuards(db,operationId,scope),
      db.prepare("INSERT INTO app_members (id,email,name,unit,status,permissions,revision,created,updated) VALUES(?,?,?,?,?,?,1,?,?)").bind(id, data.email, data.name, data.unit, data.status, data.permissions, now, now),
      ...(login?[db.prepare("INSERT INTO password_accounts(member_id,username,password_hash,version) VALUES(?,?,?,1)").bind(id,login,passwordHash)]:[]),
      db.prepare("INSERT INTO access_audit (id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), actor.userId, id, "create_member", JSON.stringify(row), now),
      ...(personnel?[db.prepare("UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(JSON.stringify({...personnel.data,accountLinkedAt:now,history:[...(personnel.data.history||[]),{at:now,actor:actor.userId,name:actor.name,mode:'account_link',notes:'ساخت حساب برای پرونده موجود؛ دسترسی توسط مدیر سامانه تعیین شد.',state:personnel.data.state}]}),now,personnel.id,personnel.revision)]:personnelProfileStatements(db,row,actor,now)),
      contactRevisionGuard(db,operationId,id,0),memberContactWrite(db,id,contact,now),
      db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,id,'member_contact_create',JSON.stringify({memberId:id,...contact,revision:1}),now),
    ]);
    try{await syncMaterialTasks()}catch{}
    return Response.json({member: present({...row,personnelLink:accountPersonnelLink(row,await hrRows()),...contact,contactRevision:1})}, {status: 201});
  } catch (error) {return failure(error, localAccount ? 'username' : 'email');}
}
export async function PATCH(request: Request) {
  let localAccount = false;
  try {
    checkOrigin(request); const actor=await requireAdmin(); checkAccount(request,actor);
    const body=await request.json() as any;
    if(body.mode==='restore')return await restoreAccount(body,actor);
    if(body.mode==='link_personnel')return await linkExistingPersonnel(body,actor);
    if(typeof body.id!=='string'||!Number.isInteger(body.revision)||body.revision<1)throw new Error('نسخه حساب معتبر نیست.');
    const db=storage(); const old=await db.prepare('SELECT * FROM app_members WHERE id=?').bind(body.id).first<any>();
    if(!old||old.status==='deleted')return Response.json({error:'حساب یافت نشد یا حذف شده است.'},{status:404});
    const protectedUser=await protectedAccount(old,actor);
    if(protectedUser&&body.status!=='active')throw new AccessError('حساب مدیر اصلی یا حساب جاری را نمی‌توان غیرفعال کرد.',403);
    const credential:any=await db.prepare('SELECT username FROM password_accounts WHERE member_id=?').bind(old.id).first(); localAccount=!!credential;
    const login=credential?username(body.username===undefined?credential.username:body.username):null;
    const oldWarehousePermissions=warehouseProfilePermissions(old,await materialWarehouses()),submitted=body.permissions?.roleAssignment?{...body.permissions,roleAssignment:{...body.permissions.roleAssignment,warehouseResponsibilities:body.permissions.roleAssignment.warehouseResponsibilities??oldWarehousePermissions.warehouseResponsibilities}}:{...body.permissions,warehouseResponsibilities:body.permissions?.warehouseResponsibilities??oldWarehousePermissions.warehouseResponsibilities};
    const data=payload({...body,permissions:submitted,unit:body.unit===undefined?old.unit:body.unit,email:credential?old.email:body.email});
    const newHash=credential&&body.password?await hashPassword(password(body.password)):null;
    await checkServiceAgent(data.permissions);
    if(old.email!==data.email)throw new Error('ایمیل ورود قبلی ثابت است؛ برای ایمیل دیگر حساب جدا تعریف کنید.');
    if(old.revision!==body.revision)return conflict();
    const contactSupplied=Object.hasOwn(body,'mobile')||Object.hasOwn(body,'contactEmail'),oldContact=(await memberContactsForAccounts([old.id]))[0],contact=contactPatch(body,oldContact),scope=await memberContactAdminContext(actor);
    if(contactSupplied&&(!Number.isSafeInteger(body.contactRevision)||body.contactRevision<0))throw new AccessError('نسخه اطلاعات تماس معتبر لازم است.',400);
    if(contactSupplied&&body.contactRevision!==oldContact.revision)throw new AccessError('اطلاعات تماس تغییر کرده است؛ فهرست را تازه کنید.',409);
    const revoke=!!(newHash||credential&&login!==credential.username||data.status==='disabled');
    const now=new Date().toISOString(),auditId=crypto.randomUUID(),operationId=crypto.randomUUID();
    const warehouseGuards=await warehouseResponsibilityGuards(data.permissions,operationId);
    const next={...old,...data,username:login||undefined,updated:now,revision:old.revision+1};
    // All statements are gated by the audit claim in the same transaction. A stale update changes nothing.
    const gate='EXISTS(SELECT 1 FROM access_audit WHERE id=?)';
    const results=await db.batch([
      db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(operationId,'update_member',JSON.stringify({memberId:old.id}),actor.userId,now),
      ...memberContactGuards(db,operationId,scope),
      db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=? AND status!='deleted') THEN guard ELSE 0 END WHERE id=?").bind(old.id,old.revision,operationId),
      ...(contactSupplied?[contactRevisionGuard(db,operationId,old.id,oldContact.revision)]:[]),
      db.prepare("INSERT INTO access_audit(id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? FROM app_members WHERE id=? AND revision=? AND status!='deleted'").bind(auditId,actor.userId,old.id,'update_member',JSON.stringify({...old,username:credential?.username}),JSON.stringify(next),now,old.id,old.revision),
      db.prepare('UPDATE app_members SET name=?,unit=?,status=?,permissions=?,updated=?,revision=revision+1 WHERE id=? AND '+gate).bind(data.name,data.unit,data.status,data.permissions,now,old.id,auditId),
      ...(credential?[db.prepare('UPDATE password_accounts SET username=?,password_hash=COALESCE(?,password_hash),version=version+? WHERE member_id=? AND '+gate).bind(login,newHash,revoke?1:0,old.id,auditId)]:[]),
      ...(revoke?[
        db.prepare('DELETE FROM password_sessions WHERE member_id=? AND '+gate).bind(old.id,auditId),
        db.prepare('UPDATE mcp_tokens SET revoked=1 WHERE (subject=? OR subject=?) AND '+gate).bind('local:'+old.id,old.subject||'local:'+old.id,auditId),
        db.prepare('DELETE FROM mcp_streams WHERE token_id IN (SELECT id FROM mcp_tokens WHERE subject=? OR subject=?) AND '+gate).bind('local:'+old.id,old.subject||'local:'+old.id,auditId)
      ]:[]),
      ...warehouseGuards,
      ...(contactSupplied?[memberContactWrite(db,old.id,contact,now),db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,old.id,'member_contact_update',JSON.stringify(oldContact),JSON.stringify({memberId:old.id,...contact,revision:oldContact.revision+1}),now)]:[]),
    ]);
    if(!results[contactSupplied?5:4].meta.changes)return conflict();
    const latestContact=contactSupplied?{...contact,revision:oldContact.revision+1}:(await memberContactsForAccounts([old.id]))[0];
    try{await syncMaterialTasks()}catch{}
    return Response.json({member:present({...next,personnelLink:accountPersonnelLink(next,await hrRows()),mobile:latestContact.mobile,contactEmail:latestContact.contactEmail,contactRevision:latestContact.revision,protected:protectedUser}),reauthenticate:revoke&&actor.userId==='local:'+old.id});
  }catch(error){return failure(error, localAccount ? 'username' : 'email');}
}
export async function DELETE(request:Request) {
  try {
    checkOrigin(request);const actor=await requireAdmin();checkAccount(request,actor);
    const body=await request.json() as any;
    if(body.confirmed!==true)throw new AccessError('حذف حساب به تأیید صریح شما نیاز دارد.',400);
    if(typeof body.id!=='string'||!Number.isInteger(body.revision)||body.revision<1)throw new AccessError('شناسه و نسخه حساب معتبر لازم است.',400);
    const db=storage(),old=await db.prepare('SELECT * FROM app_members WHERE id=?').bind(body.id).first<any>();
    if(!old)throw new AccessError('حساب یافت نشد.',404);
    if(await protectedAccount(old,actor))throw new AccessError('حساب مدیر اصلی یا حساب جاری قابل حذف نیست.',403);
    if(old.status==='deleted')return Response.json({deleted:true,id:old.id,alreadyDeleted:true});
    if(body.accountName!==undefined&&body.accountName!==old.name)return conflict();
    if(old.revision!==body.revision)return conflict();
    const credential:any=await db.prepare('SELECT username FROM password_accounts WHERE member_id=?').bind(old.id).first();
    const now=new Date().toISOString(),auditId=crypto.randomUUID(),next={...old,status:'deleted',updated:now,revision:old.revision+1};
    const gate='EXISTS(SELECT 1 FROM access_audit WHERE id=?)';
    const results=await db.batch([
      db.prepare("INSERT INTO access_audit(id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? FROM app_members WHERE id=? AND revision=? AND status!='deleted'").bind(auditId,actor.userId,old.id,'delete_member',JSON.stringify({...old,username:credential?.username}),JSON.stringify({...next,username:credential?.username}),now,old.id,old.revision),
      // Keep the member row for historical references, but release all login identity keys.
      // The audit snapshot retains the original email/subject for traceability.
      db.prepare("UPDATE app_members SET status='deleted',email='deleted+'||id||'@deleted.invalid',subject=NULL,updated=?,revision=revision+1 WHERE id=? AND "+gate).bind(now,old.id,auditId),
      db.prepare("UPDATE password_accounts SET username='@deleted:'||member_id,password_hash='deleted',password_ciphertext=NULL,version=version+1 WHERE member_id=? AND "+gate).bind(old.id,auditId),
      db.prepare('DELETE FROM password_sessions WHERE member_id=? AND '+gate).bind(old.id,auditId),
      db.prepare('UPDATE mcp_tokens SET revoked=1 WHERE (subject=? OR subject=?) AND '+gate).bind('local:'+old.id,old.subject||'local:'+old.id,auditId),
      db.prepare('DELETE FROM mcp_streams WHERE token_id IN (SELECT id FROM mcp_tokens WHERE subject=? OR subject=?) AND '+gate).bind('local:'+old.id,old.subject||'local:'+old.id,auditId),
    ]);
    if(!results[0].meta.changes)return conflict();
    try{await syncMaterialTasks()}catch{}
    return Response.json({deleted:true,id:old.id});
  }catch(error){return failure(error);}
}
