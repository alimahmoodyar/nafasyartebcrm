import {env} from 'cloudflare:workers';
import {AccessError,accessResponse,checkOrigin,requireAccess} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {sha256} from '@/lib/firmware';
import {normalizeSurvey,type SurveyAnswers} from '@/lib/hospital-gas-survey-contract';
import {liveSalesUser,salesScope,salesStaff,salesManager,salesVisible} from '@/lib/sales';
import {storage} from '@/lib/storage';
import {trainingContext} from '@/lib/training-context';
import type {Session} from '@/lib/permissions';

const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const respond=(value:unknown,status=200)=>Response.json(value,{status,headers});
const fail=(message:string,status=400):never=>{throw new AccessError(message,status);};
const missing=()=>fail('لینک معتبر نیست یا دیگر فعال نیست.',404);
const bytes=(value:string)=>new TextEncoder().encode(value);
const config=()=>env as typeof env&{GAS_SURVEY_BRIDGE_SECRET?:string;GAS_SURVEY_PUBLIC_ORIGIN?:string};
const kind='hospital_gas_survey';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Survey={center:string;agentId:string;owner:string;expires:string;digest:string;revoked?:string;submitted?:string;answers?:SurveyAnswers};
type Row={id:string;data:string;created:string;revision:number};
const decode=(row:Row)=>JSON.parse(row.data) as Survey;

async function token(id:string){
 const secret=config().GAS_SURVEY_BRIDGE_SECRET;
 if(!secret)fail('لینک بیرونی هنوز پیکربندی نشده است.',503);
 const key=await crypto.subtle.importKey('raw',bytes(secret!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,bytes('nafasyar-gas-survey:'+id));
 return Array.from(new Uint8Array(signature),x=>x.toString(16).padStart(2,'0')).join('');
}

async function staff(){
 if(trainingContext.getStore())fail('ساخت لینک بیرونی در محیط نمونه فعال نیست.',403);
 const user=await liveSalesUser(await requireAccess());
 if(!salesStaff(user))fail('پرسش‌نامه در دسترسی فروش است.',403);
 return user;
}
async function visible(user:Session,survey:Survey){
 if(survey.agentId){
  try{await salesScope(user,survey.agentId);return true;}catch(error){if(error instanceof AccessError&&[403,404].includes(error.status))return false;throw error;}
 }
 return salesManager(user)||survey.owner===user.userId;
}
async function read(id:string){
 return storage().prepare('SELECT id,data,created,revision FROM flow_entities WHERE id=? AND type=?').bind(id,kind).first<Row>();
}
async function summary(row:Row,survey=decode(row)){
 const {center,agentId,expires,submitted,revoked,answers}=survey;
 const origin=config().GAS_SURVEY_PUBLIC_ORIGIN;
 const active=!submitted&&!revoked&&expires>new Date().toISOString();
 return {id:row.id,created:row.created,center,agentId,expires,submitted,revoked,answers,
  ...(active&&origin?{link:new URL('/q/'+row.id+'#'+await token(row.id),origin).href}:{})};
}
async function body(request:Request){
 try{return JSON.parse(new TextDecoder().decode(await boundedBody(request,36000)));}catch(error){if(error instanceof AccessError)throw error;return fail('درخواست معتبر نیست.');}
}
function errorResponse(error:unknown){return accessResponse(error)||respond({error:'پرسش‌نامه موقتاً در دسترس نیست.'},503);}

export async function GET(){
 try{
  const user=await staff(),db=storage();
  const {results}=await db.prepare('SELECT id,data,created,revision FROM flow_entities WHERE type=? ORDER BY created DESC,id DESC').bind(kind).all<Row>();
  const surveys=[];
  for(const row of results){
   const survey=decode(row);
   if(await visible(user,survey))surveys.push(await summary(row,survey));
  }
  const buyers=[];
  const agents=await db.prepare("SELECT id,data FROM flow_entities WHERE type='sales_agent' AND json_extract(data,'$.active')=1 ORDER BY json_extract(data,'$.name'),id").all<{id:string;data:string}>();
  for(const agent of agents.results){
   const data=JSON.parse(agent.data);
   if(await salesVisible(user,{id:agent.id,data},'write'))buyers.push({id:agent.id,name:String(data.name)});
  }
  return respond({surveys,buyers});
 }catch(error){return errorResponse(error);}
}

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await staff(),b=await body(request),db=storage(),now=new Date().toISOString();
  if(!b||b.confirmed!==true||typeof b.id!=='string'||!uuid.test(b.id))fail('شناسه و تأیید اقدام لازم است.');
  if(b.mode==='create'){
   const center=typeof b.center==='string'?b.center.trim():'';
   if(!center||center.length>160||!Number.isSafeInteger(b.days)||b.days<1||b.days>30||typeof b.agentId!=='string'||b.agentId.length>160)fail('نام مرکز و مدت اعتبار بین ۱ تا ۳۰ روز لازم است.');
   if(b.agentId)await salesScope(user,b.agentId);
   const existing=await read(b.id);
   if(existing){
    const old=decode(existing);
    if(old.owner!==user.userId||old.agentId!==b.agentId||old.center!==center||Date.parse(old.expires)-Date.parse(existing.created)!==b.days*86400000)fail('این شناسه قبلاً استفاده شده است.',409);
    return respond(await summary(existing,old));
   }
   if(!config().GAS_SURVEY_PUBLIC_ORIGIN)fail('لینک بیرونی هنوز پیکربندی نشده است.',503);
   const survey:Survey={center,agentId:b.agentId,owner:user.userId,expires:new Date(Date.parse(now)+b.days*86400000).toISOString(),digest:await sha256(bytes(await token(b.id)))};
   await db.batch([
    db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(b.id,kind,JSON.stringify(survey),now,now),
    db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,b.id,'hospital_gas_survey_create',null,JSON.stringify({center,agentId:b.agentId,expires:survey.expires}),now)
   ]);
   return respond(await summary({id:b.id,data:JSON.stringify(survey),created:now,revision:1},survey),201);
  }
  if(b.mode!=='revoke')fail('اقدام معتبر نیست.');
  const row=await read(b.id);
  if(!row||!await visible(user,decode(row)))return missing();
  const survey=decode(row);
  if(survey.submitted)fail('این پرسش‌نامه قبلاً پاسخ داده شده است.',409);
  if(survey.revoked)return respond({ok:true});
  return await update(row,{...survey,revoked:now},user.userId,'revoke',now);
 }catch(error){return errorResponse(error);}
}

