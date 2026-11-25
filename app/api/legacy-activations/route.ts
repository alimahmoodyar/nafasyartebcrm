import {AccessError,accessResponse,checkOrigin,requireAdmin} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {latinDigits} from '@/lib/persian-date';
import {storage} from '@/lib/storage';
import {trainingContext} from '@/lib/training-context';
import {cleanLegacyActivation,legacyActivationChunkSize,legacyDetailsComparison,legacyActivationType,legacyAgencyType,type LegacyActivation,type LegacyPreview} from '@/lib/legacy-activation-import';

const json=(body:unknown)=>Response.json(body,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
function fail(message:string,status=400):never{throw new AccessError(message,status);}
const eventId=(key:string)=>'legacy-activation:'+key;
const agencyId=(key:string)=>'legacy-activation-agency:'+key;
const availableSales="type='sales_agent' AND json_extract(data,'$.active')=1 AND json_extract(data,'$.kind') IN ('representative','reseller')";
function scope(request:Request,userId:string){
 if(trainingContext.getStore())fail('ورود سوابق در بخش مدیریت اطلاعات شرکت انجام می‌شود.',403);
 if(request.headers.get('x-assistant-account')!==userId)fail('حساب ورود تغییر کرده است. صفحه را تازه کنید.',409);
}
async function previousRows(rows:LegacyActivation[]){
 const found=await storage().prepare("SELECT id,data FROM flow_entities WHERE type=? AND id IN (SELECT value FROM json_each(?))")
  .bind(legacyActivationType,JSON.stringify(rows.map(row=>eventId(row.activeId)))).all<{id:string;data:string}>();
 return new Map(found.results.map(row=>[row.id,{raw:row.data,stored:JSON.parse(row.data) as {event:LegacyActivation}}]));
}
function compare(rows:LegacyActivation[],previous:Awaited<ReturnType<typeof previousRows>>):LegacyPreview[]{
 return rows.flatMap<LegacyPreview>(row=>{
  const existing=previous.get(eventId(row.activeId));
  if(!existing)return [];
  const status=legacyDetailsComparison(existing.stored.event,row);
  return [{activeId:row.activeId,status,...(status==='conflict'?{existing:existing.stored.event}:{})}];
 });
}
export async function GET(request:Request){
 try{
  const user=await requireAdmin();
  scope(request,user.userId);
  const db=storage(),q=new URL(request.url).searchParams;
  if(q.get('view')==='history'){
   const page=Number(q.get('page')||1),query=latinDigits((q.get('q')||'').trim().slice(0,160)).toUpperCase();
   if(!Number.isSafeInteger(page)||page<1||page>100000)fail('شمارهٔ صفحه معتبر نیست.');
   const data=await db.prepare(`SELECT e.data,s.data AS salesData FROM flow_entities e
    LEFT JOIN flow_entities m ON m.type=? AND m.id='legacy-activation-agency:'||json_extract(e.data,'$.event.agencyId')
    LEFT JOIN flow_entities s ON s.type='sales_agent' AND s.id=json_extract(m.data,'$.salesId')
    WHERE e.type=? AND (?='' OR e.id=? OR json_extract(e.data,'$.event.serial')=?
     OR json_extract(e.data,'$.event.setSerial')=? OR json_extract(e.data,'$.event.deviceSetSerial')=?)
    ORDER BY e.id LIMIT 41 OFFSET ?`).bind(legacyAgencyType,legacyActivationType,query,eventId(query),query,query,query,(page-1)*40)
    .all<{data:string;salesData:string|null}>();
   return json({rows:data.results.slice(0,40).map(row=>({...JSON.parse(row.data),salesName:row.salesData?JSON.parse(row.salesData).name:''})),more:data.results.length>40});
  }
  const [sales,links,firstEvent]=await Promise.all([
   db.prepare("SELECT id,json_extract(data,'$.name') AS name,json_extract(data,'$.code') AS code,json_extract(data,'$.city') AS city FROM flow_entities WHERE "+availableSales+" ORDER BY name,id").all(),
   db.prepare("SELECT revision,json_extract(data,'$.legacyId') AS id,json_extract(data,'$.salesId') AS salesId FROM flow_entities WHERE type=? ORDER BY id").bind(legacyAgencyType).all(),
   db.prepare("SELECT 1 AS found FROM flow_entities WHERE type=? LIMIT 1").bind(legacyActivationType).first(),
  ]);
  return json({sales:sales.results,links:links.results,hasEvents:!!firstEvent});
 }catch(error){return accessResponse(error)||Response.json({error:'خواندن اطلاعات مهاجرت انجام نشد.'},{status:503});}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await requireAdmin();
  scope(request,user.userId);
  let body:{mode?:unknown;rows?:unknown;file?:unknown;confirmed?:unknown;legacyId?:unknown;salesId?:unknown;revision?:unknown}|null;
  try{body=JSON.parse(new TextDecoder().decode(await boundedBody(request,480000)));}catch{fail('درخواست ورود سوابق معتبر نیست یا حجم آن زیاد است.');}
  const db=storage(),now=new Date().toISOString();
  if(body?.mode==='link'){
   const {legacyId,salesId,revision}=body;
   if(body.confirmed!==true||typeof legacyId!=='string'||! /^[1-9][0-9]{0,19}$/.test(legacyId)||
      typeof salesId!=='string'||!salesId||salesId.length>200||typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0)fail('شناسهٔ نماینده و تأیید اتصال لازم است.');
   const id=agencyId(legacyId),payload=JSON.stringify({legacyId,salesId,actor:user.userId});
   const current=await db.prepare('SELECT data,revision FROM flow_entities WHERE type=? AND id=?').bind(legacyAgencyType,id).first<{data:string;revision:number}>();
   if(current&&JSON.parse(current.data).salesId===salesId)return json({id:legacyId,salesId,revision:current.revision});
   if((current?.revision||0)!==revision)fail('اتصال تغییر کرده است. بخش نمایندگی‌ها را تازه‌سازی کنید.',409);
   const saved=await db.prepare(`INSERT INTO flow_entities(id,type,data,revision,created,updated)
    SELECT ?,?,?,1,?,? WHERE EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND ${availableSales})
    ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated
    WHERE flow_entities.type=excluded.type AND flow_entities.revision=? RETURNING revision`)
    .bind(id,legacyAgencyType,payload,now,now,salesId,revision).first<{revision:number}>();
   if(!saved)fail('نمایندهٔ فروش فعال نیست یا این اتصال هم‌زمان تغییر کرده است.',409);
   return json({id:legacyId,salesId,revision:saved.revision});
  }
  if(!body||typeof body.mode!=='string'||!['preview','import'].includes(body.mode)||!Array.isArray(body.rows)||!body.rows.length||
     body.rows.length>legacyActivationChunkSize)fail('ردیف‌های ورود سوابق معتبر نیستند.');
  const rows:LegacyActivation[]=body.rows.map((value:unknown)=>cleanLegacyActivation(value)||fail('یک ردیف نامعتبر در بستهٔ سوابق وجود دارد.'));
  if(new Set(rows.map(row=>row.activeId)).size!==rows.length)fail('شناسهٔ تکراری در این بسته وجود دارد.');
  const previous=await previousRows(rows);
  if(body.mode==='preview')return json({known:compare(rows,previous)});
  const file=body.file;
  if(body.confirmed!==true||typeof file!=='string'||!file.trim()||file.length>300)fail('نام فایل و تأیید ثبت لازم است.');
  const pending=rows.filter(row=>!previous.has(eventId(row.activeId)));
  const values=pending.map(row=>[eventId(row.activeId),null,JSON.stringify({event:row,file,importedAt:now,actor:user.userId})]);
  for(const row of rows){
   const id=eventId(row.activeId),existing=previous.get(id);
   if(!existing||legacyDetailsComparison(existing.stored.event,row)!=='enrich')continue;
   const event={...existing.stored.event,details:{...existing.stored.event.details,...row.details}};
   values.push([id,existing.raw,JSON.stringify({...existing.stored,event})]);
  }
  const saved=values.length?await db.prepare(`WITH incoming AS (
   SELECT json_extract(value,'$[0]') AS id,json_extract(value,'$[1]') AS prior,json_extract(value,'$[2]') AS after FROM json_each(?)
  ) INSERT INTO flow_entities(id,type,data,revision,created,updated)
   SELECT id,?,after,1,?,? FROM incoming
   WHERE prior IS NULL OR EXISTS(SELECT 1 FROM flow_entities WHERE flow_entities.id=incoming.id AND flow_entities.data=incoming.prior)
   ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated
   WHERE flow_entities.type=excluded.type AND flow_entities.data=(SELECT prior FROM incoming WHERE incoming.id=excluded.id)
   RETURNING id`).bind(JSON.stringify(values),legacyActivationType,now,now).all<{id:string}>():{results:[]};
  const newIds=new Set(saved.results.filter(row=>!previous.has(row.id)).map(row=>row.id));
  const remaining=rows.filter(row=>!newIds.has(eventId(row.activeId)));
  return json({saved:newIds.size,enriched:saved.results.length-newIds.size,known:remaining.length?compare(remaining,await previousRows(remaining)):[]});
 }catch(error){return accessResponse(error)||Response.json({error:'عملیات ورود سوابق انجام نشد. دوباره تلاش کنید.'},{status:503});}
}
