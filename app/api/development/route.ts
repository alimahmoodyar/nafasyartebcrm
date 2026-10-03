import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {boundedBody} from '@/lib/firmware-storage';
import {memberId,taskRequired,taskText} from '@/lib/duties';
import {inboxAssistantExecution} from '@/lib/inbox';
import {developmentFields,developmentKinds,developmentStates,developmentCopy,developmentHelp,type DevelopmentRequest} from '@/lib/development-contract';
import type {Session} from '@/lib/permissions';

const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const decode=(r:any):DevelopmentRequest=>({...r,data:JSON.parse(r.data)});
async function owner(u:Session){return await memberId(u)||u.userId;}
function account(request:Request,u:Session){const expected=request.headers.get('x-assistant-account');if(expected&&expected!==u.userId)fail('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.',409);}
async function access(id:string,u:Session,me:string){const r:any=await storage().prepare("SELECT * FROM flow_entities WHERE type='development_request' AND id=?").bind(id).first();if(!r||!u.isAdmin&&JSON.parse(r.data).owner!==me)fail('درخواست پیدا نشد یا دسترسی ندارید.',404);return decode(r);}
function keys(b:any,allowed:string[]){if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!allowed.includes(k)))fail('فیلد درخواست معتبر نیست.');}
async function summary(u:Session,me:string){return await storage().prepare("SELECT COUNT(*) AS total,COALESCE(SUM(json_extract(data,'$.state')='new'),0) AS fresh,COALESCE(SUM(json_extract(data,'$.state')='needs_info'),0) AS needsInfo FROM flow_entities WHERE type='development_request' AND (?=1 OR json_extract(data,'$.owner')=?)").bind(u.isAdmin?1:0,me).first();}

