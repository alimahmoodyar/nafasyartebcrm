import {session,AccessError,checkOrigin,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {password,hashPassword,verifyPassword,cookieName} from '@/lib/password-auth';
import {sealPassword} from '@/lib/password-vault';
import {boundedBody} from '@/lib/firmware-storage';
import {passwordJson as json,expectedPasswordAccount,checkPasswordProof} from '@/lib/password-controls';
export async function GET(){try{const u=await session({allowPasswordChange:true});return json({accountId:u.userId,username:u.username||'',canChange:u.authType==='password',mustChangePassword:!!u.mustChangePassword,adminCanViewNewPassword:true,section:'my-account',notice:'مدیر سامانه با تأیید مجدد هویت و ثبت سابقه می‌تواند رمز جدید را مشاهده کند. رمز مخصوص این سامانه انتخاب کنید.'});}catch(e){return accessResponse(e)||json({error:'دریافت وضعیت رمز انجام نشد.'},503);}}
export async function POST(request:Request){try{
 checkOrigin(request);const u=await session({allowPasswordChange:true});expectedPasswordAccount(request,u.userId);
 if(u.authType!=='password'||!u.userId.startsWith('local:'))throw new AccessError('این حساب از ورود قدیمی استفاده می‌کند؛ رمز محلی ندارد.',400);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,3000)));
 if(!b||typeof b!=='object'||Object.keys(b).some(k=>!['currentPassword','newPassword','repeatPassword','confirmed'].includes(k))||b.confirmed!==true)throw new AccessError('اطلاعات و تأیید تغییر رمز معتبر لازم است.',400);
 password(b.newPassword);if(b.newPassword!==b.repeatPassword)throw new AccessError('رمز جدید و تکرار آن یکسان نیستند.',400);
 const db=storage(),memberId=u.userId.slice(6);
 const old:any=await db.prepare("SELECT a.*,m.revision AS member_revision FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE a.member_id=? AND m.status='active'").bind(memberId).first();
 if(!old)throw new AccessError('حساب فعال یافت نشد.',401);
 await checkPasswordProof(b.currentPassword,old.password_hash,'self:'+u.userId);
 if(await verifyPassword(b.newPassword,old.password_hash))throw new AccessError('رمز جدید باید با رمز فعلی متفاوت باشد.',400);
 const hash=await hashPassword(b.newPassword),cipher=await sealPassword(b.newPassword,memberId),now=new Date().toISOString(),auditId=crypto.randomUUID();
 const gate='EXISTS(SELECT 1 FROM access_audit WHERE id=?)';
 const results=await db.batch([
  db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) SELECT ?,?,?,'change_own_password',?,? FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE a.member_id=? AND a.version=? AND m.revision=? AND m.status='active'").bind(auditId,u.userId,memberId,JSON.stringify({version:old.version+1,mustChangePassword:false}),now,memberId,old.version,old.member_revision),
  db.prepare('UPDATE password_accounts SET password_hash=?,password_ciphertext=?,must_change=0,password_changed_at=?,version=version+1 WHERE member_id=? AND '+gate).bind(hash,cipher,now,memberId,auditId),
  db.prepare('UPDATE app_members SET revision=revision+1,updated=? WHERE id=? AND '+gate).bind(now,memberId,auditId),
  db.prepare('DELETE FROM password_sessions WHERE member_id=? AND '+gate).bind(memberId,auditId),
  db.prepare('UPDATE mcp_tokens SET revoked=1 WHERE subject=? AND '+gate).bind(u.userId,auditId),
  db.prepare('DELETE FROM mcp_streams WHERE token_id IN (SELECT id FROM mcp_tokens WHERE subject=?) AND '+gate).bind(u.userId,auditId)
 ]);
 if(!results[0].meta.changes)throw new AccessError('حساب هم‌زمان تغییر کرده است؛ دوباره وارد شوید و وضعیت را بررسی کنید.',409);
 return Response.json({changed:true,reauthenticate:true},{headers:{'Cache-Control':'private, no-store','Set-Cookie':cookieName+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'}});
}catch(e){return accessResponse(e)||json({error:'تغییر رمز انجام نشد؛ اطلاعات و تنظیمات سرور را بررسی کنید.'},503);}}
