import {AccessError} from './authorization';
import {asciiDigits} from './batch-number';
import {assetSmsReady,sendNafasyarSms} from './asset-sms';
import {digest,hashPassword,newToken,password,username,verifyPassword} from './password-auth';
import {rate} from './sms-rate';
import {storage} from './storage';

type Purpose='enroll'|'reset';
type Account={member_id:string;subject:string|null;username:string;password_hash:string;version:number;recovery_revision:number;recovery_mobile:string|null;recovery_backup_hash:string|null;admin:number};
type Challenge={token_hash:string;member_id:string;mobile:string;version:number;recovery_revision:number;proof:string};
const activeAccount=`SELECT a.member_id,a.username,a.password_hash,a.version,a.recovery_revision,a.recovery_mobile,a.recovery_backup_hash,m.subject,
 EXISTS(SELECT 1 FROM app_identity i WHERE i.id='local_admin' AND i.subject=m.id) AS admin
 FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE m.status='active' AND `;
const invalid=()=>new AccessError('کد یا درخواست بازیابی معتبر نیست یا منقضی شده است. دوباره بررسی کنید.',400);
function validateInput(read:()=>string){
 try{return read();}catch(error){
  throw new AccessError(error instanceof Error?error.message:'اطلاعات واردشده معتبر نیست.',400);
 }
}
const lookup=(field:'member_id'|'username',value:string)=>storage().prepare(activeAccount+'a.'+field+'=?').bind(value).first<Account>();
const backupProof=(code:string)=>digest('password-recovery-backup:'+code);
const normalizeBackup=(value:unknown)=>typeof value==='string'?asciiDigits(value.trim()).toLowerCase().replace(/[ -]/g,''):'';
const same=(a:string,b:string)=>{
 let diff=a.length^b.length;
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^(b.charCodeAt(i)||0);
 return diff===0;
};
export function recoveryMobile(value:unknown){
 const mobile=typeof value==='string'?asciiDigits(value).trim().replace(/[\s()-]/g,'').replace(/^(?:\+98|0098)/,'0'):'';
 if(!/^09\d{9}$/.test(mobile))throw new AccessError('شمارهٔ همراه را به شکل ۰۹ و ۱۱ رقم وارد کنید.',400);
 return mobile;
}
async function matchesBackup(account:Account,value:unknown){
 const code=normalizeBackup(value);
 return !!account.recovery_backup_hash&&/^[a-f0-9]{32}$/.test(code)&&same(await backupProof(code),account.recovery_backup_hash);
}
async function createBackup(admin:number){
 if(!admin)return {text:undefined,hash:null};
 const code=newToken().slice(0,32);
 return {text:code.match(/.{8}/g)!.join('-'),hash:await backupProof(code)};
}
function smsCode(){
 const sample=new Uint32Array(1);
 do{crypto.getRandomValues(sample);}while(sample[0]>=4294000000);
 return String(sample[0]%1000000).padStart(6,'0');
}

