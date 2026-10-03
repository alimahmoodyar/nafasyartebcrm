import {requireAdmin,AccessError,checkOrigin,accessResponse} from '@/lib/authorization';
import {mcpActor} from '@/lib/mcp/context';
import {storage} from '@/lib/storage';
import {verifyPassword} from '@/lib/password-auth';
import {openPassword} from '@/lib/password-vault';
import {boundedBody} from '@/lib/firmware-storage';
import {passwordJson as json,expectedPasswordAccount,checkPasswordProof} from '@/lib/password-controls';
// Plaintext is returned only to this explicit, reauthenticated admin browser action, never MCP or assistant.
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAdmin();expectedPasswordAccount(request,u.userId);
 if(mcpActor.getStore())throw new AccessError('نمایش رمز فقط از فرم امن مدیریت حساب‌ها مجاز است.',403);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,2000)));
 if(!b||b.confirmed!==true||typeof b.id!=='string'||!Number.isInteger(b.revision)||Object.keys(b).some(k=>!['id','revision','adminPassword','confirmed'].includes(k)))throw new AccessError('حساب و تأیید نمایش رمز لازم است.',400);
 const db=storage();
 const admin:any=await db.prepare("SELECT a.* FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE a.member_id=(SELECT subject FROM app_identity WHERE id='local_admin') AND m.status='active'").first();
 if(!admin)throw new AccessError('ابتدا حساب مدیر محلی را با نام کاربری و رمز راه‌اندازی کنید؛ نمایش رمز نیاز به رمز ورود مدیر محلی دارد.',409);
 if(u.authType==='password'&&u.userId!=='local:'+admin.member_id)throw new AccessError('حساب مدیر برای تأیید رمز تطابق ندارد.',403);
 await checkPasswordProof(b.adminPassword,admin.password_hash,'reveal:'+u.userId);
 const target:any=await db.prepare("SELECT a.*,m.name,m.revision FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE a.member_id=? AND m.status!='deleted'").bind(b.id).first();
 if(!target)throw new AccessError('حساب رمزدار یافت نشد.',404);
 if(target.revision!==b.revision)throw new AccessError('اطلاعات حساب تغییر کرده است؛ فهرست را تازه کنید.',409);
 if(!target.password_ciphertext)throw new AccessError('رمز قدیمی قابل بازیابی نیست؛ پس از تغییر یا بازنشانی رمز، رمز جدید قابل نمایش است.',409);
 const revealed=await openPassword(target.password_ciphertext,target.member_id);
 if(!await verifyPassword(revealed,target.password_hash))throw new AccessError('رمز نگهداری‌شده با رمز ورود فعلی تطابق ندارد؛ رمز را بازنشانی کنید.',409);
 const result=await db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) SELECT ?,?,?,'view_member_password',?,? FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE a.member_id=? AND a.version=? AND m.revision=? AND m.status!='deleted' AND EXISTS(SELECT 1 FROM password_accounts proof JOIN app_members p ON p.id=proof.member_id WHERE proof.member_id=? AND proof.version=? AND p.status='active')").bind(crypto.randomUUID(),u.userId,target.member_id,JSON.stringify({version:target.version}),new Date().toISOString(),target.member_id,target.version,target.revision,admin.member_id,admin.version).run();
 if(!result.meta.changes)throw new AccessError('حساب هنگام بررسی تغییر کرد؛ فهرست را تازه کنید.',409);
 return json({password:revealed,name:target.name,username:target.username,clearAfterSeconds:30});
}catch(e){return accessResponse(e)||json({error:'نمایش رمز انجام نشد؛ دوباره تلاش کنید.'},503);}}
