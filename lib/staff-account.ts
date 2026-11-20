import {hashPassword,username} from './password-auth';
import {validatePermissions} from './permissions';
import {contactPatch,contactRevisionGuard,memberContactWrite} from './member-contact';
import {storage} from './storage';
import {AccessError} from './authorization';
/** HR approval may provision personal access only; job roles remain administrator-owned. */
export async function approvedStaffAccount(profile:any,members:any[],actor:{userId:string},op:string,now:string){
 const d=profile.data,db=storage(),existing=members.find(m=>m.id===d.memberId);
 if(existing)return {statements:[] as D1PreparedStatement[],summary:{state:existing.status==='deleted'?'needs_restore':'linked',memberId:existing.id,at:now}};
 const login=username(String(d.nationalId||'').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))),mobile=contactPatch({mobile:d.mobile}).mobile;
 if(!/^\d{10}$/.test(login)||!mobile)throw new AccessError('کد ملی ده‌رقمی و موبایل معتبر برای ساخت حساب لازم است.',400);
 const collision:any=await db.prepare("SELECT a.member_id FROM password_accounts a WHERE a.username=?").bind(login).first();
 if(collision)return {statements:[] as D1PreparedStatement[],summary:{state:'needs_link',at:now,reason:'نام کاربری قبلاً وجود دارد؛ مدیر سامانه باید هویت و اتصال حساب قبلی را بررسی کند.'}};
 const p=JSON.stringify(validatePermissions({read:[],write:[],eventStages:[]}));
 return {summary:{state:'created',memberId:d.memberId,username:login,mustChangePassword:true,at:now},statements:[
 contactRevisionGuard(db,op,d.memberId,0),
 db.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,revision,created,updated) VALUES(?,?,?,?,'active',?,1,?,?)").bind(d.memberId,d.memberId+'@local.invalid',d.name,d.unit||'کارکنان',p,now,now),
 db.prepare('INSERT INTO password_accounts(member_id,username,password_hash,version,must_change) VALUES(?,?,?,1,1)').bind(d.memberId,login,await hashPassword(mobile)),
 memberContactWrite(db,d.memberId,{mobile,contactEmail:''},now),
 db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,'automatic_staff_account',?,?)").bind(crypto.randomUUID(),actor.userId,d.memberId,JSON.stringify({personnelId:profile.id,username:login,mustChangePassword:true,personalAccessOnly:true}),now)
 ]};
}
