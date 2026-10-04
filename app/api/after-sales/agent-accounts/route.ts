import {storage} from '@/lib/storage';
import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {username,password,hashPassword} from '@/lib/password-auth';
import {validatePermissions} from '@/lib/permissions';

async function scope(domain:string) {
  const actor=await requireAccess();
  if(!['home','hospital'].includes(domain))throw new AccessError('حوزه خدمات معتبر نیست.',400);
  if(!actor.isAdmin&&(!actor.permissions.serviceRoles?.includes('manager')||actor.permissions.serviceAgentId||!actor.permissions.serviceDomains?.includes(domain)))throw new AccessError('فقط مدیر خدمات همین حوزه می‌تواند حساب نماینده بسازد.',403);
  return actor;
}
function failure(e:unknown){return accessResponse(e)||Response.json({error:/UNIQUE/.test(String(e))?'این نام کاربری یا شناسه درخواست قبلاً استفاده شده است.':'ثبت حساب انجام نشد؛ ورودی‌ها را بررسی و دوباره تلاش کنید.'},{status:/UNIQUE/.test(String(e))?409:400});}
export async function GET(request:Request){try{
  const domain=new URL(request.url).searchParams.get('domain')||'';await scope(domain);
  const rows=await storage().prepare("SELECT m.id,m.name,m.status,a.username,json_extract(m.permissions,'$.serviceAgentId') AS agentId FROM app_members m JOIN password_accounts a ON a.member_id=m.id JOIN flow_entities f ON f.id=json_extract(m.permissions,'$.serviceAgentId') AND f.type='as_agent' WHERE m.status!='deleted' AND json_extract(f.data,'$.domain')=? AND json_extract(m.permissions,'$.serviceRoles')='[\"agent\"]' AND json_extract(m.permissions,'$.serviceDomains')=? ORDER BY m.created DESC").bind(domain,JSON.stringify([domain])).all();
  return Response.json({accounts:rows.results},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
  checkOrigin(request);
  const raw=await request.text();if(raw.length>4096)throw new AccessError('درخواست بیش از حد بزرگ است.',413);
  const b=JSON.parse(raw);const actor=await scope(b.domain);
  if(request.headers.get('x-assistant-account')&&request.headers.get('x-assistant-account')!==actor.userId)throw new AccessError('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.',409);
  if(Object.keys(b).some(k=>!['id','domain','agentId','revision','name','username','password','confirmed'].includes(k)))throw new AccessError('سطح دسترسی نماینده ثابت است و قابل افزایش نیست.',400);
  if(b.confirmed!==true||typeof b.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.id)||!Number.isInteger(b.revision)||typeof b.agentId!=='string'||typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>100)throw new AccessError('نماینده، نام و تأیید ساخت حساب لازم است.',400);
  const login=username(b.username),name=b.name.trim(),db=storage();
  const agent:any=await db.prepare("SELECT data,revision FROM flow_entities WHERE id=? AND type='as_agent'").bind(b.agentId).first();
  if(!agent||JSON.parse(agent.data).domain!==b.domain)throw new AccessError('نماینده در این حوزه یافت نشد.',404);
  if(!JSON.parse(agent.data).active)throw new AccessError('ابتدا نمایندگی را فعال کنید.',409);
  const summary=JSON.stringify({name,username:login,agentId:b.agentId,domain:b.domain});
  const prior:any=await db.prepare('SELECT actor,action,after FROM access_audit WHERE id=?').bind('service-account:'+b.id).first();
  if(prior){if(prior.actor!==actor.userId||prior.action!=='create_service_agent_account'||prior.after!==summary)throw new AccessError('شناسه درخواست با اطلاعات دیگری ثبت شده است.',409);return Response.json({id:b.id,username:login,repeated:true});}
  if(agent.revision!==b.revision)throw new AccessError('نمایندگی تغییر کرده است؛ فهرست را تازه کنید.',409);
  const hashed=await hashPassword(password(b.password));
  const permissions=JSON.stringify(validatePermissions({read:[],write:[],eventStages:[],finance:'none',serviceRoles:['agent'],serviceDomains:[b.domain],serviceAgentId:b.agentId}));
  const now=new Date().toISOString();
  // Revision/active guard and FK constraints make account, credential and audit atomic.
  await db.batch([
    db.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,revision,created,updated) SELECT ?,?,?,?,'active',?,1,?,? FROM flow_entities WHERE id=? AND type='as_agent' AND revision=? AND json_extract(data,'$.active')=1 AND json_extract(data,'$.domain')=?").bind(b.id,b.id+'@local.invalid',name,'نماینده خدمات — '+(b.domain==='home'?'خانگی':'بیمارستانی'),permissions,now,now,b.agentId,b.revision,b.domain),
    db.prepare('INSERT INTO password_accounts(member_id,username,password_hash,version) VALUES(?,?,?,1)').bind(b.id,login,hashed),
    db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind('service-account:'+b.id,actor.userId,b.id,'create_service_agent_account',summary,now),
  ]);
  return Response.json({id:b.id,username:login},{status:201,headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
