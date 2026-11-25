import {AccessError} from './authorization';
import {asciiDigits} from './batch-number';
import {materialAccountingCode,materialAccountingKey} from './material-accounting-code';
import type {Session} from './permissions';
import {storage} from './storage';
import {supplierSearchText} from './supplier-contract';
import type {VendorImportRow,VendorLinkImportRow} from './supplier-import-contract';

const stagingType='supplier_pending_material';
type Stored={id:string;type:string;data:string;revision:number};
type Row=Omit<Stored,'data'>&{values:any};
type Write={id:string;type:string;data:any;revision?:number};
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const safeText=(value:unknown,max:number)=>{
 if(typeof value!=='string'||value.length>max)throw new AccessError('یکی از مقادیر فایل طول یا ساختار معتبر ندارد.',400);
 return value.trim();
};
function code(value:unknown){
 const key=materialAccountingKey(materialAccountingCode(value));
 return key||fail('کد تفصیلی یا کد حسابداری نباید خالی باشد.');
}
const pair=(supplierId:string,itemCode:string)=>JSON.stringify([supplierId,itemCode]);
const stagingId=(vendorCode:string,itemCode:string)=>'supplier-pending:'+encodeURIComponent(vendorCode)+':'+encodeURIComponent(itemCode);
async function hash(value:unknown){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))));
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function workbook(input:any){
 if(!Array.isArray(input.vendors)||!input.vendors.length||input.vendors.length>500||!Array.isArray(input.links)||input.links.length>2000)
  fail('فایل باید تا ۵۰۰ تأمین‌کننده و تا ۲۰۰۰ ارتباط داشته باشد.');
 const vendorKeys=new Set<string>(),pairKeys=new Set<string>();
 const vendors:VendorImportRow[]=input.vendors.map((row:any)=>{
  const vendorCode=code(row?.vendorCode),name=safeText(row.name,500),legalType=safeText(row.legalType,40),nationalId=asciiDigits(safeText(row.nationalId,32));
  if(!name||!['شخص حقیقی','شخص حقوقی'].includes(legalType)||nationalId&&(!/^\d+$/.test(nationalId)||legalType!=='شخص حقوقی'))fail('نام، نوع شخص یا شناسهٔ ملی تأمین‌کنندهٔ '+vendorCode+' معتبر نیست.');
  if(vendorKeys.has(vendorCode))fail('کد تفصیلی '+vendorCode+' در برگهٔ تأمین‌کنندگان تکراری است.');
  vendorKeys.add(vendorCode);return {vendorCode,name,legalType,nationalId,phone:safeText(row.phone,100),address:safeText(row.address,500)};
 });
 const links:VendorLinkImportRow[]=input.links.map((row:any)=>{
  const vendorCode=code(row?.vendorCode),itemCode=code(row.itemCode),key=pair(vendorCode,itemCode),reason=safeText(row.reason,500);
  if(!vendorKeys.has(vendorCode)||typeof row.hold!=='boolean'||row.hold&&!reason)fail('ارتباط '+vendorCode+' / '+itemCode+' ناقص است.');
  if(pairKeys.has(key))fail('ارتباط '+vendorCode+' / '+itemCode+' در فایل تکراری است.');
  pairKeys.add(key);return {vendorCode,itemCode,itemName:safeText(row.itemName,500),hold:row.hold,reason};
 });
 return {vendors,links};
}

