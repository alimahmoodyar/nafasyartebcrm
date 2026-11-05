import {AccessError,accessResponse,checkOrigin,requireRealAdmin} from '@/lib/authorization';
import {digest,newToken} from '@/lib/password-auth';
import {jobRoles,storedAccessPermissions} from '@/lib/permissions';
import {storage} from '@/lib/storage';
import {env} from 'cloudflare:workers';

function failure(error:unknown){return accessResponse(error)||Response.json({error:error instanceof Error?error.message:'عملیات انجام نشد.'},{status:500,headers:{'Cache-Control':'no-store'}})}
function roleIds(value:string){
 try{const p=storedAccessPermissions(value),assigned=p.roleAssignment?.roles||[];
  if(assigned.length)return assigned;
  return jobRoles.filter(role=>{const grants=Object.entries(role.grants).filter(([key,v])=>key!=='read'&&key!=='write'&&key!=='eventStages'&&Array.isArray(v)&&(v as unknown[]).length);return grants.length>0&&grants.every(([key,v])=>(v as unknown[]).every(item=>Array.isArray((p as any)[key])&&(p as any)[key].includes(item)));}).map(r=>r.id);
 }catch{return []}
}
export async function GET(){try{
 const admin=await requireRealAdmin(),db=storage();
 const result=await db.prepare("SELECT m.id,m.name,m.unit,m.email,m.permissions,a.username FROM app_members m LEFT JOIN password_accounts a ON a.member_id=m.id WHERE m.status='active' AND NOT EXISTS(SELECT 1 FROM app_identity i WHERE i.id='owner' AND (i.subject=m.id OR (m.subject IS NOT NULL AND i.subject=m.subject))) AND lower(m.email)!=lower(?) ORDER BY m.name COLLATE NOCASE").bind(env.TRACE_OWNER_EMAIL||'').all();
 const members=(result.results as any[]).map(m=>({id:m.id,name:m.name,unit:m.unit,username:m.username||'',roles:roleIds(m.permissions)}));
 return Response.json({members,roles:jobRoles.map(r=>({id:r.id,label:r.label,group:r.group,actions:r.actions,memberIds:members.filter(m=>m.roles.includes(r.id)).map(m=>m.id)})),accountId:admin.userId},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e)}}
export async function POST(request:Request){try{
 checkOrigin(request);const admin=await requireRealAdmin(),body=await request.json() as {memberId?:unknown};
 if(typeof body.memberId!=='string'||!body.memberId||body.memberId.length>200)throw new AccessError('حساب آزمایشی را انتخاب کنید.',400);
 const db=storage(),member:any=await db.prepare("SELECT id,name,unit FROM app_members WHERE id=? AND status='active' AND NOT EXISTS(SELECT 1 FROM app_identity i WHERE i.id='owner' AND (i.subject=app_members.id OR (app_members.subject IS NOT NULL AND i.subject=app_members.subject)))").bind(body.memberId).first();
 if(!member)throw new AccessError('این حساب فعال و قابل‌آزمایش نیست.',404);
 const token=newToken(),now=new Date(),expires=new Date(now.getTime()+4*60*60*1000).toISOString();
 await db.batch([
  db.prepare('INSERT INTO role_preview_sessions(token_hash,admin_id,admin_name,member_id,created,expires) VALUES(?,?,?,?,?,?)').bind(await digest(token),admin.userId,admin.name,member.id,now.toISOString(),expires),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),admin.userId,member.id,'role_preview_start',JSON.stringify({memberId:member.id,memberName:member.name,unit:member.unit,expires}),now.toISOString())
 ]);
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`__Host-nafasyar-role-preview=${token}; Path=/; Max-Age=14400; HttpOnly; Secure; SameSite=Lax`}});
 }catch(e){return failure(e)}}
export async function DELETE(request:Request){try{
 checkOrigin(request);const admin=await requireRealAdmin();let token='';try{token=(await (await import('next/headers')).cookies()).get('__Host-nafasyar-role-preview')?.value||''}catch{}
 const db=storage(),now=new Date().toISOString();
 if(token&&/^[a-f0-9]{64}$/.test(token)){
  const row:any=await db.prepare('SELECT member_id FROM role_preview_sessions WHERE token_hash=? AND admin_id=?').bind(await digest(token),admin.userId).first();
  if(row)await db.batch([
   db.prepare('DELETE FROM role_preview_sessions WHERE token_hash=? AND admin_id=?').bind(await digest(token),admin.userId),
   db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),admin.userId,row.member_id,'role_preview_end',JSON.stringify({memberId:row.member_id}),now)
  ]);
 }
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':'__Host-nafasyar-role-preview=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'}});
 }catch(e){return failure(e)}}
