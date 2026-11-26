import {legacyActivationType,legacyAgencyType,legacyCustomerName,type LegacyActivation} from './legacy-activation-import';
import {latinDigits,parseCalendarDay} from './persian-date';
import {AccessError} from './authorization';
import {storage} from './storage';
import type {PhoneActivationHistoryRow,PhoneActivationCustomer,PhoneActivationProduct} from './phone-activation-contract';

const normalized=(value:string)=>latinDigits(value).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,'').toLowerCase();
const access=(message:string):never=>{throw new AccessError(message,400);};
const legacyLink=(expression:string)=>"m.type='"+legacyAgencyType+"' AND m.id='legacy-activation-agency:'||"+expression;
const dealerKey=(id:string)=>"CASE WHEN s.id IS NOT NULL THEN 'sales:'||s.id WHEN COALESCE("+id+",'')<>'' THEN 'legacy:'||"+id+" ELSE '' END";
const text=(expression:string)=>"lower(replace(replace(replace(replace("+expression+",'ي','ی'),'ك','ک'),' ',''),char(8204),''))";

type HistorySource={
 id:string; kind:PhoneActivationHistoryRow['kind']; serial:string; at:string; payload:string;
 dealerKey:string; dealer:string; profile:string|null; legacy:string|null;
};
function toHistoryRow(row:HistorySource):PhoneActivationHistoryRow{
 const legacy=row.legacy?JSON.parse(row.legacy).event as LegacyActivation:undefined;
 const details=legacy?.details;
 const priorCustomer={
  name:legacyCustomerName(details),mobile:details?.mobile,nationalId:details?.nationalId,postalCode:details?.postalCode,
  telephone:details?.telephone,email:details?.email,referrer:details?.doctor,
 };
 const p=row.profile?JSON.parse(row.profile) as {customer?:PhoneActivationCustomer;product?:PhoneActivationProduct;at?:string;warrantyStartDay?:string}:null;
 const source=JSON.parse(row.payload);
 return {id:row.id,kind:row.kind,serial:row.serial,at:row.at,activatedAt:p?.at,warrantyStartDay:p?.warrantyStartDay,
  dealer:row.dealer,actor:source.actorName,legacy,
  model:[p?.product?.name,p?.product?.model].filter(Boolean).join(' · '),months:p?.product?.months,
  customer:p?.customer||priorCustomer};
}

