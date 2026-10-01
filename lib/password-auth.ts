import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {storage} from './storage';
import {allPermissions,validatePermissions,type Session} from './permissions';
export const cookieName='__Host-nafasyar-session';
export function username(value:unknown){const v=typeof value==='string'?value.trim().toLowerCase():'';if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(v))throw new Error('نام کاربری باید ۳ تا ۴۰ حرف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.');return v;}
export function password(value:unknown){if(typeof value!=='string'||value.length<10||value.length>128)throw new Error('رمز عبور باید بین ۱۰ تا ۱۲۸ نویسه باشد.');return value;}
const hex=(b:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(b)).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function digest(v:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));}
export async function hashPassword(p:string,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));return 'pbkdf2-sha256$100000$'+salt+'$'+hash;}
export async function verifyPassword(p:string,encoded:string){const salt=encoded.split('$')[2]||'00000000000000000000000000000000';const check=await hashPassword(p,salt);let mismatch=check.length^encoded.length;for(let i=0;i<check.length;i++)mismatch|=check.charCodeAt(i)^(encoded.charCodeAt(i)||0);return mismatch===0;}
export async function localSession():Promise<Session|null|undefined>{let token:string|undefined;try{token=(await cookies()).get(cookieName)?.value;}catch{return undefined;}if(!token)return undefined;if(!/^[a-f0-9]{64}$/.test(token))return null;const row:any=await storage().prepare("SELECT m.*,a.username,EXISTS(SELECT 1 FROM app_identity i WHERE i.id='local_admin' AND i.subject=m.id) AS admin FROM password_sessions s JOIN password_accounts a ON a.member_id=s.member_id AND a.version=s.version JOIN app_members m ON m.id=s.member_id WHERE s.hash=? AND s.expires>? AND m.status='active'").bind(await digest(token),new Date().toISOString()).first();if(!row)return null;return {userId:'local:'+row.id,email:'',name:row.name,isAdmin:!!row.admin,permissions:row.admin?allPermissions:validatePermissions(JSON.parse(row.permissions)),username:row.username,authType:'password'};}
export const newToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));

// Only an installation secret may bootstrap the first local administrator.
export async function bootstrapAdmin(login:string, supplied:string){
 const initial=env.INITIAL_ADMIN_PASSWORD;
 if(login!=='admin'||!initial||initial.length<10)return;
 const db=storage();if(await db.prepare("SELECT subject FROM app_identity WHERE id='local_admin'").first())return;
 if(await digest(supplied)!==await digest(initial))return;
 if(await db.prepare('SELECT member_id FROM password_accounts WHERE username=?').bind(login).first())return;
 const id='bootstrap-local-admin',now=new Date().toISOString(),hash=await hashPassword(initial);
 await db.batch([
 db.prepare("INSERT OR IGNORE INTO app_members(id,email,name,unit,status,permissions,revision,created,updated) VALUES(?,?,'مدیر سامانه','مدیریت','active',?,1,?,?)").bind(id,id+'@local.invalid',JSON.stringify(allPermissions),now,now),
 db.prepare('INSERT OR IGNORE INTO password_accounts(member_id,username,password_hash,version) VALUES(?,?,?,1)').bind(id,login,hash),
 db.prepare("INSERT OR IGNORE INTO app_identity(id,subject) SELECT 'local_admin',member_id FROM password_accounts WHERE member_id=? AND username=?").bind(id,login)
 ]);
}
export async function localPrincipal(id:string):Promise<Session|null>{
 const row:any=await storage().prepare("SELECT m.*,a.username,EXISTS(SELECT 1 FROM app_identity i WHERE i.id='local_admin' AND i.subject=m.id) AS admin FROM app_members m JOIN password_accounts a ON a.member_id=m.id WHERE m.id=? AND m.status='active'").bind(id).first();
 return row?{userId:'local:'+row.id,email:'',name:row.name,isAdmin:!!row.admin,permissions:row.admin?allPermissions:validatePermissions(JSON.parse(row.permissions)),username:row.username,authType:'password'}:null;
}
