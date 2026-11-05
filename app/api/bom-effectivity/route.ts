import {storage} from '@/lib/storage';
import {requireAccess,can,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
export async function GET(request:Request){try{
 const u=await requireAccess();if(!can(u,'product','read'))fail('دسترسی مشاهده محصول ندارید.',403);
 const productId=new URL(request.url).searchParams.get('productId')||'',db=storage();
 const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('bom_effectivity','sourcing_plan')").all()).results as any[];
 const entities=rows.map(r=>({...r,data:JSON.parse(r.data)})).filter(r=>r.data.productId===productId);
 return json({canApply:u.isAdmin||!!u.permissions.qmsRoles?.includes('qa'),history:entities.filter(r=>r.type==='bom_effectivity'),plans:entities.filter(r=>(u.isAdmin||u.permissions.qmsRoles?.includes('qa'))&&r.type==='sourcing_plan'&&['pending','waiting_bom'].includes(r.data.state)).map(r=>({id:r.id,revision:r.revision,count:r.data.count,reference:r.data.reference,needBy:r.data.needBy}))});
 }catch(e){return accessResponse(e)||json({error:'دریافت نقطه شروع BOM ممکن نشد.'})}}
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();if(!can(u,'product','read')||!(u.isAdmin||u.permissions.qmsRoles?.includes('qa')))fail('تعیین نقطه اجرا به مسئول تضمین کیفیت یا مدیر نیاز دارد.',403);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,20000))),db=storage();
 if(!['preview','apply'].includes(b.mode)||typeof b.productId!=='string'||typeof b.bomId!=='string'||!['future','plans'].includes(b.scope))fail('دامنه اجرا معتبر نیست.');
 const bom:any=await db.prepare('SELECT * FROM bom_versions WHERE id=? AND product_id=?').bind(b.bomId,b.productId).first();if(!bom)fail('نسخه BOM این محصول یافت نشد.');
 const planIds=b.scope==='plans'?b.planIds:[];if(!Array.isArray(planIds)||planIds.length>100||new Set(planIds).size!==planIds.length||planIds.some((id:any)=>typeof id!=='string')||b.scope==='plans'&&!planIds.length)fail('برنامه‌های شروع‌نشده را انتخاب کنید.');
 const signature=JSON.stringify({productId:b.productId,bomId:b.bomId,scope:b.scope,planIds:[...planIds].sort(),notes:b.notes});if(b.mode==='apply'&&b.confirmed===true&&b.qualityConfirmed===true&&typeof b.id==='string'){const prior:any=await db.prepare('SELECT * FROM inventory_operations WHERE id=?').bind(b.id).first();if(prior){if(prior.actor!==u.userId||prior.payload!==signature||prior.kind!=='bom_effectivity')fail('شناسه عملیات تکراری است.',409);return json({saved:true,repeated:true});}}
 const all=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('sourcing_plan','bom_effectivity') ORDER BY id").all()).results as any[];
 const plans=planIds.map((id:string)=>{const p=all.find(p=>p.id===id&&p.type==='sourcing_plan');if(!p)fail('برنامه یافت نشد.');const d=JSON.parse(p.data);if(d.productId!==b.productId||!['pending','waiting_bom'].includes(d.state)||d.bom)fail('فقط برنامه‌های منتظر تأیید و بدون BOM قابل انتخاب هستند.',409);return p;});
 const active=all.find(p=>p.id==='bom-effective:'+b.productId);
 const snapshot=JSON.stringify({bom:bom.lines,active:active?.data||null,plans:plans.map((p:any)=>({id:p.id,data:p.data,revision:p.revision}))});
 const token=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature+snapshot)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(b.mode==='preview')return json({token,version:bom.version,scope:b.scope,plans:plans.map((p:any)=>({id:p.id,...JSON.parse(p.data)})),notice:'تمام دستورها و سریال‌های قبلاً صادرشده با BOM قبلی ادامه می‌یابند. این عملیات مواد یا موجودی آن‌ها را تغییر نمی‌دهد.'});
 if(b.confirmed!==true||b.qualityConfirmed!==true||typeof b.notes!=='string'||!b.notes.trim()||b.notes.length>4000||! /^[a-f0-9-]{36}$/i.test(b.id||''))fail('تأیید کیفیت، دلیل و شناسه عملیات لازم است.');
 
 if(b.token!==token)fail('اطلاعات تغییر کرده؛ پیش‌نمایش را تازه کنید.',409);
 const now=new Date().toISOString(),data={productId:b.productId,bomId:b.bomId,version:bom.version,scope:b.scope,planIds,notes:b.notes,by:u.name,actor:u.userId,at:now,qualityConfirmed:true},stmts=[db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'bom_effectivity',signature,u.userId,now)];
 const guard=(sql:string,...args:any[])=>stmts.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+sql+' THEN guard ELSE 0 END WHERE id=?').bind(...args,b.id));
 guard('EXISTS(SELECT 1 FROM bom_versions WHERE id=? AND lines=?)',bom.id,bom.lines);
 if(b.scope==='future'){
  if(active)guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND data=?)',active.id,active.revision,active.data);else guard('NOT EXISTS(SELECT 1 FROM flow_entities WHERE id=?)','bom-effective:'+b.productId);
  stmts.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'bom_effectivity',?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated").bind('bom-effective:'+b.productId,JSON.stringify(data),now,now));
 }else for(const p of plans){guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND data=?)',p.id,p.revision,p.data);stmts.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify({...JSON.parse(p.data),effectiveBomId:bom.id,bomEffectivityId:b.id}),now,p.id));}
 stmts.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'bom_effectivity',?,1,?,?)").bind('bom-effectivity:'+b.id,JSON.stringify(data),now,now),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,b.productId,'apply_bom_effectivity',JSON.stringify(data),now));
 await db.batch(stmts);return json({saved:true});
 }catch(e){return accessResponse(e)||Response.json({error:'اعمال انجام نشد؛ پیش‌نمایش را تازه کنید.'},{status:409})}}
