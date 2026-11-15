import {AccessError} from './authorization';
import {storedAccessPermissions,type Session} from './permissions';
import {accountingRoles} from './accounting-contract';
import type {DetailGuard} from './accounting-details';
/** Re-evaluate ordinary members and pin authorization in the same financial batch. */
export async function accountingAccessGuard(db:D1Database,user:Session,configure:boolean|'read'=false):Promise<DetailGuard[]>{
 if(user.userId==='system:accounting'&&!user.isAdmin&&!user.profileReview&&!user.rolePreview)return [];
 if(user.isAdmin)return [];
 if(user.profileReview)return [{condition:"EXISTS(SELECT 1 FROM app_identity WHERE id='owner' AND subject=?)",args:[user.userId]}];
 const member:any=await db.prepare('SELECT id,subject,status,permissions,revision FROM app_members WHERE subject=? OR ?=\'local:\'||id LIMIT 1').bind(user.userId,user.userId).first();
 if(!member||member.status!=='active')throw new AccessError('حساب مالی غیرفعال یا تغییر کرده است.',403);
 const roles=accountingRoles({...user,permissions:storedAccessPermissions(member.permissions)});if((configure==='read'?!roles.read:!roles.write)||configure===true&&!roles.configure)throw new AccessError('اختیار حسابداری تغییر کرده است.',403);
 return [{condition:"EXISTS(SELECT 1 FROM app_members WHERE id=? AND status='active' AND revision=? AND permissions=? AND subject IS ?)",args:[member.id,member.revision,member.permissions,member.subject]}];
}