export async function supplierImport(user:Session,input:any){
 if(!user.isAdmin||user.profileReview)fail('ورود اکسل تأمین‌کنندگان فقط برای مدیر سامانه است.',403);
 const mode=input?.mode;
 if(!['preview','commit','preview_links','commit_links'].includes(mode))fail('عملیات ورود معتبر نیست.');
 const reconcile=mode.endsWith('_links'),commit=mode.startsWith('commit'),source=reconcile?'':safeText(input.source,300);
 if(!reconcile&&!source)fail('نام فایل لازم است.');
 const draft=reconcile?null:workbook(input),db=storage();
 const operation=reconcile?'supplier_import_links':'supplier_import';
 const signature=await hash({operation,source,draft,snapshot:input.snapshot});
 let id='';
 if(commit){
  id=String(input.id||'');if(!/^[-a-f0-9]{36}$/i.test(id)||input.confirmed!==true)fail('ثبت به تأیید و شناسهٔ معتبر نیاز دارد.');
  const prior=await db.prepare("SELECT kind,payload,actor FROM inventory_operations WHERE id=?").bind(id).first<{kind:string;payload:string;actor:string}>();
  if(prior){
   if(prior.kind!==operation||prior.actor!==user.userId||prior.payload!==signature)fail('شناسهٔ عملیات تکراری است.',409);
   const previous=await db.prepare('SELECT after FROM access_audit WHERE target=? AND actor=? AND action=?').bind(id,user.userId,operation).first<{after:string}>();
   if(!previous)fail('نتیجهٔ عملیات قبلی در دسترس نیست.',409);
   return {...JSON.parse(previous!.after),repeated:true};
  }
 }
 const types=reconcile?['supplier',stagingType,'material','supplier_material']:['supplier',stagingType];
 const stored=(await db.prepare('SELECT id,type,data,revision FROM flow_entities WHERE type IN ('+types.map(()=>'?').join(',')+') ORDER BY id').bind(...types).all<Stored>()).results;
 const rows=stored.map(r=>({...r,values:JSON.parse(r.data)}) as Row);
 const suppliers=rows.filter(r=>r.type==='supplier'&&r.values.route==='domestic'),staged=rows.filter(r=>r.type===stagingType);
 const pendingById=new Map(staged.map(row=>[row.id,row]));
 const usedIds=new Set(rows.map(row=>row.id));
 const vendorMap=new Map<string,Row[]>();
 for(const row of suppliers){
  const vendorCode=materialAccountingKey(String(row.values.accountingVendorCode||''));
  if(vendorCode)vendorMap.set(vendorCode,[...vendorMap.get(vendorCode)||[],row]);
 }
 const changes:Write[]=[],review:{vendorCode:string;itemCode?:string;title:string;reason:string}[]=[];
 const counts={created:0,reused:0,staged:0,held:0,unchanged:0,waiting:0,ready:0,existingLinks:0};
 if(draft){
  const resolved=new Map<string,string>();
  for(const vendor of draft.vendors){
   const exact=vendorMap.get(vendor.vendorCode)||[];
   if(exact.length===1&&!exact[0].values.deletedAt){
    resolved.set(vendor.vendorCode,exact[0].id);counts.reused++;continue;
   }
   const name=supplierSearchText(vendor.name);
   const possible=suppliers.filter(r=>supplierSearchText(r.values.name)===name||vendor.nationalId&&r.values.nationalId===vendor.nationalId);
   const id='supplier-finance:'+encodeURIComponent(vendor.vendorCode);
   if(exact.length||possible.length||usedIds.has(id)){
    review.push({vendorCode:vendor.vendorCode,title:vendor.name,reason:exact.length?'کد تفصیلی تکراری یا پرونده بایگانی است.':'پروندهٔ مشابه وجود دارد؛ کد تفصیلی را در پروندهٔ درست ثبت کنید و دوباره بررسی کنید.'});
    continue;
   }
   resolved.set(vendor.vendorCode,id);usedIds.add(id);counts.created++;
   changes.push({id,type:'supplier',data:{route:'domestic',accountingVendorCode:vendor.vendorCode,name:vendor.name,legalType:vendor.legalType,nationalId:vendor.nationalId,phone:vendor.phone,phones:vendor.phone?[vendor.phone]:[],address:vendor.address,country:'ایران',contact:'',kind:'',active:false,importedForSetup:true,importSource:source}});
  }
  for(const row of draft.links){
   const supplierId=resolved.get(row.vendorCode);
   if(!supplierId){counts.waiting++;continue;}
   if(row.hold)review.push({vendorCode:row.vendorCode,itemCode:row.itemCode,title:row.itemName,reason:row.reason});
   const id=stagingId(row.vendorCode,row.itemCode),prior=pendingById.get(id);
   if(prior&&(prior.values.state==='linked'||prior.values.hold===row.hold)){counts.unchanged++;continue;}
   if(row.hold)counts.held++;else counts.staged++;
   changes.push({id,type:stagingType,revision:prior?.revision,data:{...row,supplierId,state:'waiting',source}});
  }
 }else{
  const materials=new Map<string,Row[]>(),linked=new Map(rows.filter(r=>r.type==='supplier_material').map(r=>[pair(r.values.supplierId,r.values.materialId),r.id]));
  const supplierIds=new Map(suppliers.map(s=>[s.id,s]));
  for(const row of rows.filter(r=>r.type==='material')){
   const key=materialAccountingKey(String(row.values.accountingCode||''));
   if(key)materials.set(key,[...materials.get(key)||[],row]);
  }
  for(const row of staged){
   const item=row.values;
   if(item.state==='linked'){counts.unchanged++;continue;}
   if(item.hold){counts.held++;review.push({vendorCode:item.vendorCode,itemCode:item.itemCode,title:item.itemName,reason:item.reason});continue;}
   const supplier=supplierIds.get(item.supplierId),matches=materials.get(item.itemCode)||[];
   if(!supplier||supplier.values.deletedAt||materialAccountingKey(String(supplier.values.accountingVendorCode||''))!==item.vendorCode||matches.length>1){
    review.push({vendorCode:item.vendorCode,itemCode:item.itemCode,title:item.itemName,reason:matches.length>1?'کد کالا در چند شناسنامه آمده است.':'پروندهٔ تأمین‌کننده باید بررسی شود.'});continue;
   }
   if(!matches.length){counts.waiting++;continue;}
   const material=matches[0],key=pair(supplier.id,material.id);
   let linkId=linked.get(key);
   if(linkId)counts.existingLinks++;
   else{
    linkId='supplier-material-import:'+row.id;counts.ready++;
    linked.set(key,linkId);
    changes.push({id:linkId,type:'supplier_material',data:{supplierId:supplier.id,materialId:material.id,partCode:material.values.code,status:'pending',specs:material.values.specs||'',unit:material.values.unit,qualityRisk:'high',supplyRisk:'high',reviewDue:'',supplierRevision:supplier.revision,notes:''}});
   }
   changes.push({id:row.id,type:stagingType,revision:row.revision,data:{...item,state:'linked',materialId:material.id,linkId}});
  }
 }
 const snapshot=await hash({source,draft,stored,changes}),result={...counts,snapshot,reviewCount:review.length,review:review.slice(0,100)};
 if(!commit)return result;
 if(input.snapshot!==snapshot)fail('اطلاعات تغییر کرد؛ پیش‌نمایش را دوباره بررسی کنید.',409);
 const now=new Date().toISOString(),writes=JSON.stringify(changes),revisions=JSON.stringify(stored.map(row=>[row.id,row.revision]));
 const whereType='type IN ('+types.map(()=>'?').join(',')+')';
 await db.batch([
  db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)").bind(id,operation,signature,user.userId,now),
  db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT COUNT(*) FROM flow_entities WHERE "+whereType+")=? AND NOT EXISTS(SELECT 1 FROM json_each(?) e LEFT JOIN flow_entities f ON f.id=json_extract(e.value,'$[0]') WHERE f.id IS NULL OR f.revision<>json_extract(e.value,'$[1]')) THEN guard ELSE 0 END WHERE id=?").bind(...types,stored.length,revisions,id),
  db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) SELECT json_extract(value,'$.id'),json_extract(value,'$.type'),json_extract(value,'$.data'),1,?,? FROM json_each(?) WHERE json_extract(value,'$.revision') IS NULL").bind(now,now,writes),
  db.prepare("UPDATE flow_entities AS f SET data=json_extract(j.value,'$.data'),revision=f.revision+1,updated=? FROM json_each(?) AS j WHERE f.id=json_extract(j.value,'$.id') AND f.revision=json_extract(j.value,'$.revision')").bind(now,writes),
  db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),user.userId,id,operation,JSON.stringify({...result,saved:true}),now)
 ]);
 return {...result,saved:true};
}
