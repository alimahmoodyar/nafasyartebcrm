import {username,password,hashPassword} from "@/lib/password-auth";
import {env} from "cloudflare:workers";
import {storage} from "@/lib/storage";
import {requireAdmin, checkOrigin, accessResponse} from "@/lib/authorization";
import {validatePermissions} from "@/lib/permissions";

function present(row: any) {return {...row,email:row.username?"":row.email, userId: row.subject, permissions: JSON.parse(row.permissions)};}
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
async function checkServiceAgent(permissions:string){const p=JSON.parse(permissions);if(p.serviceAgentId){const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='as_agent'").bind(p.serviceAgentId).first();if(!row||!JSON.parse(row.data).active||p.serviceDomains.length!==1||p.serviceDomains[0]!==JSON.parse(row.data).domain)throw new Error('نماینده فعال و حوزه منطبق را انتخاب کنید.');}}
function failure(error: unknown) {
  console.error(error);
  const denied = accessResponse(error); if (denied) return denied;
  const message = error instanceof Error ? error.message : "";
  if (/UNIQUE/.test(message)) return Response.json({error: "این ایمیل یا نام کاربری قبلاً تعریف شده است."}, {status: 409});
  return Response.json({error: /D1|SQLITE|Database/.test(message) ? "ذخیره حساب انجام نشد؛ دوباره تلاش کنید." : message || "درخواست معتبر نیست."}, {status: /D1|SQLITE|Database/.test(message) ? 503 : 400});
}
export async function GET() {
  try {await requireAdmin(); const result = await storage().prepare("SELECT m.*,a.username FROM app_members m LEFT JOIN password_accounts a ON a.member_id=m.id ORDER BY m.created DESC").all(); return Response.json({members: result.results.map(present)}, {headers: {"Cache-Control": "no-store"}});}
  catch (error) {return failure(error);}
}
export async function POST(request: Request) {
  try {
    checkOrigin(request); const actor = await requireAdmin(); const body=await request.json() as any;const local=!!body.username;const login=local?username(body.username):null;const passwordHash=local?await hashPassword(password(body.password)):null;const data = payload({...body,email:local?crypto.randomUUID()+"@local.invalid":body.email});
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
    checkOrigin(request); const actor = await requireAdmin();
    const body = await request.json() as any;
    if (typeof body.id !== "string" || !Number.isInteger(body.revision)) throw new Error("نسخه حساب معتبر نیست.");
    const db = storage(); const old = await db.prepare("SELECT * FROM app_members WHERE id = ?").bind(body.id).first<any>();
    if (!old) return Response.json({error: "حساب یافت نشد."}, {status: 404});
    const credential:any=await db.prepare("SELECT username FROM password_accounts WHERE member_id=?").bind(body.id).first();const data=payload({...body,email:credential?old.email:body.email});const newHash=credential&&body.password?await hashPassword(password(body.password)):null;
    await checkServiceAgent(data.permissions);
    if (old.email !== data.email) throw new Error("ایمیل حساب ثابت است؛ برای ایمیل دیگر حساب جدا تعریف کنید.");
    if (old.revision !== body.revision) return Response.json({error: "حساب توسط فرد دیگری تغییر کرده است؛ فهرست را تازه کنید."}, {status: 409});
    const now = new Date().toISOString(); const next = {...old, ...data,username:credential?.username, updated: now, revision: old.revision + 1};
    const results = await db.batch([
      db.prepare("INSERT INTO access_audit (id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? FROM app_members WHERE id = ? AND revision = ?").bind(crypto.randomUUID(), actor.userId, old.id, "update_member", JSON.stringify(old), JSON.stringify(next), now, old.id, old.revision),
      db.prepare("UPDATE app_members SET name=?,unit=?,status=?,permissions=?,updated=?,revision=revision+1 WHERE id=? AND revision=?").bind(data.name, data.unit, data.status, data.permissions, now, old.id, old.revision),
      ...(newHash?[db.prepare("UPDATE password_accounts SET password_hash=?,version=version+1 WHERE member_id=? AND EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=? AND updated=?)").bind(newHash,old.id,old.id,old.revision+1,now)]:credential&&data.status==="disabled"?[db.prepare("UPDATE password_accounts SET version=version+1 WHERE member_id=? AND EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=? AND updated=?)").bind(old.id,old.id,old.revision+1,now)]:[]),
    ]);
    if (!results[1].meta.changes) return Response.json({error: "حساب تغییر کرده است؛ فهرست را تازه کنید."}, {status: 409});
    return Response.json({member: present(next)});
  } catch (error) {return failure(error);}
}
