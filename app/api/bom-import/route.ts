import {storage} from '@/lib/storage';
import {requireAccess,can,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {flowRole} from '@/lib/material-flow';
import {boundedBody} from '@/lib/firmware-storage';
import {importLines} from '@/lib/bom-import';
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'private, no-store'}});
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();
 if(!can(u,'product','write')||!flowRole(u,'inventory'))fail('ورود BOM به مجوز ویرایش محصول و تعریف مواد انبار نیاز دارد.',403);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,180000)));
 if(!['preview','commit'].includes(b.mode))fail('عملیات ورود معتبر نیست.');
 const lines=importLines(b.lines).sort((a,b)=>a.partCode.localeCompare(b.partCode));
 if(typeof b.productId!=='string'||b.productId.length>200)fail('محصول را انتخاب کنید.');
 if(!Number.isInteger(b.previousVersion)||b.previousVersion<0)fail('نسخه قبلی معتبر نیست.');
 const source=typeof b.source==='string'?b.source.trim():'';if(source.length>500)fail('عنوان فایل طولانی است.');
 const db=storage(),now=new Date().toISOString(),signature=JSON.stringify({productId:b.productId,previousVersion:b.previousVersion,lines,source});
 if(b.mode==='commit'){
  if(b.confirmed!==true)fail('تأیید پیش‌نمایش لازم است.');
  if(typeof b.id!=='string'||! /^[a-f0-9-]{36}$/i.test(b.id))fail('شناسه درخواست معتبر نیست.');
  const prior:any=await db.prepare('SELECT * FROM inventory_operations WHERE id=?').bind(b.id).first();
  if(prior){if(prior.kind!=='bom_import'||prior.actor!==u.userId||prior.payload!==signature)fail('شناسه متعلق به درخواست دیگری است.',409);return json({saved:true,repeated:true});}
 }
 const product:any=await db.prepare("SELECT * FROM records WHERE id=? AND kind='product'").bind(b.productId).first();if(!product)fail('محصول پیدا نشد.');
 const latest:any=await db.prepare('SELECT * FROM bom_versions WHERE product_id=? ORDER BY version DESC LIMIT 1').bind(b.productId).first();
 if(b.previousVersion!==(latest?.version||0))fail('نسخه BOM تغییر کرده؛ پیش‌نمایش را دوباره دریافت کنید.',409);
 const materials:any[]=[];const errors:string[]=[],warnings:string[]=[],newCodes:string[]=[];
 for(const l of lines){
  const m:any=await db.prepare("SELECT * FROM flow_entities WHERE id=?").bind('material:'+l.partCode).first();
  if(m){const data=JSON.parse(m.data);if(m.type!=='material'||data.unit!==l.unit)errors.push(l.partCode+': واحد با شناسنامه موجود یکسان نیست ('+data.unit+').');if(data.name!==l.name)warnings.push(l.partCode+': نام موجود «'+data.name+'» حفظ می‌شود؛ نام BOM «'+l.name+'» است.');}
  else newCodes.push(l.partCode);
  materials.push(m);
 }
 const unchanged=!!latest&&JSON.stringify(importLines(JSON.parse(latest.lines)).sort((a,b)=>a.partCode.localeCompare(b.partCode)))===JSON.stringify(lines)&&!newCodes.length;
 const previous=latest?JSON.parse(latest.lines):[];
 const snapshot=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(materials.map(m=>m?{id:m.id,revision:m.revision,data:m.data}:null)))))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const result={catalogSnapshot:snapshot,productId:b.productId,previousVersion:latest?.version||0,lines,newCodes,errors,warnings,unchanged,removed:previous.filter((l:any)=>!lines.some(n=>n.partCode===l.partCode)),changed:lines.filter(l=>{const old=previous.find((o:any)=>o.partCode===l.partCode);return old&&JSON.stringify(old)!==JSON.stringify(l);}),source};
 if(b.mode==='preview')return json(result);
 if(errors.length)fail(errors.join('\n'));
 // The preview binds the exact existing catalog to the user's confirmation.
 if(typeof b.catalogSnapshot!=='string'||b.catalogSnapshot!==snapshot)fail('شناسنامه مواد تغییر کرده؛ پیش‌نمایش را دوباره دریافت کنید.',409);
 if(unchanged)return json({saved:true,unchanged:true,version:latest.version});
 const checks=[db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'bom_import',signature,u.userId,now),
 db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?) AND (SELECT COALESCE(MAX(version),0) FROM bom_versions WHERE product_id=?)=? THEN 1 ELSE 0 END WHERE id=?').bind(product.id,product.payload,product.id,b.previousVersion,b.id)];
 const writes:D1PreparedStatement[]=[];
 for(let i=0;i<lines.length;i++){
  const l=lines[i],m=materials[i],mid='material:'+l.partCode;
  checks.push(m?db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND data=?) THEN 1 ELSE 0 END WHERE id=?').bind(mid,m.revision,m.data,b.id):db.prepare('UPDATE inventory_operations SET guard=CASE WHEN NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?) THEN 1 ELSE 0 END WHERE id=?').bind(mid,b.id));
  if(!m)writes.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'material',?,1,?,?)").bind(mid,JSON.stringify({code:l.partCode,name:l.name,unit:l.unit,specs:'',defaultLocation:'',reorderPoint:0,targetStock:0,fields:[],qcOwner:'',warehouseOwner:'',procurementOwner:'',importSource:source,qcSetupRequired:true}),now,now));
 }
 writes.push(db.prepare('INSERT INTO bom_versions(id,product_id,version,lines,created,actor) VALUES(?,?,?,?,?,?)').bind(b.id,product.id,b.previousVersion+1,JSON.stringify(lines),now,u.userId),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,product.id,'bom_import',JSON.stringify({source,version:b.previousVersion+1,lines,newCodes}),now));
 await db.batch([...checks,...writes]);return json({saved:true,version:b.previousVersion+1,createdMaterials:newCodes.length});
 }catch(e){const denied=accessResponse(e);if(denied)return denied;const message=e instanceof Error?e.message:'';return Response.json({error:/UNIQUE|inventory_operation_guard|FOREIGN KEY/.test(message)?'اطلاعات همزمان تغییر کرده؛ هیچ تغییری ثبت نشد. پیش‌نمایش را تازه کنید.':/SQLITE|D1|Database/.test(message)?'ثبت انجام نشد؛ وضعیت پایگاه داده را بررسی کنید.':message||'ورود فایل ممکن نشد.'},{status:/UNIQUE|inventory_operation_guard/.test(message)?409:400});}}
