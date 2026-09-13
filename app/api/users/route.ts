import {env} from "cloudflare:workers";
import {storage} from "@/lib/storage";
import {requireAdmin, checkOrigin, accessResponse} from "@/lib/authorization";
import {validatePermissions} from "@/lib/permissions";

function present(row: any) {return {...row, userId: row.subject, permissions: JSON.parse(row.permissions)};}
function payload(value: any) {
  if (!value || typeof value !== "object") throw new Error("اطلاعات حساب معتبر نیست.");
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const unit = typeof value.unit === "string" ? value.unit.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 100 || !unit || unit.length > 100) throw new Error("نام، واحد و ایمیل معتبر را وارد کنید.");
  if (email === env.TRACE_OWNER_EMAIL?.trim().toLowerCase()) throw new Error("حساب مدیر اصلی از این بخش قابل تغییر نیست.");
  if (!["active", "disabled"].includes(value.status)) throw new Error("وضعیت حساب معتبر نیست.");
  return {email, name, unit, status: value.status, permissions: JSON.stringify(validatePermissions(value.permissions))};
}
function failure(error: unknown) {
  console.error(error);
  const denied = accessResponse(error); if (denied) return denied;
  const message = error instanceof Error ? error.message : "";
  if (/UNIQUE/.test(message)) return Response.json({error: "این ایمیل قبلاً تعریف شده است."}, {status: 409});
  return Response.json({error: /D1|SQLITE|Database/.test(message) ? "ذخیره حساب انجام نشد؛ دوباره تلاش کنید." : message || "درخواست معتبر نیست."}, {status: /D1|SQLITE|Database/.test(message) ? 503 : 400});
}
export async function GET() {
  try {await requireAdmin(); const result = await storage().prepare("SELECT * FROM app_members ORDER BY created DESC").all(); return Response.json({members: result.results.map(present)}, {headers: {"Cache-Control": "no-store"}});}
  catch (error) {return failure(error);}
}
export async function POST(request: Request) {
  try {
    checkOrigin(request); const actor = await requireAdmin(); const data = payload(await request.json());
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const row = {id, ...data, subject: null, revision: 1, created: now, updated: now};
    const db = storage();
    await db.batch([
      db.prepare("INSERT INTO app_members (id,email,name,unit,status,permissions,revision,created,updated) VALUES(?,?,?,?,?,?,1,?,?)").bind(id, data.email, data.name, data.unit, data.status, data.permissions, now, now),
      db.prepare("INSERT INTO access_audit (id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), actor.userId, id, "create_member", JSON.stringify(row), now),
    ]);
    return Response.json({member: present(row)}, {status: 201});
  } catch (error) {return failure(error);}
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request); const actor = await requireAdmin();
    const body = await request.json() as any; const data = payload(body);
    if (typeof body.id !== "string" || !Number.isInteger(body.revision)) throw new Error("نسخه حساب معتبر نیست.");
    const db = storage(); const old = await db.prepare("SELECT * FROM app_members WHERE id = ?").bind(body.id).first<any>();
    if (!old) return Response.json({error: "حساب یافت نشد."}, {status: 404});
    if (old.email !== data.email) throw new Error("ایمیل حساب ثابت است؛ برای ایمیل دیگر حساب جدا تعریف کنید.");
    if (old.revision !== body.revision) return Response.json({error: "حساب توسط فرد دیگری تغییر کرده است؛ فهرست را تازه کنید."}, {status: 409});
    const now = new Date().toISOString(); const next = {...old, ...data, updated: now, revision: old.revision + 1};
    const results = await db.batch([
      db.prepare("INSERT INTO access_audit (id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? FROM app_members WHERE id = ? AND revision = ?").bind(crypto.randomUUID(), actor.userId, old.id, "update_member", JSON.stringify(old), JSON.stringify(next), now, old.id, old.revision),
      db.prepare("UPDATE app_members SET name=?,unit=?,status=?,permissions=?,updated=?,revision=revision+1 WHERE id=? AND revision=?").bind(data.name, data.unit, data.status, data.permissions, now, old.id, old.revision),
    ]);
    if (!results[1].meta.changes) return Response.json({error: "حساب تغییر کرده است؛ فهرست را تازه کنید."}, {status: 409});
    return Response.json({member: present(next)});
  } catch (error) {return failure(error);}
}
