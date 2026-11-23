import {assetLabelId,generatedAssetCode} from './asset-label';
import {assetActor,assetMembers,assetRows,assetFail,commitAssets,assetInternal} from './assets';
import {assetConditions} from './assets-contract';
import {assetCategory,nextAssetCode} from './asset-categories';
import {assetImageMime,assetRegistrationId} from './asset-registration';
import {storage} from './storage';
import {sha256} from './firmware';
import {firmwareBucket,boundedBody} from './firmware-storage';
import {dayAt,taskRequired,taskText} from './duties';
import type {Session} from './permissions';

const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const editable=(r:any)=>r&&['draft','returned'].includes(r.data.state);
const text=(v:unknown,n=300)=>taskText(v??'',n);
const owner=(r:any,a:any)=>r.data.memberId===a.id;
async function context(u:Session){const members=await assetMembers(),a=await assetActor(u,members),rows=await assetRows();return {members,a,rows};}
function access(rows:any[],id:string,a:any){const r=rows.find(r=>r.id===id&&r.type==='asset_declaration');if(!r||!a.custodian&&!owner(r,a))assetFail('اعلام اموال در دسترسی شما نیست.',404);return r;}
function codeIndex(rows:any[]){
 const byId=new Map<string,any>(),byCode=new Map<string,any[]>();
 for(const row of rows){
  if(!['asset_item','asset_archived'].includes(row.type))continue;
  byId.set(row.id.toLowerCase(),row);
  const code=generatedAssetCode(String(row.data.code||''));
  if(code)byCode.set(code,[...(byCode.get(code)||[]),row]);
 }
 return {byId,byCode};
}
function matchCode(raw:string,index:ReturnType<typeof codeIndex>){
 const id=assetLabelId(raw).toLowerCase(),code=generatedAssetCode(raw);
 const candidates=id?[index.byId.get(id)].filter(Boolean):index.byCode.get(code)||[];
 if(candidates.length>1)return {state:'conflict'} as const;
 const asset=candidates[0];
 if(!asset)return {state:raw?'legacy':'empty'} as const;
 if(asset.type==='asset_archived'||asset.data.lifecycle==='disposed')return {state:'inactive'} as const;
 return {state:'existing',asset} as const;
}
function assetOption(r:any){return {id:r.id,revision:r.revision,name:r.data.name,code:r.data.code,holderName:r.data.holderName,holderKind:r.data.holderKind,holderId:r.data.holderId};}
function publicRecord(r:any,rows:any[],index?:ReturnType<typeof codeIndex>){
 const codeMatches=index?(r.data.items||[]).map((item:any)=>{
  const result=matchCode(String(item.existingCode||''),index);
  return result.state==='existing'?{state:result.state,asset:assetOption(result.asset)}:{state:result.state};
 }):undefined;
 return {...r,...(codeMatches?{codeMatches}:{}),files:rows.filter(f=>f.type==='asset_file'&&f.data.declarationId===r.id).map(f=>({id:f.id,number:f.data.registrationNumber,filename:f.data.filename,url:'/api/assets/declarations/files?id='+encodeURIComponent(f.id)}))};
}
function entries(input:any,strict:boolean,noAssets:boolean){
 if(noAssets){if(input?.length)assetFail('در اعلام نداشتن مال نباید ردیف مال وجود داشته باشد.');return [];}
 if(!Array.isArray(input)||input.length<1||input.length>20)assetFail('هر اعلام باید بین یک تا بیست مال داشته باشد.');
 return input.map((v:any,i:number)=>{
  if(!v||typeof v!=='object')assetFail('ردیف مال معتبر نیست.');
  const row={number:i+1,name:text(v.name,200),category:text(v.category,100),location:text(v.location,300),brand:text(v.brand,100),model:text(v.model,100),serial:text(v.serial,200),condition:text(v.condition,20),existingCode:text(v.existingCode,100),notes:text(v.notes,1000),photoFileIds:Array.isArray(v.photoFileIds)?v.photoFileIds:[]};
  if(strict&&(!row.name||!row.category||!row.location||!Object.hasOwn(assetConditions,row.condition)))assetFail('نام، گروه، محل و وضعیت هر مال لازم است.');
  if(row.condition&&!Object.hasOwn(assetConditions,row.condition)||row.photoFileIds.length>5||row.photoFileIds.some((s:any)=>!uuid(s)))assetFail('عکس یا وضعیت ردیف معتبر نیست.');
  return row;
 });
}
function checkPhotos(items:any[],r:any,rows:any[]){const used=new Set<string>();for(const item of items){if(!item.photoFileIds.length)assetFail('برای تک‌تک اموال عکس جداگانه لازم است.');for(const id of item.photoFileIds){const f=rows.find(x=>x.id===id&&x.type==='asset_file');if(used.has(id)||!f||f.data.declarationId!==r.id||f.data.registrationNumber!==item.number||f.data.actor!==r.data.createdBy)assetFail('عکس باید متعلق به همین شخص، اعلام و شماره مال باشد.');used.add(id);}}if(used.size>40)assetFail('حداکثر چهل عکس در هر اعلام مجاز است.');}
export async function readAssetDeclarations(u:Session,q:URLSearchParams){
 const {a,rows,members}=await context(u),review=q.get('review')==='true';if(review&&!a.custodian)assetFail('بررسی اعلام‌ها فقط برای اموالدار است.',403);
 if(q.has('assetSearch')){if(!a.custodian)assetFail('جست‌وجوی دفتر اموال فقط برای اموالدار است.',403);const term=text(q.get('assetSearch'),100).toLocaleLowerCase();return {accountId:u.userId,assets:term?rows.filter(r=>r.type==='asset_item'&&r.data.lifecycle!=='disposed'&&(r.data.code+' '+r.data.name+' '+(r.data.serial||'')).toLocaleLowerCase().includes(term)).slice(0,30).map(r=>({id:r.id,revision:r.revision,name:r.data.name,code:r.data.code,holderName:r.data.holderName,holderKind:r.data.holderKind,holderId:r.data.holderId})):[]};}
 const records=q.get('id')?[access(rows,q.get('id')!,a)]:rows.filter(r=>r.type==='asset_declaration'&&(review?['submitted','returned','approved'].includes(r.data.state):owner(r,a))).sort((x,y)=>y.updated.localeCompare(x.updated)).slice(0,100);
 const index=review?codeIndex(rows):undefined;
 return {accountId:u.userId,me:a.id,custodian:a.custodian,review,records:records.map(r=>publicRecord(r,rows,index)),conditions:assetConditions,personName:members.find(m=>m.id===a.id)?.name||u.name};
}
export async function applyAssetDeclaration(u:Session,b:any){
 if(!b||!uuid(b.id)||b.confirmed!==true||!['save','submit','approve','return'].includes(b.mode)||!Number.isSafeInteger(b.revision)||b.revision<0)assetFail('شناسه، نسخه و تأیید عملیات لازم است.');
 const allowed=['id','recordId','revision','confirmed','mode','items','noAssets','holderConfirmed','notes','matched','reviewItems'];if(Object.keys(b).some(k=>!allowed.includes(k)))assetFail('اطلاعات خارج از فرم اعلام اموال مجاز نیست.');
 const db=storage(),{a,rows,members}=await context(u),recordId=b.recordId||b.id;if(!uuid(recordId))assetFail('شناسه اعلام معتبر نیست.');
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature)assetFail('شناسه عملیات با اطلاعات دیگری استفاده شده است.',409);const r=access(rows,recordId,a);return {saved:true,id:r.id,record:publicRecord(r,rows),repeated:true};}
 let old=rows.find(r=>r.id===recordId&&r.type==='asset_declaration');if(old)old=access(rows,recordId,a);if((old?.revision||0)!==b.revision)assetFail('اعلام تغییر کرده است؛ اطلاعات را تازه کنید.',409);
 const now=new Date().toISOString(),notes=text(b.notes,4000),history=(data:any)=>({...data,history:[...(old?.data.history||[]),{at:now,actor:u.userId,name:u.name,mode:b.mode,notes,state:data.state}]});
 if((old?.data.history||[]).length>=200)assetFail('سقف سابقه اعلام پر شده است.');
 const changes:any[]=[];
 if(b.mode==='save'||b.mode==='submit'){
  if(!a.id||!members.some(m=>m.id===a.id&&assetInternal(m)))assetFail('حساب کارکنان فعال لازم است.',403);
  const reopen=old?.data.state==='submitted'&&b.mode==='save';
  if(old&&(!owner(old,a)||(!editable(old)&&!reopen)))assetFail('فقط اعلام خودتان تا پیش از تأیید اموال‌دار قابل ویرایش است.',403);
  const hr:any=await db.prepare("SELECT data,revision,id FROM flow_entities WHERE type='hr_employee' AND json_extract(data,'$.memberId')=?").bind(a.id).first();if(!hr||JSON.parse(hr.data).state!=='active')assetFail('ابتدا اطلاعات پرونده پرسنلی باید تأیید شود.',409);
  const noAssets=b.noAssets===true,items=entries(b.items,b.mode==='submit',noAssets);
  if(b.mode==='submit'){if(b.holderConfirmed!==true)assetFail('تأیید موجودی نزد خودتان لازم است.');checkPhotos(items,old||{id:recordId,data:{createdBy:u.userId}},rows);}
  if(old){const removed=(old.data.items||[]).some((v:any,i:number)=>(v.photoFileIds||[]).some((id:string)=>!items[i]?.photoFileIds.includes(id)));if(removed)assetFail('ردیف یا عکس بارگذاری‌شده را از اعلام حذف نکنید؛ شماره عکس‌ها باید حفظ شود.');}
  const data=history({...old?.data,memberId:a.id,memberName:members.find(m=>m.id===a.id)!.name,createdBy:old?.data.createdBy||u.userId,createdAt:old?.data.createdAt||now,noAssets,items,state:b.mode==='submit'?'submitted':'draft',...(b.mode==='submit'?{submittedAt:now,holderConfirmedAt:now}:{})});
  changes.push({id:recordId,type:'asset_declaration',revision:old?.revision||0,data});
  const guard=db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND json_extract(data,'$.state')='active') THEN guard ELSE 0 END WHERE id=?").bind(hr.id,hr.revision,b.id);
  await commitAssets(u,b.id,signature,rows,members,changes,'declaration_'+b.mode,[guard]);return {saved:true,id:recordId,record:publicRecord({...changes[0],revision:(old?.revision||0)+1},rows)};
 }
 if(!a.custodian)assetFail('تأیید اعلام فقط برای اموالدار است.',403);
 if(!old||old.data.state!=='submitted')assetFail('اعلام ارسال‌شده برای بررسی را انتخاب کنید.',409);
 if(owner(old,a)||old.data.createdBy===u.userId)assetFail('تأیید اعلام خودتان باید توسط اموالدار دیگری انجام شود.',403);
 if(b.mode==='return'){
  if(!notes)assetFail('دلیل برگشت برای اصلاح لازم است.');changes.push({...old,data:history({...old.data,state:'returned',reviewNotes:notes,reviewedBy:u.userId,reviewedAt:now})});
 }else{
  if(b.matched!==true)assetFail('تأیید تطبیق مال، عکس، وضعیت و دارنده لازم است.');
  const person=members.find(m=>m.id===old!.data.memberId&&assetInternal(m));if(!person)assetFail('حساب صاحب اعلام فعال نیست.',409);
  const hr:any=await db.prepare("SELECT id,revision,data FROM flow_entities WHERE type='hr_employee' AND json_extract(data,'$.memberId')=?").bind(person.id).first();if(!hr||JSON.parse(hr.data).state!=='active')assetFail('پرونده پرسنلی فعال برای تأیید لازم است.',409);
  if(rows.some(r=>r.type==='asset_clearance'&&r.data.memberId===person.id&&r.data.state!=='cancelled'))assetFail('فرد در فرایند تسویه اموال است.',409);
  if(old.data.noAssets&&rows.some(r=>r.type==='asset_item'&&r.data.holderKind==='employee'&&r.data.holderId===person.id&&r.data.lifecycle!=='disposed'))assetFail('در دفتر اموال، مال نزد این فرد ثبت شده است؛ ابتدا مغایرت را تعیین تکلیف کنید.',409);
  const source=entries(old.data.items,true,!!old.data.noAssets);checkPhotos(source,old,rows);
  const edits=b.reviewItems===undefined?source.map((r:any)=>({...r,existingAssetId:'',assetRevision:0,copies:1})):b.reviewItems;
  if(!Array.isArray(edits)||edits.length!==source.length)assetFail('همه ردیف‌های اعلام باید یکجا بررسی شوند.');
  const assigned=new Set<string>(),serials=new Set<string>(),approvedItems:any[]=[],groupId=assetRegistrationId(b.id),indexByCode=codeIndex(rows);
  for(let index=0;index<source.length;index++){
   const original=source[index],edit=edits[index];if(!edit||Object.keys(edit).some(k=>!['number','name','category','location','brand','model','serial','condition','existingCode','notes','photoFileIds','existingAssetId','assetRevision','copies'].includes(k)))assetFail('جزئیات بررسی معتبر نیست.');
   const item=entries([{...original,...edit,photoFileIds:original.photoFileIds}],true,false)[0];item.number=index+1;
   if(['name','category','location','brand','model','serial','condition'].some(k=>(item as any)[k]!==original[k])&&!notes)assetFail('دلیل تغییر مشخصات اعلام‌شده لازم است.');
   const copies=Number(edit.copies??1);if(!Number.isInteger(copies)||copies<1||copies>20)assetFail('تعداد لیبل هر مال بین یک و بیست باشد.');
   const codeMatch=matchCode(original.existingCode,indexByCode);
   if(codeMatch.state==='conflict')assetFail('برای این کد بیش از یک شناسنامه ثبت شده است؛ ابتدا مغایرت کد را بررسی کنید.',409);
   if(codeMatch.state==='inactive')assetFail('این کد هم‌نفس متعلق به مال بایگانی‌شده یا خارج‌شده است؛ ابتدا مغایرت را بررسی کنید.',409);
   const expected=codeMatch.state==='existing'?codeMatch.asset:null;
   let existing=edit.existingAssetId?rows.find(r=>r.id===edit.existingAssetId&&r.type==='asset_item'):expected;
   if(edit.existingAssetId&&!existing)assetFail('مال انتخاب‌شده یافت نشد.',404);
   if(expected&&existing?.id!==expected.id)assetFail('کد اعلام‌شده باید با همان شناسنامه تطبیق داده شود.',409);
   if(existing&&(existing.revision!==Number(edit.assetRevision)||assigned.has(existing.id)))assetFail('شناسنامه تغییر کرده یا دو بار انتخاب شده است.',409);
   if(existing&&(existing.data.lifecycle==='disposed'||existing.data.pending||existing.data.holderKind!=='stock'&&!(existing.data.holderKind==='employee'&&existing.data.holderId===person.id)))assetFail('مال نزد دارنده دیگری است یا انتقال باز دارد؛ ابتدا تعارض را تعیین تکلیف کنید.',409);
   const serial=item.serial.trim().toLocaleLowerCase();if(serial&&(serials.has(serial)||rows.some(r=>r.type==='asset_item'&&r.id!==existing?.id&&String(r.data.serial||'').trim().toLocaleLowerCase()===serial)))assetFail('این سریال قبلاً ثبت شده است؛ شناسنامه موجود را تطبیق دهید.',409);if(serial)serials.add(serial);
   const assetId=existing?.id||crypto.randomUUID(),code=existing?.data.code||nextAssetCode([...rows,...changes]),kind=assetCategory(item.category)?.kind||'office',same=existing?.data.holderKind==='employee'&&existing.data.holderId===person.id,custodyId=same?existing!.data.custodyId:crypto.randomUUID();assigned.add(assetId);
   const data={...(existing?.data||{}),code,name:item.name,category:item.category,brand:item.brand,model:item.model,serial:item.serial,condition:item.condition,assetKind:existing?.data.assetKind||kind,controlled:existing?.data.controlled||['mold','machine'].includes(kind),lifecycle:'active',meters:existing?.data.meters||{hours:0,cycles:0},useState:existing?.data.useState||'available',holderKind:'employee',holderId:person.id,holderName:person.name,location:item.location,custodyId,handedDay:same?existing!.data.handedDay||'':'',inventoryAsOf:dayAt(),registrationBasis:existing?.data.registrationBasis||'opening_inventory',openingDeclarationId:old.id,annualDue:existing?.data.annualDue||'',...(existing?{}:{registrationGroupId:groupId,registrationNumber:index+1,registrationCount:source.length,registrationPhotoId:item.photoFileIds[0],labelCopies:copies}),history:[...(existing?.data.history||[]),{at:now,actor:u.userId,name:u.name,mode:'opening_inventory',notes,holderKind:'employee',holderId:person.id,holderName:person.name,location:item.location,condition:item.condition,custodyId,declarationId:old.id,declaredBy:old.data.createdBy}]};
   changes.push({id:assetId,type:'asset_item',revision:existing?.revision||0,data},{id:crypto.randomUUID(),type:'asset_event',revision:0,data:{assetId,custodyId,mode:'opening_inventory',at:now,actor:u.userId,name:u.name,notes,details:{declarationId:old.id,declaredBy:old.data.createdBy,holderId:person.id}}});
   for(const fileId of item.photoFileIds){const f=rows.find(r=>r.id===fileId&&r.type==='asset_file')!;changes.push({...f,data:{...f.data,purpose:'asset_photo',assetId,custodyId,staged:false}});}
   approvedItems.push({assetId,code,number:index+1,copies,photoFileIds:item.photoFileIds});
  }
  if(approvedItems.length)changes.push({id:groupId,type:'asset_registration',revision:0,data:{name:'موجودی ابتدای استقرار · '+person.name,items:approvedItems,createdBy:u.userId,createdAt:now,declarationId:old.id}});
  changes.push({...old,data:history({...old.data,state:'approved',reviewedBy:u.userId,reviewedName:u.name,reviewedAt:now,reviewNotes:notes,approvedItems,groupId:approvedItems.length?groupId:''})});
  const guard=db.prepare("UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND json_extract(data,'$.state')='active') THEN guard ELSE 0 END WHERE id=?").bind(hr.id,hr.revision,b.id);
  await commitAssets(u,b.id,signature,rows,members,changes,'declaration_approve',[guard]);return {saved:true,id:old.id,record:publicRecord({...changes.at(-1),revision:old.revision+1},[...rows,...changes.filter(r=>!rows.some(x=>x.id===r.id))])};
 }
 await commitAssets(u,b.id,signature,rows,members,changes,'declaration_return');return {saved:true,id:old.id,record:publicRecord({...changes[0],revision:old.revision+1},rows)};
}
export async function uploadDeclarationPhoto(u:Session,request:Request){
 const q=new URL(request.url).searchParams,id=q.get('id'),recordId=q.get('recordId')||'',number=Number(q.get('number')),revision=Number(q.get('revision'));if(!uuid(id)||q.get('confirmed')!=='true'||!Number.isInteger(number)||number<1||number>20)assetFail('شناسه و ردیف عکس معتبر لازم است.');
 const {a,rows,members}=await context(u),r=access(rows,recordId,a);if(!owner(r,a)||!editable(r))assetFail('فقط عکس اعلام پیش‌نویس یا برگشتی خودتان قابل بارگذاری است.',403);
 const bytes=await boundedBody(request,10*1024*1024),mime=assetImageMime(new Uint8Array(bytes));if(!mime)assetFail('فقط تصویر JPEG، PNG یا WEBP معتبر مجاز است.');
 const hash=await sha256(bytes),signature=JSON.stringify({recordId,number,hash}),prior:any=await storage().prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(id).first();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature)assetFail('شناسه عکس قبلاً استفاده شده است.',409);return {saved:true,id,record:publicRecord(r,rows),repeated:true};}
 if(r.revision!==revision)assetFail('اعلام تغییر کرده است؛ تازه‌سازی کنید.',409);
 const items=entries(r.data.items,false,!!r.data.noAssets),item=items[number-1];if(!item||item.photoFileIds.length>=5||items.reduce((n:number,x:any)=>n+x.photoFileIds.length,0)>=40)assetFail('ردیف عکس یا تعداد عکس‌ها معتبر نیست.');
 const key='asset-declarations/'+r.id+'/'+id+'/'+hash,made=new Date().toISOString(),file={id,type:'asset_file',revision:0,data:{purpose:'declaration_photo',declarationId:r.id,registrationNumber:number,actor:u.userId,objectKey:key,filename:taskRequired(q.get('filename'),180),mime,byteSize:bytes.byteLength,sha256:hash,staged:true}};item.photoFileIds=[...item.photoFileIds,id!];
 await firmwareBucket().put(key,bytes,{httpMetadata:{contentType:mime}});
 try{await commitAssets(u,id!,signature,rows,members,[file,{...r,data:{...r.data,items}}],'declaration_photo');}catch(error){const persisted:any=await storage().prepare('SELECT data FROM flow_entities WHERE id=?').bind(id).first();if(!persisted||JSON.parse(persisted.data).objectKey!==key)try{await firmwareBucket().delete(key)}catch{}throw error;}
 return {saved:true,id,record:publicRecord({...r,revision:r.revision+1,updated:made,data:{...r.data,items}},[...rows,file])};
}
export async function declarationPhoto(u:Session,id:string){const {a,rows}=await context(u),f=rows.find(r=>r.id===id&&r.type==='asset_file'&&r.data.declarationId);if(!f)assetFail('عکس یافت نشد.',404);access(rows,f.data.declarationId,a);const obj=await firmwareBucket().get(f.data.objectKey);if(!obj)assetFail('فایل در دسترس نیست.',404);const bytes=await obj!.arrayBuffer();if(bytes.byteLength!==f.data.byteSize||await sha256(bytes)!==f.data.sha256)assetFail('یکپارچگی عکس تأیید نشد.',503);return new Response(bytes,{headers:{'Content-Type':f.data.mime,'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});}