export async function GET(request:Request){try{
 const u=await requireAccess();account(request,u);const me=await owner(u),db=storage(),q=new URL(request.url).searchParams;
 if(q.get('view')==='guide')return json({accountId:u.userId,help:developmentHelp,fields:developmentFields,kinds:developmentKinds,states:developmentStates});
 const totals:any=await summary(u,me),base={accountId:u.userId,admin:u.isAdmin,summary:{...totals,attention:u.isAdmin?totals.fresh:totals.needsInfo}};
 if(q.get('view')==='summary')return json(base);
 if(q.get('requestId')){const r=await access(q.get('requestId')!,u,me);return json({...base,request:r,copyText:developmentCopy(r)});}
 const state=q.get('state')||'',query=(q.get('query')||'').trim().slice(0,180),offset=Number(q.get('offset')||0);
 if(state&&!Object.hasOwn(developmentStates,state)||!Number.isInteger(offset)||offset<0||offset>1000000)fail('فیلتر معتبر نیست.');
 const where="type='development_request' AND (?=1 OR json_extract(data,'$.owner')=?) AND (?='' OR json_extract(data,'$.state')=?) AND (?='' OR instr(lower(json_extract(data,'$.title')||' '||json_extract(data,'$.requester')||' '||json_extract(data,'$.section')),lower(?))>0)",args=[u.isAdmin?1:0,me,state,state,query,query];
 const count:any=await db.prepare('SELECT COUNT(*) AS n FROM flow_entities WHERE '+where).bind(...args).first();
 const rows=(await db.prepare('SELECT * FROM flow_entities WHERE '+where+' ORDER BY updated DESC,id DESC LIMIT 50 OFFSET ?').bind(...args,offset).all()).results.map(decode);
 return json({...base,requests:rows,total:count.n,nextOffset:offset+rows.length<count.n?offset+rows.length:null});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت درخواست‌ها ممکن نشد؛ دوباره تلاش کنید.'},{status:503})}}

export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();account(request,u);const me=await owner(u),db=storage(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,60000)));
 const mode=b?.mode;keys(b,['id','mode','confirmed',...(mode==='create'?['kind',...Object.keys(developmentFields)]:mode==='review'?['requestId','revision','state','note']:mode==='clarify'?['requestId','revision','note']:[])]);
 if(!['create','review','clarify'].includes(mode)||b.confirmed!==true)fail('نوع عملیات و تأیید صریح لازم است.');
 const id=taskRequired(b.id,100);if(!/^[a-f0-9-]{36}$/i.test(id))fail('شناسه عملیات معتبر نیست.');
 if(mode==='review'&&!u.isAdmin)fail('بررسی درخواست فقط برای مدیر سامانه مجاز است.',403);
 let row=mode==='create'?null:await access(taskRequired(b.requestId,100),u,me);
 if(mode==='clarify'&&row!.data.owner!==me)fail('توضیح تکمیلی فقط توسط درخواست‌کننده ثبت می‌شود.',403);
 const signature=JSON.stringify(b),previous:any=await db.prepare("SELECT actor,payload,kind FROM inventory_operations WHERE id=?").bind(id).first();
 if(previous){if(previous.actor!==u.userId||previous.payload!==signature||previous.kind!=='development')fail('شناسه عملیات قبلاً استفاده شده است.',409);return json({accountId:u.userId,saved:true,repeated:true,requestId:row?.id||id});}
 const now=new Date().toISOString(),viaAssistant=inboxAssistantExecution.getStore()===true,target=row?.id||id;
 let d:DevelopmentRequest['data'];const writes:D1PreparedStatement[]=[];
 const guard=(sql:string,...a:any[])=>writes.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+sql+' THEN guard ELSE 0 END WHERE id=?').bind(...a,id));
 if(mode==='create'){
  if(!Object.hasOwn(developmentKinds,b.kind))fail('نوع نیاز را انتخاب کنید.');
  const fields:any={};for(const [k,f] of Object.entries(developmentFields))fields[k]=f.required?taskRequired(b[k],f.max):taskText(b[k]??'',f.max);
  const member:any=await db.prepare("SELECT name,unit FROM app_members WHERE id=? AND status='active'").bind(me).first();
  d={...fields,kind:b.kind,state:'new',owner:me,requester:member?.name||u.name,unit:member?.unit||'',source:viaAssistant?'assistant':'direct',history:[]};
  // Deduplicate the same open need for the same account, including retries with a new operation ID.
  const fingerprint=JSON.stringify([me,b.kind,...Object.keys(developmentFields).map(k=>fields[k])]);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const duplicateSql="type='development_request' AND json_extract(data,'$.fingerprint')=? AND json_extract(data,'$.state') NOT IN ('done','declined')";
  const duplicate:any=await db.prepare('SELECT id FROM flow_entities WHERE '+duplicateSql).bind(hash).first();
  if(duplicate)return json({accountId:u.userId,saved:true,duplicate:true,requestId:duplicate.id});
  guard('NOT EXISTS(SELECT 1 FROM flow_entities WHERE '+duplicateSql+')',hash);
  writes.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'development_request',?,1,?,?)").bind(target,JSON.stringify({...d,fingerprint:hash}),now,now));
 }else{
  if(!Number.isInteger(b.revision)||b.revision!==row!.revision)fail('درخواست تغییر کرده است؛ تازه‌سازی و دوباره بررسی کنید.',409);
  const note=taskRequired(b.note,4000);if(mode==='review'&&!Object.hasOwn(developmentStates,b.state))fail('وضعیت معتبر نیست.');
  if(row!.data.history.length>=200)fail('ظرفیت پیگیری این درخواست تکمیل شده است.');
  d={...row!.data,state:mode==='review'?b.state:row!.data.state==='needs_info'?'new':row!.data.state,history:[...row!.data.history,{at:now,author:u.name,role:mode==='review'?'admin':'requester',note,state:mode==='review'?b.state:row!.data.state==='needs_info'?'new':row!.data.state}]};
  guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='development_request' AND revision=?)",target,row!.revision);
  writes.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(d),now,target,row!.revision));
 }
 await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'development',?,?,?,1)").bind(id,signature,u.userId,now),...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'development_'+mode,JSON.stringify({state:d.state,viaAssistant}),now)]);
 return json({accountId:u.userId,saved:true,requestId:target});
 }catch(e){return accessResponse(e)||Response.json({error:'ثبت نشد یا نتیجه قطعی نیست؛ فهرست را تازه کنید و قبل از ثبت مجدد بررسی کنید.'},{status:409})}}
