import {storage} from '@/lib/storage';
import {requireAccess,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {normalizeMaterialImportRows,parseMaterialImportGrid} from '@/lib/material-import';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();
 if(!u.isAdmin&&!u.permissions.flowRoles?.includes('inventory'))fail('ورود گروهی کالا به مجوز تعریف کالا در انبار نیاز دارد.',403);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,180000)));
 if(!b||typeof b!=='object'||Array.isArray(b))fail('ساختار درخواست معتبر نیست.');
 if(b.mode==='parse'){try{return json({rows:parseMaterialImportGrid(b.grid,b.header,b.mapping)});}catch(e){fail(e instanceof Error?e.message:'ساختار فایل معتبر نیست.');}}
 if(!['preview','commit'].includes(b.mode))fail('عملیات ورود کالا معتبر نیست.');
 if(typeof b.source!=='string'||!b.source.trim()||b.source.length>500)fail('نام فایل را مشخص کنید.');
 const source=b.source.trim();let normalized:ReturnType<typeof normalizeMaterialImportRows>;
 try{normalized=normalizeMaterialImportRows(b.rows);}catch(e){return json({error:e instanceof Error?e.message:'فهرست معتبر نیست.'},400);}
 const rows=normalized.rows.sort((a,b)=>a.code.localeCompare(b.code)),db=storage(),now=new Date().toISOString();
 const signature=JSON.stringify({source,rows,catalogSnapshot:b.catalogSnapshot});
 if(b.mode==='commit'){
  if(b.confirmed!==true)fail('پیش‌نمایش را بررسی و ثبت را تأیید کنید.');
  if(typeof b.id!=='string'||! /^[a-f0-9-]{36}$/i.test(b.id))fail('شناسه عملیات معتبر نیست.');
  if(normalized.errors.length)fail(normalized.errors.join('\n'));
  const prior:any=await db.prepare('SELECT * FROM inventory_operations WHERE id=?').bind(b.id).first();
  if(prior){
   if(prior.kind!=='material_import'||prior.actor!==u.userId||prior.payload!==signature)fail('شناسه متعلق به درخواست دیگری است.',409);
   const audit:any=await db.prepare("SELECT after FROM access_audit WHERE target=? AND actor=? AND action='material_import'").bind(b.id,u.userId).first();
   if(!audit)fail('نتیجه ثبت قبلی در دسترس نیست.',409);
   return json({...JSON.parse(audit.after),saved:true,repeated:true});
  }
 }
 const materials:any[]=[],errors=[...normalized.errors],warnings:string[]=[],newCodes:string[]=[];
 for(const row of rows){
  const existing:any=await db.prepare('SELECT * FROM flow_entities WHERE id=?').bind('material:'+row.code).first();materials.push(existing);
  if(!existing){newCodes.push(row.code);continue;}
  const data=JSON.parse(existing.data);
  if(existing.type!=='material'||data.unit!==row.unit)errors.push(row.code+': واحد با شناسنامه موجود یکسان نیست ('+String(data.unit||'—')+').');
  if(data.name!==row.name)warnings.push(row.code+': شناسنامه موجود با نام «'+String(data.name||'—')+'» حفظ می‌شود.');
 }
 const snapshotData={source,rows,materials:materials.map(m=>m?{id:m.id,type:m.type,revision:m.revision,data:m.data}:null)};
 const catalogSnapshot=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(snapshotData))))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const counts={totalCount:rows.length,newMaterialCount:newCodes.length,existingCount:rows.length-newCodes.length};
 if(b.mode==='preview')return json({rows,source,errors,warnings,newCodes,catalogSnapshot,...counts});
 if(errors.length)fail(errors.join('\n'));
 if(b.catalogSnapshot!==catalogSnapshot)fail('ردیف‌ها یا شناسنامه کالاها تغییر کرده؛ پیش‌نمایش را دوباره بررسی کنید.',409);
 const checks:D1PreparedStatement[]=[],writes:D1PreparedStatement[]=[];
 rows.forEach((row,index)=>{
  const mid='material:'+row.code,m=materials[index];
  checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+(m?"EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='material' AND revision=? AND data=?)":'NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?)')+' THEN guard ELSE 0 END WHERE id=?').bind(...(m?[mid,m.revision,m.data]:[mid]),b.id));
  if(!m)writes.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'material',?,1,?,?)").bind(mid,JSON.stringify({...row,specs:'',fields:[],importSource:source,importKind:'material_import',qcSetupRequired:true}),now,now));
 });
 const result={saved:true,importId:b.id,source,newCodes,...counts};
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'material_import',signature,u.userId,now),...checks,...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,b.id,'material_import',JSON.stringify(result),now)]);
 return json(result);
 }catch(e){
  const denied=accessResponse(e);if(denied)return denied;
  const message=e instanceof Error?e.message:'';
  if(/UNIQUE|inventory_operation_guard|FOREIGN KEY/i.test(message))return json({error:'اطلاعات هم‌زمان تغییر کرده؛ پیش‌نمایش را دوباره بررسی کنید.'},409);
  if(e instanceof SyntaxError)return json({error:'ساختار درخواست معتبر نیست.'},400);
  return json({error:'پاسخ قطعی ثبت دریافت نشد؛ همین درخواست را دوباره بررسی کنید.'},503);
 }}
