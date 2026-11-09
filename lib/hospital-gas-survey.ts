import {env} from 'cloudflare:workers';
import {AccessError,accessResponse,checkOrigin,requireAccess} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {signSurveyTicket,verifySurveyTicket,surveyUuid,type SurveyReceipt} from '@/lib/hospital-gas-survey-ticket';
import {normalizeSurvey,type SurveyAnswers} from '@/lib/hospital-gas-survey-contract';
import {liveSalesUser,salesScope,salesStaff,salesManager,salesVisible} from '@/lib/sales';
import {storage} from '@/lib/storage';
import {trainingContext} from '@/lib/training-context';
import type {Session} from '@/lib/permissions';

const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const respond=(value:unknown,status=200)=>Response.json(value,{status,headers});
const fail=(message:string,status=400):never=>{throw new AccessError(message,status);};
const missing=()=>fail('لینک معتبر نیست یا دیگر فعال نیست.',404);
const config=()=>env as typeof env&{GAS_SURVEY_BRIDGE_SECRET?:string;GAS_SURVEY_PUBLIC_ORIGIN?:string};
const kind='hospital_gas_survey';
type Survey={center:string;agentId:string;owner:string;expires:string;revoked?:string;submitted?:string;answers?:SurveyAnswers};
type Row={id:string;data:string;created:string;revision:number};
const decode=(row:Row)=>JSON.parse(row.data) as Survey;

function secret(){
 const value=config().GAS_SURVEY_BRIDGE_SECRET;
 if(!value)return fail('لینک بیرونی هنوز پیکربندی نشده است.',503);
 return value;
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
 const syncUntil=Date.now()+300000;
 const canSync=origin&&!submitted&&!revoked&&syncUntil>Date.now();
 return {id:row.id,created:row.created,center,agentId,expires,submitted,revoked,answers,
  ...(canSync?{syncUrl:new URL('/manage',origin).href,syncTicket:await signSurveyTicket(secret(),'read',{id:row.id,until:syncUntil})}:{}),
  ...(active&&origin?{link:new URL('/q/'+row.id+'#'+await signSurveyTicket(secret(),'invite',{id:row.id,center,expires}),origin).href}:{})};
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
  if(!b||b.confirmed!==true||typeof b.id!=='string'||!surveyUuid.test(b.id))fail('شناسه و تأیید اقدام لازم است.');
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
   const survey:Survey={center,agentId:b.agentId,owner:user.userId,expires:new Date(Date.parse(now)+b.days*86400000).toISOString()};
   await db.batch([
    db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(b.id,kind,JSON.stringify(survey),now,now),
    db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,b.id,'hospital_gas_survey_create',null,JSON.stringify({center,agentId:b.agentId,expires:survey.expires}),now)
   ]);
   return respond(await summary({id:b.id,data:JSON.stringify(survey),created:now,revision:1},survey),201);
  }
  const row=await read(b.id);
  if(!row||!await visible(user,decode(row)))return missing();
  const survey=decode(row);
  if(b.mode==='prepare_revoke'){
   if(survey.submitted||survey.revoked||survey.expires<=now)fail('این لینک دیگر فعال نیست.',409);
   const origin=config().GAS_SURVEY_PUBLIC_ORIGIN;
   if(!origin)return fail('لینک بیرونی هنوز پیکربندی نشده است.',503);
   return respond({syncUrl:new URL('/manage',origin).href,syncTicket:await signSurveyTicket(secret(),'revoke',{id:row.id,until:Math.min(Date.parse(survey.expires),Date.now()+300000)})});
  }
  if(b.mode!=='import')fail('اقدام معتبر نیست.');
  const receipt=await verifySurveyTicket<SurveyReceipt>(secret(),'receipt',b.receipt);
  if(!receipt||receipt.id!==row.id||!['submitted','revoked'].includes(receipt.status)||!Number.isFinite(Date.parse(receipt.at))||receipt.at<row.created||receipt.at>survey.expires)return missing();
  if(survey.submitted||survey.revoked){
   if((survey.submitted||survey.revoked)===receipt.at)return respond({ok:true});
   fail('این پرسش‌نامه قبلاً تعیین تکلیف شده است.',409);
  }
  let answers:SurveyAnswers|undefined;
  if(receipt.status==='submitted'){
   try{answers=normalizeSurvey(receipt.answers);}catch(error){return respond({error:(error as Error).message},400);}
  }
  return update(row,{...survey,...(receipt.status==='submitted'?{submitted:receipt.at,answers}:{revoked:receipt.at})},user.userId,receipt.status==='submitted'?'submit':'revoke',now);
 }catch(error){return errorResponse(error);}
}

async function update(row:Row,survey:Survey,actor:string,action:string,now:string){
 const db=storage();
 const result=await db.batch([
  db.prepare("UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND type=? AND revision=?").bind(JSON.stringify(survey),now,row.id,kind,row.revision),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) SELECT ?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor,row.id,'hospital_gas_survey_'+action,null,JSON.stringify({center:survey.center,submitted:survey.submitted,revoked:survey.revoked}),now)
 ]);
 return result[0].meta.changes===1?respond({ok:true}):respond({error:'این لینک دیگر فعال نیست. وضعیت را دوباره بررسی کنید.'},409);
}
