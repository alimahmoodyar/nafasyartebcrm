import {storage} from '@/lib/storage';
import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {flowRole} from '@/lib/material-flow';
import {need,fail,req,date} from '@/lib/after-sales';
import {normalizeServicePartRows} from '@/lib/service-part-import';
import {consumerTariffValue,selectConsumerPartTariff} from '@/lib/after-sales-pricing';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
const ordered=(rows:any[])=>rows.sort((a,b)=>a.id>b.id?1:a.id<b.id?-1:0);
const tariffSnapshot=(rows:any[])=>JSON.stringify(ordered([...rows]).map(row=>({id:row.id,revision:row.revision,data:row.data,created:row.created})));
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,250000))),domain=req(b.domain),source=req(b.source,500),validFrom=date(b.validFrom);
 need(u,domain,'manager');if(!(u.isAdmin||u.permissions.flowRoles?.includes('inventory')))fail('ورود قطعات و تعرفه به مجوز مدیر خدمات و تعریف کالا در انبار نیاز دارد.',403);
 if(!['preview','commit'].includes(b.mode))fail('عملیات واردسازی معتبر نیست.');
 const normalized=normalizeServicePartRows(b.rows),rows=normalized.rows.sort((a,b)=>a.code>b.code?1:a.code<b.code?-1:0),db=storage(),now=new Date().toISOString();
 const signature=JSON.stringify({domain,source,validFrom,rows,catalogSnapshot:b.catalogSnapshot});
 if(b.mode==='commit'){
  if(b.confirmed!==true)fail('تأیید صریح پیش‌نمایش لازم است.');
  if(typeof b.id!=='string'||! /^[a-f0-9-]{36}$/i.test(b.id))fail('شناسهٔ عملیات معتبر نیست.');
  if(normalized.errors.length)fail(normalized.errors.slice(0,30).join('\n'));
  const prior:any=await db.prepare('SELECT * FROM inventory_operations WHERE id=?').bind(b.id).first();
  if(prior){if(prior.kind!=='service_part_import'||prior.actor!==u.userId||prior.payload!==signature)fail('شناسهٔ عملیات متعلق به درخواست دیگری است.',409);const audit:any=await db.prepare("SELECT after FROM access_audit WHERE target=? AND actor=? AND action='service_part_import'").bind(b.id,u.userId).first();if(!audit)fail('نتیجهٔ ثبت قبلی در دسترس نیست.',409);return json({...JSON.parse(audit.after),saved:true,repeated:true});}
 }
 const materialRows:any[]=[];for(let start=0;start<rows.length;start+=90){const ids=rows.slice(start,start+90).map(row=>'material:'+row.code);const part=(await db.prepare('SELECT * FROM flow_entities WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all()).results;materialRows.push(...part);}
 const materialMap=new Map(materialRows.map(row=>[row.id,row])),codes=new Set(rows.map(row=>row.code)),allTariffs=(await db.prepare("SELECT * FROM flow_entities WHERE type='as_tariff' AND json_extract(data,'$.domain')=? AND json_extract(data,'$.kind')='part'").bind(domain).all()).results as any[],tariffs=allTariffs.filter(row=>codes.has(JSON.parse(row.data).partCode));
 const decodedTariffs=tariffs.map(row=>({...row,data:JSON.parse(row.data)})),errors=[...normalized.errors],warnings:string[]=[],newCodes:string[]=[],reuse=new Map<string,any>();
 for(const row of rows){
  const existing:any=materialMap.get('material:'+row.code);if(existing){const data=JSON.parse(existing.data);if(existing.type!=='material'||data.unit!==row.unit)errors.push(row.code+': واحد با شناسنامهٔ موجود یکسان نیست ('+String(data.unit||'—')+').');if(data.name!==row.name)warnings.push(row.code+': نام موجود «'+data.name+'» حفظ می‌شود؛ نام فایل «'+row.name+'» است.');}else newCodes.push(row.code);
  const effective=selectConsumerPartTariff(decodedTariffs,row.code,validFrom,domain);if(effective&&effective.data.validFrom===validFrom&&consumerTariffValue(effective)===row.consumerPriceRial)reuse.set(row.code,effective);
 }
 const snapshotData={domain,source,validFrom,rows,materials:rows.map(row=>{const material:any=materialMap.get('material:'+row.code);return material?{id:material.id,type:material.type,revision:material.revision,data:material.data}:null;}),tariffs:tariffSnapshot(tariffs)};
 const catalogSnapshot=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(snapshotData))))).map(value=>value.toString(16).padStart(2,'0')).join('');
 const counts={totalCount:rows.length,newMaterialCount:newCodes.length,newTariffCount:rows.length-reuse.size,unchangedCount:reuse.size};
 const preview={domain,source,validFrom,rows,newCodes,errors,warnings,catalogSnapshot,...counts};if(b.mode==='preview')return json(preview);
 if(errors.length)fail(errors.slice(0,30).join('\n'));
 if(typeof b.catalogSnapshot!=='string'||b.catalogSnapshot!==catalogSnapshot)fail('فهرست قطعات یا تعرفه‌ها تغییر کرده؛ پیش‌نمایش را تازه‌سازی کنید.',409);
 const checks:D1PreparedStatement[]=[],writes:D1PreparedStatement[]=[],importId=b.id;
 for(const row of rows){
  const mid='material:'+row.code,existing:any=materialMap.get(mid),catalog=tariffs.filter(tariff=>JSON.parse(tariff.data).partCode===row.code),materialCheck=existing?"EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='material' AND revision=? AND data=?)":'NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?)';
  // Ordered JSON guards the complete relevant tariff set, including new versions inserted after preview.
  const tariffCheck="COALESCE((SELECT json_group_array(json_object('id',id,'revision',revision,'data',data,'created',created)) FROM (SELECT id,revision,data,created FROM flow_entities WHERE type='as_tariff' AND json_extract(data,'$.domain')=? AND json_extract(data,'$.kind')='part' AND json_extract(data,'$.partCode')=? ORDER BY id)), '[]')=?";
  checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+materialCheck+' AND '+tariffCheck+' THEN guard ELSE 0 END WHERE id=?').bind(...(existing?[mid,existing.revision,existing.data]:[mid]),domain,row.code,tariffSnapshot(catalog),importId));
  if(!existing)writes.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'material',?,1,?,?)").bind(mid,JSON.stringify({code:row.code,name:row.name,unit:row.unit,specs:'',fields:[],importSource:source,importKind:'service_part_import',qcSetupRequired:true}),now,now));
  if(!reuse.has(row.code)){const name=existing?JSON.parse(existing.data).name:row.name;writes.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'as_tariff',?,1,?,?)").bind(crypto.randomUUID(),JSON.stringify({domain,kind:'part',name,partCode:row.code,consumerPriceRial:row.consumerPriceRial,priceRial:null,costRial:null,validFrom,active:true,importSource:source,importKind:'service_part_import',...(row.sourceRow!==undefined?{sourceRow:row.sourceRow}:{})}),now,now));}
 }
 const result={saved:true,importId,domain,source,validFrom,newCodes,...counts};
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(importId,'service_part_import',signature,u.userId,now),...checks,...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,importId,'service_part_import',JSON.stringify(result),now)]);
 return json(result);
 }catch(e){
  const denied=accessResponse(e);if(denied)return denied;
  const message=e instanceof Error?e.message:'';
  if(/UNIQUE|inventory_operation_guard/i.test(message))return json({error:'فهرست قطعات یا تعرفه‌ها هم‌زمان تغییر کرده؛ هیچ تغییر ناقصی ثبت نشد. پیش‌نمایش را تازه کنید.'},409);
  if(e instanceof SyntaxError)return json({error:'ساختار درخواست معتبر نیست.'},400);
  // D1 may finish the transaction before a response is lost. Keep unexpected
  // failures retryable so the client retains this exact operation UUID.
  return json({error:'پاسخ قطعی عملیات دریافت نشد؛ برای بررسی نتیجه، همین درخواست را دوباره ارسال کنید.'},503);
 }
}