async function sendChallenge(account:Account,mobile:string,purpose:Purpose,token:string){
 const db=storage(),code=smsCode(),id=await digest(token),proof=await digest(token+':'+code);
 const now=new Date().toISOString(),expires=new Date(Date.now()+5*60000).toISOString();
 await db.prepare('DELETE FROM password_recovery_challenges WHERE token_hash IN (SELECT token_hash FROM password_recovery_challenges WHERE expires<=? LIMIT 30)').bind(now).run();
 const row=await db.prepare(`INSERT INTO password_recovery_challenges(token_hash,member_id,purpose,mobile,version,recovery_revision,proof,expires)
  SELECT ?,a.member_id,?,?,a.version,a.recovery_revision,?,? FROM password_accounts a JOIN app_members m ON m.id=a.member_id
  WHERE a.member_id=? AND a.version=? AND a.recovery_revision=? AND m.status='active'
  ON CONFLICT(member_id,purpose) DO UPDATE SET token_hash=excluded.token_hash,mobile=excluded.mobile,version=excluded.version,
  recovery_revision=excluded.recovery_revision,proof=excluded.proof,expires=excluded.expires,attempts=0,delivered=0`)
  .bind(id,purpose,mobile,proof,expires,account.member_id,account.version,account.recovery_revision).run();
 if(!row.meta.changes)throw invalid();
 await sendNafasyarSms(mobile,purpose==='reset'?'هم‌نفس\nکد بازیابی رمز: '+code+'\nاعتبار: ۵ دقیقه':'هم‌نفس\nکد تأیید شماره بازیابی: '+code+'\nاعتبار: ۵ دقیقه');
 await db.prepare('UPDATE password_recovery_challenges SET delivered=1 WHERE token_hash=?').bind(id).run();
}
export async function recoveryStatus(memberId:string){
 const account=await lookup('member_id',memberId);
 if(!account)throw new AccessError('حساب فعال یافت نشد.',401);
 return {mobileLast4:account.recovery_mobile?.slice(-4)||null,requiresBackup:!!account.admin};
}
export async function startEnrollment(memberId:string,input:{mobile?:unknown;currentPassword?:unknown;backupCode?:unknown}){
 const mobile=recoveryMobile(input.mobile);
 await rate('recovery-enroll-password',memberId,10,15*60000);
 const account=await lookup('member_id',memberId);
 if(!account||typeof input.currentPassword!=='string'||input.currentPassword.length>128||!await verifyPassword(input.currentPassword,account.password_hash))
  throw new AccessError('رمز فعلی صحیح نیست.',403);
 if(account.admin&&account.recovery_mobile&&mobile!==account.recovery_mobile&&!await matchesBackup(account,input.backupCode))
  throw new AccessError('برای تغییر شمارهٔ بازیابی مدیر اصلی، کد پشتیبان فعلی را وارد کنید.',403);
 if(await storage().prepare('SELECT 1 FROM password_accounts WHERE recovery_mobile=? AND member_id<>?').bind(mobile,memberId).first())
  throw new AccessError('این شماره برای بازیابی حساب دیگری ثبت شده است.',409);
 if(!await assetSmsReady())throw new AccessError('تنظیمات ارسال پیامک هنوز آماده نیست.',503);
 await rate('recovery-enroll-send',memberId,4,30*60000);
 await rate('recovery-enroll-destination',mobile,5,60*60000);
 const token=newToken();
 await sendChallenge(account,mobile,'enroll',token);
 return {token};
}
export async function startRecovery(input:{username?:unknown;mobile?:unknown},client:string){
 const name=validateInput(()=>username(input.username)),mobile=recoveryMobile(input.mobile),token=newToken();
 await rate('recovery-request-client',client,15,30*60000);
 const account=await lookup('username',name);
 if(account?.recovery_mobile!==mobile||account.admin&&!account.recovery_backup_hash)return {token};
 try{
  await rate('recovery-send',account.member_id,3,30*60000);
  await rate('recovery-global','all',100,60*60000);
  if(await assetSmsReady())await sendChallenge(account,mobile,'reset',token);
 }catch{/* The public response is identical for unknown accounts and undelivered messages. */}
 return {token};
}

