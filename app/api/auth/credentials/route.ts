import {session,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {username,password,verifyPassword,hashPassword,digest,cookieName} from '@/lib/password-auth';
import {boundedBody} from '@/lib/firmware-storage';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
export async function POST(request:Request){try{
 checkOrigin(request);const u=await session(true);
 if(u.authType!=='password'||!u.userId.startsWith('local:'))throw new AccessError('این حساب ورود با رمز محلی ندارد.',403);
 if(request.headers.get('x-profile-account')!==u.userId)throw new AccessError('حساب تغییر کرده؛ صفحه را تازه کنید.',409);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,2048)));
 if(b.confirmed!==true||Object.keys(b).some(k=>!['username','currentPassword','newPassword','confirmed'].includes(k)))throw new AccessError('اطلاعات تغییر ورود معتبر نیست.',400);
 const memberId=u.userId.slice(6),db=storage(),now=new Date().toISOString(),row:any=await db.prepare("SELECT a.* FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE a.member_id=? AND m.status='active'").bind(memberId).first();
 if(!row)throw new AccessError('حساب فعال یافت نشد.',401);
 const rateKey=await digest('credentials:'+memberId),reset=new Date(Date.now()+15*60000).toISOString();
 const count:any=await db.prepare('INSERT INTO login_attempts(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<=? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<=? THEN excluded.reset ELSE reset END RETURNING count').bind(rateKey,reset,now,now).first();
 if(count.count>10)throw new AccessError('تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه دیگر امتحان کنید.',429);
 if(typeof b.currentPassword!=='string'||b.currentPassword.length>128||!await verifyPassword(b.currentPassword,row.password_hash))throw new AccessError('رمز فعلی صحیح نیست.',403);
 const login=username(b.username),next=b.newPassword===''&&!row.must_change?'':password(b.newPassword);
 if(next&&await verifyPassword(next,row.password_hash))throw new AccessError('رمز تازه باید با رمز فعلی متفاوت باشد.',400);
 if(!next&&login===row.username)throw new AccessError('نام کاربری یا رمز تازه‌ای تعیین کنید.',400);
 const hash=next?await hashPassword(next):row.password_hash,op=crypto.randomUUID();
 await db.batch([
 db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'own_credentials','{}',?,?,CASE WHEN EXISTS(SELECT 1 FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE a.member_id=? AND a.version=? AND a.password_hash=? AND m.status='active') THEN 1 ELSE 0 END)").bind(op,u.userId,now,memberId,row.version,row.password_hash),
 db.prepare('UPDATE password_accounts SET username=?,password_hash=?,password_ciphertext=NULL,must_change=0,password_changed_at=?,version=version+1 WHERE member_id=?').bind(login,hash,now,memberId),
 db.prepare('DELETE FROM password_sessions WHERE member_id=?').bind(memberId),
 db.prepare('UPDATE mcp_tokens SET revoked=1 WHERE subject=? OR subject=?').bind(u.userId,memberId),
 db.prepare('DELETE FROM mcp_streams WHERE token_id IN (SELECT id FROM mcp_tokens WHERE subject=? OR subject=?)').bind(u.userId,memberId),
 db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(op,u.userId,memberId,'change_own_credentials',JSON.stringify({usernameChanged:login!==row.username,passwordChanged:!!next}),now),
 db.prepare('DELETE FROM login_attempts WHERE key=?').bind(rateKey)
 ]);
 return Response.json({saved:true,reauthenticate:true},{headers:{...headers,'Set-Cookie':cookieName+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'}});
 }catch(e){return accessResponse(e)||Response.json({error:/UNIQUE/.test(String(e))?'این نام کاربری قبلاً استفاده شده است.':e instanceof Error&&!/D1|SQLITE|constraint/.test(e.message)?e.message:'حساب هم‌زمان تغییر کرده؛ دوباره وارد شوید.'},{status:/UNIQUE/.test(String(e))?409:400,headers});}}
