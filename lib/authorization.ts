import {localSession} from "@/lib/password-auth";
import {mcpActor} from "@/lib/mcp/context";
import {env} from "cloudflare:workers";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {storage} from "@/lib/storage";
import {allPermissions, validatePermissions, type Session} from "@/lib/permissions";
import type {Kind} from "@/lib/model";

export class AccessError extends Error { constructor(message: string, public status: number) {super(message);} }
export async function session(): Promise<Session> {
  const actor = mcpActor.getStore();
  if (actor) return actor;
  const local=await localSession();
  if(local!==undefined){if(!local)throw new AccessError("نشست شما منقضی یا غیرفعال شده است؛ دوباره وارد شوید.",401);return local;}
  const identity = await getChatGPTUser();
  return resolveIdentity(identity);
}
export async function resolveIdentity(identity: Awaited<ReturnType<typeof getChatGPTUser>>): Promise<Session> {
  if (!identity) throw new AccessError("با نام کاربری و رمز عبور یا از بخش ورود مدیر وارد شوید.", 401);
  const email = identity.email.trim().toLowerCase();
  const ownerEmail = env.TRACE_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) throw new AccessError("حساب مدیر سامانه هنوز پیکربندی نشده است.", 503);
  if (email === ownerEmail) {
    // Bind the configured owner's first verified sign-in to this Site's stable subject.
    await storage().prepare("INSERT INTO app_identity (id, subject) VALUES ('owner', ?) ON CONFLICT(id) DO NOTHING").bind(identity.userId).run();
    const owner = await storage().prepare("SELECT subject FROM app_identity WHERE id = 'owner'").first<{subject: string}>();
    if (owner?.subject !== identity.userId) throw new AccessError("هویت مدیر با حساب ثبت‌شده تطابق ندارد.", 403);
    return {userId: identity.userId, email, name: identity.displayName, isAdmin: true, permissions: allPermissions};
  }
  const db = storage();
  const member = await db.prepare("SELECT * FROM app_members WHERE email = ? AND NOT EXISTS(SELECT 1 FROM password_accounts WHERE member_id=app_members.id)").bind(email).first<{id: string; name: string; status: string; subject: string | null; permissions: string}>();
  if (!member || member.status !== "active") throw new AccessError("برای حساب شما دسترسی فعال تعریف نشده است؛ با مدیر سامانه هماهنگ کنید.", 403);
  if (!member.subject) await db.prepare("UPDATE app_members SET subject = ? WHERE id = ? AND subject IS NULL AND status = 'active'").bind(identity.userId, member.id).run();
  const current = await db.prepare("SELECT subject, status, permissions FROM app_members WHERE id = ?").bind(member.id).first<{subject: string; status: string; permissions: string}>();
  if (!current || current.status !== "active" || current.subject !== identity.userId) throw new AccessError("حساب غیرفعال است یا هویت ورود تطابق ندارد.", 403);
  return {userId: identity.userId, email, name: member.name, isAdmin: false, permissions: validatePermissions(JSON.parse(current.permissions))};
}
export function can(user: Session, kind: Kind, operation: "read" | "write") {return user.isAdmin || user.permissions[operation].includes(kind);}
export async function requireAccess(kind?: Kind, operation: "read" | "write" = "read") {
  const user = await session();
  if(user.permissions.hospitalCenterId)throw new AccessError("این حساب فقط به پنل مرکز بیمارستانی دسترسی دارد.",403);
  if (kind && !can(user, kind, operation)) throw new AccessError("دسترسی این بخش برای حساب شما مجاز نیست.", 403);
  return user;
}
export async function requireAdmin() {const user = await session(); if (!user.isAdmin) throw new AccessError("مدیریت کاربران فقط برای مدیر سامانه مجاز است.", 403); return user;}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new AccessError("درخواست نامعتبر است؛ صفحه را دوباره باز کنید.", 403);
  const url = new URL(request.url);
  if (origin === url.origin) return;
  // Behind IIS reverse proxy the worker may see 127.0.0.1 while the browser Origin is the public HTTPS host.
  const forwardedHost = (request.headers.get("x-forwarded-host") || "").split(",")[0].trim();
  const forwardedProto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  if (forwardedHost) {
    const publicOrigin = `${forwardedProto}://${forwardedHost}`;
    if (origin === publicOrigin) return;
  }
  throw new AccessError("درخواست نامعتبر است؛ صفحه را دوباره باز کنید.", 403);
}
export function accessResponse(error: unknown): Response | null {
  if(String(error).includes("RESET_MAINTENANCE")) return Response.json({error:"سامانه برای پشتیبان‌گیری و پاک‌سازی در حالت نگهداری است؛ ثبت جدید موقتاً متوقف شده است."},{status:423,headers:{"Cache-Control":"no-store"}});
  return error instanceof AccessError ? Response.json({error: error.message}, {status: error.status, headers: {"Cache-Control": "no-store"}}) : null;
}

export async function requireFinance(write=false){const user=await session();if(!user.isAdmin&&!(write?user.permissions.finance==='write':['read','write'].includes(user.permissions.finance||'')))throw new AccessError('دسترسی کنترل مالی برای شما فعال نیست.',403);return user;}
