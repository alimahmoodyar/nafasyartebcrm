import {AccessError} from './authorization';
import {hashPassword} from './password-auth';
import {validatePermissions} from './permissions';
export const representativeDigits=(v:unknown)=>String(v??'').trim().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
export function representativeIdentity(national:unknown,mobile:unknown){
 const nationalId=representativeDigits(national),phone=representativeDigits(mobile).replace(/[\s()-]/g,'').replace(/^\+98/,'0').replace(/^0098/,'0');
 if(!/^\d{10}$/.test(nationalId)||/^(\d)\1{9}$/.test(nationalId))throw new AccessError('کد ملی مسئول نمایندگی باید ۱۰ رقم باشد و همه ارقام یکسان نباشند.',400);
 if(!/^09\d{9}$/.test(phone))throw new AccessError('شماره موبایل مسئول نمایندگی باید ۱۱ رقم و با ۰۹ شروع شود.',400);
 return {nationalId,mobile:phone};
}
// Appended to the caller's business transaction: failure leaves neither an orphan account nor an orphan representative.
export async function automaticRepresentativeAccount(db:D1Database,args:{agentId:string;name:string;nationalId:unknown;mobile:unknown;kind:'sales'|'service';domain?:string;active:boolean},actor:string,now:string){
 const identity=representativeIdentity(args.nationalId,args.mobile),memberId=crypto.randomUUID();
 if(await db.prepare('SELECT member_id FROM password_accounts WHERE username=?').bind(identity.nationalId).first())throw new AccessError('این کد ملی قبلاً حساب ورود دارد؛ حساب موجود را بررسی کنید.',409);
 const p=validatePermissions({roleAssignment:args.kind==='sales'?{roles:['sales_agent'],salesAgentId:args.agentId}:{roles:['service_agent'],serviceAgentId:args.agentId,serviceDomains:[args.domain!]}});
 const statements=[
 db.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,revision,created,updated) VALUES(?,?,?,?,?,?,1,?,?)").bind(memberId,memberId+'@local.invalid',args.name,args.kind==='sales'?'نماینده فروش':'نماینده خدمات',args.active?'active':'disabled',JSON.stringify(p),now,now),
 db.prepare('INSERT INTO password_accounts(member_id,username,password_hash,version,must_change) VALUES(?,?,?,1,1)').bind(memberId,identity.nationalId,await hashPassword(identity.mobile)),
 db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,memberId,'automatic_representative_account',JSON.stringify({agentId:args.agentId,kind:args.kind,mustChangePassword:true}),now)
 ];
 return {statements,identity,summary:{created:true,memberId,username:identity.nationalId,mustChangePassword:true}};
}

export async function initialRepresentativeAccount(db:D1Database,agentId:string,kind:'sales'|'service'){
 const key=kind==='sales'?'salesAgentId':'serviceAgentId';
 const r:any=await db.prepare("SELECT a.username,a.must_change,a.member_id FROM password_accounts a JOIN app_members m ON m.id=a.member_id WHERE json_extract(m.permissions,?)=? AND m.status!='deleted' AND EXISTS(SELECT 1 FROM access_audit x WHERE x.target=m.id AND x.action='automatic_representative_account') ORDER BY m.created LIMIT 1").bind('$.'+key,agentId).first();
 return r?{created:true,memberId:r.member_id,username:r.username,mustChangePassword:!!r.must_change}:null;
}

export function representativePublic(r:any,canCopyInitial:boolean){
 if(canCopyInitial)return r;
 const {nationalId,mobile,...data}=r.data;return {...r,data};
}