async function update(row:Row,survey:Survey,actor:string,action:string,now:string){
 const db=storage();
 const result=await db.batch([
  db.prepare("UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND type=? AND revision=? AND json_extract(data,'$.expires')>?").bind(JSON.stringify(survey),now,row.id,kind,row.revision,now),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor,row.id,'hospital_gas_survey_'+action,null,JSON.stringify({center:survey.center,submitted:survey.submitted,revoked:survey.revoked}),now)
 ]);
 return result[0].meta.changes===1?respond({ok:true}):respond({error:'این لینک دیگر فعال نیست. وضعیت را دوباره بررسی کنید.'},409);
}

export async function bridge(request:Request){
 try{
  const secret=config().GAS_SURVEY_BRIDGE_SECRET,provided=request.headers.get('x-nafasyar-survey-bridge');
  if(!secret||!provided||provided.length!==secret.length)return missing();
  const a=await sha256(bytes(secret)),b=await sha256(bytes(provided));
  let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  if(difference)return missing();
  const input=await body(request);
  if(!input||typeof input.id!=='string'||!uuid.test(input.id)||typeof input.token!=='string'||!(/^[a-f0-9]{64}$/).test(input.token))return missing();
  const row=await read(input.id);
  if(!row)return missing();
  const survey=decode(row),now=new Date().toISOString();
  if(survey.digest!==await sha256(bytes(input.token))||survey.revoked||survey.expires<=now)return missing();
  if(input.mode==='open')return respond({center:survey.center,submitted:!!survey.submitted});
  if(input.mode!=='submit'||survey.submitted)return missing();
  let answers:SurveyAnswers;
  try{answers=normalizeSurvey(input.answers);}catch(error){return respond({error:(error as Error).message},400);}
  return update(row,{...survey,answers,submitted:now},'external:survey-link','submit',now);
 }catch(error){return errorResponse(error);}
}
