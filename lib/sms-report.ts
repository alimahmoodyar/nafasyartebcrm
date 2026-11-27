import {AccessError} from './authorization';
import {asciiDigits} from './batch-number';
import {storage} from './storage';
import {trainingContext} from './training-context';

const reportType='sms_attempt_report';
const daysKept=30;
const maxReports=3000;
const pageSize=25;
const purposes=['recovery_enroll','recovery_reset','admin_test','warranty_activation','warranty_welcome','asset_otp','other'] as const;
export type SmsPurpose=typeof purposes[number];
const outcomes=[
 'invalid_mobile','rate_limited','invalid_password','backup_required','mobile_in_use','config_unavailable',
 'account_mismatch','recovery_mobile_unverified','recovery_mobile_mismatch','recovery_backup_unavailable',
 'schema_unavailable','challenge_unavailable','network_timeout','network_dns','network_tls','network_error',
 'provider_rejected','provider_response_unknown','provider_accepted','challenge_changed','internal_error',
] as const;
export type SmsOutcome=typeof outcomes[number];
type ProviderDetails={httpStatus?:number;panelCode?:number;messageId?:number};
type Details=ProviderDetails&{mobile?:string};
type RecordData=ProviderDetails&{purpose:SmsPurpose;outcome:SmsOutcome;last4?:string};
type Row={id:string;created:string;data:string};
export type SmsReportUpdate=(outcome:SmsOutcome,details?:Details)=>void;
const oldest=(now=Date.now())=>new Date(now-daysKept*86400000).toISOString();
const rowId=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const validPurpose=(v:unknown):v is SmsPurpose=>purposes.some(p=>p===v);
const validOutcome=(v:unknown):v is SmsOutcome=>outcomes.some(o=>o===v);

function providerDetails(value:ProviderDetails):ProviderDetails{
 const {httpStatus,panelCode,messageId}=value;
 return {
  httpStatus:typeof httpStatus==='number'&&Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?httpStatus:undefined,
  panelCode:typeof panelCode==='number'&&Number.isSafeInteger(panelCode)&&panelCode>=0&&panelCode<=9999?panelCode:undefined,
  messageId:typeof messageId==='number'&&Number.isSafeInteger(messageId)&&messageId>0?messageId:undefined,
 };
}

async function saveReport(purpose:SmsPurpose,outcome:SmsOutcome,details:Details){
 if(trainingContext.getStore())return;
 const now=new Date().toISOString(),db=storage(),report:RecordData={
  purpose,outcome,
  last4:details.mobile&&/^09\d{9}$/.test(details.mobile)?details.mobile.slice(-4):undefined,
  ...providerDetails(details),
 };
 await db.batch([
  db.prepare('INSERT INTO flow_entities (id,type,data,revision,created,updated) VALUES (?,?,?,1,?,?)')
   .bind(crypto.randomUUID(),reportType,JSON.stringify(report),now,now),
  db.prepare(`DELETE FROM flow_entities WHERE type=? AND (created<? OR id IN (
   SELECT id FROM flow_entities WHERE type=? ORDER BY created DESC,id DESC LIMIT -1 OFFSET ?
  ))`).bind(reportType,oldest(),reportType,maxReports),
 ]);
}

/** Keep observation failures separate from SMS acceptance and recovery state. */
export async function withSmsReport<T>(
 purpose:SmsPurpose,run:(update:SmsReportUpdate)=>Promise<T>,
):Promise<T>{
 let outcome:SmsOutcome|null=null;
 const details:Details={};
 const update:SmsReportUpdate=(next,fields)=>{outcome=next;Object.assign(details,fields);};
 try{return await run(update);}
 catch(error){
  if(error instanceof AccessError&&error.status===429)outcome='rate_limited';
  else if(purpose.startsWith('recovery_')&&/no such column:.*(?:recovery_mobile|recovery_revision|recovery_backup_hash)|no such table:.*password_recovery_challenges/i.test(String(error)))outcome='schema_unavailable';
  else outcome||='internal_error';
  throw error;
 }finally{
  if(outcome)try{await saveReport(purpose,outcome,details);}
  catch{console.warn('SMS attempt report could not be saved.');}
 }
}

function project(row:Row){
 try{
  const data:RecordData=JSON.parse(row.data);
  if(!validPurpose(data.purpose)||!validOutcome(data.outcome))return null;
  return {id:row.id,at:row.created,purpose:data.purpose,outcome:data.outcome,
   last4:typeof data.last4==='string'&&/^\d{4}$/.test(data.last4)?data.last4:undefined,...providerDetails(data)};
 }catch{return null;}
}
export async function listSmsReports(query:URLSearchParams){
 const purpose=query.get('purpose')||'',last4=asciiDigits(query.get('last4')||''),before=query.get('before')||'';
 if(purpose&&!validPurpose(purpose)||last4&&!/^\d{4}$/.test(last4))throw new AccessError('فیلتر گزارش معتبر نیست.',400);
 const [at,id,extra]=before.split('|');
 if(before&&(extra!==undefined||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at)||!rowId.test(id||'')))
  throw new AccessError('صفحهٔ گزارش معتبر نیست.',400);
 const result=await storage().prepare(`SELECT id,created,data FROM flow_entities
  WHERE type=? AND created>=? AND (?='' OR json_extract(data,'$.purpose')=?)
  AND (?='' OR json_extract(data,'$.last4')=?)
  AND (?='' OR (created,id)<(?,?))
  ORDER BY created DESC,id DESC LIMIT ?`).bind(reportType,oldest(),purpose,purpose,last4,last4,at,at,id||'',pageSize+1).all<Row>();
 const page=result.results.slice(0,pageSize),last=page.at(-1);
 return {entries:page.map(project).filter(entry=>entry!==null),
  nextCursor:result.results.length>pageSize&&last?last.created+'|'+last.id:null};
}
export async function reportMessageId(id:string){
 if(!rowId.test(id))throw new AccessError('شناسهٔ گزارش معتبر نیست.',400);
 const row=await storage().prepare('SELECT id,created,data FROM flow_entities WHERE id=? AND type=? AND created>=?').bind(id,reportType,oldest()).first<Row>();
 const entry=row&&project(row);
 if(!entry||!entry.messageId)throw new AccessError('این گزارش شناسهٔ قابل استعلام ندارد.',404);
 return entry.messageId;
}