async function consumeAttempt(input:{token?:unknown;code?:unknown},purpose:Purpose,memberId=''){
 const {token}=input,code=typeof input.code==='string'?asciiDigits(input.code).trim():'';
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!/^\d{6}$/.test(code))throw invalid();
 const id=await digest(token),now=new Date().toISOString();
 const challenge=await storage().prepare(`UPDATE password_recovery_challenges SET attempts=attempts+1
  WHERE token_hash=? AND purpose=? AND delivered=1 AND expires>? AND attempts<5 AND (?='' OR member_id=?)
  RETURNING token_hash,member_id,mobile,version,recovery_revision,proof`).bind(id,purpose,now,memberId,memberId).first<Challenge>();
 if(!challenge||!same(await digest(token+':'+code),challenge.proof))throw invalid();
 const account=await lookup('member_id',challenge.member_id);
 if(!account||account.version!==challenge.version||account.recovery_revision!==challenge.recovery_revision)throw invalid();
 return {account,challenge};
}
function guard(account:Account,challenge:Challenge,purpose:Purpose,op:string,now:string){
 return storage().prepare(`INSERT INTO inventory_operations(id,kind,payload,actor,created,guard)
  VALUES(?,'password_recovery','{}',?,?,CASE WHEN EXISTS(
   SELECT 1 FROM password_accounts a JOIN app_members m ON m.id=a.member_id
   JOIN password_recovery_challenges c ON c.member_id=a.member_id
   WHERE a.member_id=? AND m.status='active' AND a.version=c.version AND a.recovery_revision=c.recovery_revision
   AND c.token_hash=? AND c.purpose=? AND c.delivered=1 AND c.expires>?
  ) THEN 1 ELSE 0 END)`).bind(op,'local:'+account.member_id,now,account.member_id,challenge.token_hash,purpose,now);
}
export async function finishEnrollment(memberId:string,input:{token?:unknown;code?:unknown}){
 const {account,challenge}=await consumeAttempt(input,'enroll',memberId);
 const db=storage(),now=new Date().toISOString(),op=crypto.randomUUID(),backup=await createBackup(account.admin);
 await db.batch([
  guard(account,challenge,'enroll',op,now),
  db.prepare('UPDATE password_accounts SET recovery_mobile=?,recovery_backup_hash=?,recovery_revision=recovery_revision+1 WHERE member_id=?').bind(challenge.mobile,backup.hash,memberId),
  db.prepare('DELETE FROM password_recovery_challenges WHERE member_id=?').bind(memberId),
  db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,'recovery_mobile_verified','{}',?)").bind(op,'local:'+memberId,memberId,now),
 ]);
 return {mobileLast4:challenge.mobile.slice(-4),backupCode:backup.text};
}
export async function finishRecovery(input:{token?:unknown;code?:unknown;backupCode?:unknown;newPassword?:unknown},client:string){
 await rate('recovery-confirm-client',client,30,15*60000);
 const next=validateInput(()=>password(input.newPassword));
 const {account,challenge}=await consumeAttempt(input,'reset');
 if(account.recovery_mobile!==challenge.mobile||account.admin&&!await matchesBackup(account,input.backupCode))throw invalid();
 if(await verifyPassword(next,account.password_hash))throw new AccessError('رمز تازه باید با رمز فعلی متفاوت باشد.',400);
 const db=storage(),now=new Date().toISOString(),op=crypto.randomUUID();
 const local='local:'+account.member_id,subject=account.subject||account.member_id;
 const [hash,backup]=await Promise.all([hashPassword(next),createBackup(account.admin)]);
 await db.batch([
  guard(account,challenge,'reset',op,now),
  db.prepare('UPDATE password_accounts SET password_hash=?,password_ciphertext=NULL,must_change=0,password_changed_at=?,version=version+1,recovery_backup_hash=?,recovery_revision=recovery_revision+1 WHERE member_id=?').bind(hash,now,backup.hash,account.member_id),
  db.prepare('DELETE FROM password_sessions WHERE member_id=?').bind(account.member_id),
  db.prepare('UPDATE mcp_tokens SET revoked=1 WHERE subject IN (?,?,?)').bind(local,account.member_id,subject),
  db.prepare('DELETE FROM mcp_streams WHERE token_id IN (SELECT id FROM mcp_tokens WHERE subject IN (?,?,?))').bind(local,account.member_id,subject),
  db.prepare('DELETE FROM login_attempts WHERE key IN (?,?)').bind(await digest('user:'+account.username),await digest('credentials:'+account.member_id)),
  db.prepare('DELETE FROM password_recovery_challenges WHERE member_id=?').bind(account.member_id),
  db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,'password_recovery_completed','{}',?)").bind(op,local,account.member_id,now),
 ]);
 return {saved:true,backupCode:backup.text};
}
