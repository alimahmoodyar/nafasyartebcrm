import {storage} from '@/lib/storage';
import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {username,password,hashPassword} from '@/lib/password-auth';
import {salesManager} from '@/lib/sales';
import {boundedBody} from '@/lib/firmware-storage';
import {validatePermissions} from '@/lib/permissions';

async function scope(){const actor=await requireAccess();if(!salesManager(actor))throw new AccessError('فقط مدیر فروش می‌تواند حساب نماینده بسازد.',403);return actor;}
function failure(e:unknown){return accessResponse(e)||Response.json({error:/UNIQUE/.test(String(e))?'این نام کاربری یا شناسه درخواست قبلاً استفاده شده است.':'ثبت حساب انجام نشد؛ ورودی‌ها را بررسی و دوباره تلاش کنید.'},{status:/UNIQUE/.test(String(e))?409:400});}
export async function GET(request:Request){try{
  await scope();
  const rows=await storage().prepare("SELECT m.id,m.name,m.status,a.username,json_extract(m.permissions,'$.salesAgentId') AS agentId FROM app_members m JOIN password_accounts a ON a.member_id=m.id WHERE m.status!='deleted' AND json_extract(m.permissions,'$.salesRoles')='[\"agent\"]' ORDER BY m.created DESC").all();
  return Response.json({accounts:rows.results},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
  checkOrigin(request);
  const raw=new TextDecoder().decode(await boundedBody(request,4096));
  const b=JSON.parse(raw);const actor=await scope();
  if(request.headers.get('x-assistant-account')&&request.headers.get('x-assistant-account')!==actor.userId)throw new AccessError('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.',409);
  if(Object.keys(b).some(k=>!['id','agentId','revision','name','username','password','confirmed'].includes(k)))throw new AccessError('سطح دسترسی نماینده ثابت است و قابل افزایش نیست.',400);
  if(b.confirmed!==true||typeof b.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id)||!Number.isInteger(b.revision)||typeof b.agentId!=='string'||typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>100)throw new AccessError('نماینده، نام و تأیید ساخت حساب لازم است.',400);
  const login=username(b.username),name=b.name.trim(),db=storage();
  const agent:any=await db.prepare("SELECT data,revision FROM flow_entities WHERE id=? AND type='sales_agent'").bind(b.agentId).first();
  if(!agent)throw new AccessError('نماینده در این حوزه یافت نشد.',404);
  if(!JSON.parse(agent.data).active)throw new AccessError('ابتدا نمایندگی را فعال کنید.',409);
  const summary=JSON.stringify({name,username:login,agentId:b.agentId});
  const prior:any=await db.prepare('SELECT actor,action,after FROM access_audit WHERE id=?').bind('sales-account:'+b.id).first();
  if(prior){if(prior.actor!==actor.userId||prior.action!=='create_sales_agent_account'||prior.after!==summary)throw new AccessError('شناسه درخواست با اطلاعات دیگری ثبت شده است.',409);return Response.json({id:b.id,username:login,repeated:true});}
  if(agent.revision!==b.revision)throw new AccessError('نمایندگی تغییر کرده است؛ فهرست را تازه کنید.',409);
  const hashed=await hashPassword(password(b.password));
  const permissions=JSON.stringify(validatePermissions({read:[],write:[],eventStages:[],finance:'none',salesRoles:['agent'],salesAgentId:b.agentId}));
  const now=new Date().toISOString();
  // Revision/active guard and FK constraints make account, credential and audit atomic.
  await db.batch([
    db.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,revision,created,updated) SELECT ?,?,?,?,'active',?,1,?,? FROM flow_entities WHERE id=? AND type='sales_agent' AND revision=? AND json_extract(data,'$.active')=1").bind(b.id,b.id+'@local.invalid',name,'نماینده فروش',permissions,now,now,b.agentId,b.revision),
    db.prepare('INSERT INTO password_accounts(member_id,username,password_hash,version) VALUES(?,?,?,1)').bind(b.id,login,hashed),
    db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind('sales-account:'+b.id,actor.userId,b.id,'create_sales_agent_account',summary,now),
  ]);
  return Response.json({id:b.id,username:login},{status:201,headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
