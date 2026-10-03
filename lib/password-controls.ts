import {storage} from './storage';
import {AccessError} from './authorization';
import {digest,verifyPassword} from './password-auth';
export const passwordJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer'}});
export function expectedPasswordAccount(request:Request,accountId:string){const expected=request.headers.get('x-assistant-account');if(expected&&expected!==accountId)throw new AccessError('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.',409);}
export async function checkPasswordProof(value:unknown,hash:string,rateKey:string){
 if(typeof value!=='string'||!value||value.length>128)throw new AccessError('رمز فعلی معتبر را وارد کنید.',400);
 const db=storage(),now=new Date().toISOString(),key=await digest('password-proof:'+rateKey);
 const count:any=await db.prepare('INSERT INTO login_attempts(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<=? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<=? THEN excluded.reset ELSE reset END RETURNING count').bind(key,new Date(Date.now()+15*60000).toISOString(),now,now).first();
 if(count.count>5)throw new AccessError('تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه دیگر امتحان کنید.',429);
 if(!await verifyPassword(value,hash))throw new AccessError('رمز فعلی صحیح نیست.',403);
 await db.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
}
