import {username,password,hashPassword} from "@/lib/password-auth";
import {env} from "cloudflare:workers";
import {storage} from "@/lib/storage";
import {requireAdmin, checkOrigin, accessResponse, AccessError} from "@/lib/authorization";
import {validatePermissions} from "@/lib/permissions";

function present(row: any) {return {...row,canDelete:!row.protected,email:row.username?"":row.email, userId: row.subject, permissions: JSON.parse(row.permissions)};}
function payload(value: any) {
  if (!value || typeof value !== "object") throw new Error("اطلاعات حساب معتبر نیست.");
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const unit = typeof value.unit === "string" ? value.unit.trim() : "";
  if (unit === "بازرگانی") throw new Error("زیرمجموعه بازرگانی را انتخاب کنید: داخلی یا خارجی.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 100 || !unit || unit.length > 100) throw new Error("نام، واحد و ایمیل معتبر را وارد کنید.");
  if (email === env.TRACE_OWNER_EMAIL?.trim().toLowerCase()) throw new Error("حساب مدیر اصلی از این بخش قابل تغییر نیست.");
  if (!["active", "disabled"].includes(value.status)) throw new Error("وضعیت حساب معتبر نیست.");
  return {email, name, unit, status: value.status, permissions: JSON.stringify(validatePermissions(value.permissions))};
}
async function checkServiceAgent(permissions:string){const p=JSON.parse(permissions);if(p.salesAgentId){const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='sales_agent'").bind(p.salesAgentId).first();if(!row||!JSON.parse(row.data).active)throw new Error('نماینده فروش فعال انتخاب کنید.');}if(p.serviceAgentId){const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='as_agent'").bind(p.serviceAgentId).first();if(!row||!JSON.parse(row.data).active||p.serviceDomains.length!==1||p.serviceDomains[0]!==JSON.parse(row.data).domain)throw new Error('نماینده فعال و حوزه منطبق را انتخاب کنید.');}}
function failure(error: unknown) {
  console.error(error);
  const denied = accessResponse(error); if (denied) return denied;
  const message = error instanceof Error ? error.message : "";
  if (/UNIQUE/.test(message)) return Response.json({error: "این ایمیل یا نام کاربری قبلاً تعریف شده است."}, {status: 409});
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
export async function GET() {
  try {
    const actor=await requireAdmin();
    const result=await storage().prepare("SELECT m.*,a.username FROM app_members m LEFT JOIN password_accounts a ON a.member_id=m.id WHERE m.status!='deleted' ORDER BY m.created DESC").all();
    const members=await Promise.all(result.results.map(async row=>present({...row,protected:await protectedAccount(row,actor)})));
    return Response.json({members,accountId:actor.userId},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return failure(error);}
}
export async function POST(request: Request) {
  try {
    checkOrigin(request); const actor = await requireAdmin(); checkAccount(request,actor); const body=await request.json() as any;const local=!!body.username;const login=local?username(body.username):null;const passwordHash=local?await hashPassword(password(body.password)):null;const data = payload({...body,email:local?crypto.randomUUID()+"@local.invalid":body.email});
    await checkServiceAgent(data.permissions);
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const row = {id, ...data, subject: null, username:login||undefined, revision: 1, created: now, updated: now};
    const db = storage();
    await db.batch([
      db.prepare("INSERT INTO app_members (id,email,name,unit,status,permissions,revision,created,updated) VALUES(?,?,?,?,?,?,1,?,?)").bind(id, data.email, data.name, data.unit, data.status, data.permissions, now, now),
      ...(login?[db.prepare("INSERT INTO password_accounts(member_id,username,password_hash,version) VALUES(?,?,?,1)").bind(id,login,passwordHash)]:[]),
      db.prepare("INSERT INTO access_audit (id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), actor.userId, id, "create_member", JSON.stringify(row), now),
    ]);
    return Response.json({member: present(row)}, {status: 201});
  } catch (error) {return failure(error);}
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request); const actor=await requireAdmin(); checkAccount(request,actor);
    const body=await request.json() as any;
    if(typeof body.id!=='string'||!Number.isInteger(body.revision)||body.revision<1)throw new Error('نسخه حساب معتبر نیست.');
    const db=storage(); const old=await db.prepare('SELECT * FROM app_members WHERE id=?').bind(body.id).first<any>();
    if(!old||old.status==='deleted')return Response.json({error:'حساب یافت نشد یا حذف شده است.'},{status:404});
    const protectedUser=await protectedAccount(old,actor);
    if(protectedUser&&body.status!=='active')throw new AccessError('حساب مدیر اصلی یا حساب جاری را نمی‌توان غیرفعال کرد.',403);
    const credential:any=await db.prepare('SELECT username FROM password_accounts WHERE member_id=?').bind(old.id).first();
    const login=credential?username(body.username===undefined?credential.username:body.username):null;
    const data=payload({...body,email:credential?old.email:body.email});
    const newHash=credential&&body.password?await hashPassword(password(body.password)):null;
    await checkServiceAgent(data.permissions);
    if(old.email!==data.email)throw new Error('ایمیل ورود قبلی ثابت است؛ برای ایمیل دیگر حساب جدا تعریف کنید.');
    if(old.revision!==body.revision)return conflict();
    const revoke=!!(newHash||credential&&login!==credential.username||data.status==='disabled');
    const now=new Date().toISOString(),auditId=crypto.randomUUID();
    const next={...old,...data,username:login||undefined,updated:now,revision:old.revision+1};
    // All statements are gated by the audit claim in the same transaction. A stale update changes nothing.
    const gate='EXISTS(SELECT 1 FROM access_audit WHERE id=?)';
    const results=await db.batch([
      db.prepare("INSERT INTO access_audit(id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? FROM app_members WHERE id=? AND revision=? AND status!='deleted'").bind(auditId,actor.userId,old.id,'update_member',JSON.stringify({...old,username:credential?.username}),JSON.stringify(next),now,old.id,old.revision),
      db.prepare('UPDATE app_members SET name=?,unit=?,status=?,permissions=?,updated=?,revision=revision+1 WHERE id=? AND '+gate).bind(data.name,data.unit,data.status,data.permissions,now,old.id,auditId),
      ...(credential?[db.prepare('UPDATE password_accounts SET username=?,password_hash=COALESCE(?,password_hash),version=version+? WHERE member_id=? AND '+gate).bind(login,newHash,revoke?1:0,old.id,auditId)]:[]),
      ...(revoke?[
        db.prepare('DELETE FROM password_sessions WHERE member_id=? AND '+gate).bind(old.id,auditId),
        db.prepare('UPDATE mcp_tokens SET revoked=1 WHERE (subject=? OR subject=?) AND '+gate).bind('local:'+old.id,old.subject||'local:'+old.id,auditId),
        db.prepare('DELETE FROM mcp_streams WHERE token_id IN (SELECT id FROM mcp_tokens WHERE subject=? OR subject=?) AND '+gate).bind('local:'+old.id,old.subject||'local:'+old.id,auditId)
      ]:[]),
    ]);
    if(!results[0].meta.changes)return conflict();
    return Response.json({member:present({...next,protected:protectedUser}),reauthenticate:revoke&&actor.userId==='local:'+old.id});
  }catch(error){return failure(error);}
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
    const now=new Date().toISOString(),auditId=crypto.randomUUID(),next={...old,status:'deleted',updated:now,revision:old.revision+1};
    const gate='EXISTS(SELECT 1 FROM access_audit WHERE id=?)';
    const results=await db.batch([
      db.prepare("INSERT INTO access_audit(id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? FROM app_members WHERE id=? AND revision=? AND status!='deleted'").bind(auditId,actor.userId,old.id,'delete_member',JSON.stringify(old),JSON.stringify(next),now,old.id,old.revision),
      db.prepare("UPDATE app_members SET status='deleted',updated=?,revision=revision+1 WHERE id=? AND "+gate).bind(now,old.id,auditId),
      db.prepare("UPDATE password_accounts SET password_hash='deleted',version=version+1 WHERE member_id=? AND "+gate).bind(old.id,auditId),
      db.prepare('DELETE FROM password_sessions WHERE member_id=? AND '+gate).bind(old.id,auditId),
      db.prepare('UPDATE mcp_tokens SET revoked=1 WHERE (subject=? OR subject=?) AND '+gate).bind('local:'+old.id,old.subject||'local:'+old.id,auditId),
      db.prepare('DELETE FROM mcp_streams WHERE token_id IN (SELECT id FROM mcp_tokens WHERE subject=? OR subject=?) AND '+gate).bind('local:'+old.id,old.subject||'local:'+old.id,auditId),
    ]);
    if(!results[0].meta.changes)return conflict();
    return Response.json({deleted:true,id:old.id});
  }catch(error){return failure(error);}
}