const activationRows=
 "WITH hospitalSerials AS ("+
 "SELECT json_extract(data,'$.serialKey') AS serial FROM flow_entities WHERE type='hospital_asset' "+
 "UNION SELECT upper(json_extract(data,'$.serial')) FROM flow_entities WHERE type='hospital_asset' "+
 "UNION SELECT json_extract(r.payload,'$.code') FROM flow_entities h JOIN records r ON r.id=json_extract(h.data,'$.deviceId') WHERE h.type='hospital_asset' AND r.kind='device'"+
 "), legacy AS ("+
 "SELECT id,data FROM flow_entities WHERE type='"+legacyActivationType+"'"+
 "), activity AS ("+
 "SELECT l.id,'legacy' AS kind,COALESCE(NULLIF(json_extract(l.data,'$.event.deviceSetSerial'),''),NULLIF(json_extract(l.data,'$.event.setSerial'),''),json_extract(l.data,'$.event.serial'),'') AS serial,"+
 "json_extract(l.data,'$.event.activeDate') AS at,substr(json_extract(l.data,'$.event.activeDate'),1,10) AS day,l.data AS payload,"+
 dealerKey("json_extract(l.data,'$.event.agencyId')")+" AS dealerKey,COALESCE(json_extract(s.data,'$.name'),json_extract(l.data,'$.event.agencyName'),'') AS dealer,NULL AS profile,l.data AS legacy,"+
 "COALESCE(json_extract(l.data,'$.event.deviceSetSerial'),'')||'|'||COALESCE(json_extract(l.data,'$.event.setSerial'),'')||'|'||COALESCE(json_extract(l.data,'$.event.serial'),'') AS aliases,"+
 "COALESCE(json_extract(l.data,'$.event.details.firstName'),'')||' '||COALESCE(json_extract(l.data,'$.event.details.lastName'),'') AS name "+
 "FROM legacy l LEFT JOIN flow_entities m ON "+legacyLink("json_extract(l.data,'$.event.agencyId')")+" "+
 "LEFT JOIN flow_entities s ON s.type='sales_agent' AND s.id=json_extract(m.data,'$.salesId') "+
 "WHERE NOT EXISTS(SELECT 1 FROM hospitalSerials h WHERE h.serial IN (json_extract(l.data,'$.event.deviceSetSerial'),json_extract(l.data,'$.event.setSerial'),json_extract(l.data,'$.event.serial'))) "+
 "UNION ALL "+
 "SELECT e.id,CASE WHEN json_extract(e.data,'$.purpose')='legacy-correction' THEN 'legacy-correction' WHEN json_extract(e.data,'$.purpose')='board' THEN 'board' WHEN json_extract(e.data,'$.first')=1 OR json_extract(p.data,'$.at')=e.created THEN 'first' ELSE 'code' END,"+
 "COALESCE(json_extract(e.data,'$.serial'),json_extract(p.data,'$.serial'),''),e.created,COALESCE(json_extract(e.data,'$.day'),date(e.created,'+03:30')),"+
 "e.data,"+dealerKey("json_extract(e.data,'$.legacyAgencyId')")+",COALESCE(json_extract(s.data,'$.name'),json_extract(e.data,'$.dealer'),''),p.data,k.data,"+
 "COALESCE(json_extract(e.data,'$.serial'),json_extract(p.data,'$.serial'),''),COALESCE(json_extract(p.data,'$.customer.name'),trim(COALESCE(json_extract(k.data,'$.event.details.firstName'),'')||' '||COALESCE(json_extract(k.data,'$.event.details.lastName'),'')),'') "+
 "FROM flow_entities e LEFT JOIN flow_entities p ON p.type='phone_activation_device' AND p.id='phone-activation-device:'||substr(e.id,24,64) "+
 "LEFT JOIN legacy k ON k.id='legacy-activation:'||json_extract(e.data,'$.legacyActivationId') "+
 "LEFT JOIN flow_entities m ON "+legacyLink("json_extract(e.data,'$.legacyAgencyId')")+" "+
 "LEFT JOIN flow_entities s ON s.type='sales_agent' AND s.id=COALESCE(json_extract(m.data,'$.salesId'),json_extract(e.data,'$.salesAgencyId')) "+
 "WHERE e.type='phone_activation_event' AND NOT EXISTS(SELECT 1 FROM hospitalSerials h WHERE h.serial=COALESCE(json_extract(e.data,'$.serial'),json_extract(p.data,'$.serial')))"+
 ") ";

export async function phoneActivationHistory(q:URLSearchParams){
 const db=storage();
 if(q.get('view')==='history-agencies'){
  const result=await db.prepare(activationRows+"SELECT dealerKey AS id,MAX(dealer) AS name FROM activity WHERE dealerKey<>'' GROUP BY dealerKey ORDER BY name,id")
    .all<{id:string;name:string}>();
  return {agencies:result.results.filter(x=>x.name)};
 }
 const fromText=q.get('from')||'',toText=q.get('to')||'';
 const from=parseCalendarDay(fromText),to=parseCalendarDay(toText);
 if(fromText&&!from||toText&&!to||from&&to&&from>to)access('بازهٔ تاریخ را به شکل ۱۴۰۵/۰۸/۱۲ و با ترتیب درست وارد کنید.');
 const kind=q.get('kind')||'',agency=q.get('agency')||'',page=Number(q.get('page')||1);
 if(!['','legacy','first','board','code','legacy-correction'].includes(kind)||agency.length>240||!Number.isSafeInteger(page)||page<1||page>10000)
  access('فیلتر سوابق معتبر نیست.');
 const term=normalized((q.get('q')||'').slice(0,160));
 const pageSize=30;
 const rows=await db.prepare(activationRows+
  "SELECT id,kind,serial,at,payload,dealerKey,dealer,profile,legacy FROM activity "+
  "WHERE (?='' OR instr("+text('name')+",?)>0 OR instr("+text('aliases')+",?)>0) "+
  "AND (?='' OR dealerKey=?) AND (?='' OR kind=?) AND (?='' OR day>=?) AND (?='' OR day<=?) "+
  "ORDER BY day DESC,at DESC,id DESC LIMIT ? OFFSET ?")
   .bind(term,term,term,agency,agency,kind,kind,from,from,to,to,pageSize+1,(page-1)*pageSize).all<HistorySource>();
 return {rows:rows.results.slice(0,pageSize).map(toHistoryRow),more:rows.results.length>pageSize};
}
