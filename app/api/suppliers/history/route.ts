import {AccessError,accessResponse,checkOrigin,requireAccess} from '@/lib/authorization';
import {MAX_BATCH_FILE_BYTES,validateBatchFile} from '@/lib/batch-files';
import {asciiDigits} from '@/lib/batch-number';
import {dayAt,taskRequired,taskText,validDay} from '@/lib/duties';
import {sha256} from '@/lib/firmware';
import {boundedBody,firmwareBucket} from '@/lib/firmware-storage';
import {storage} from '@/lib/storage';
import {supplierCommercial,supplierEntity,supplierHistoryWrite} from '@/lib/suppliers';

const historyType='supplier_purchase_history';
const fileType='supplier_purchase_history_file';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const pageSize=30,maxFiles=3;

async function foreignLink(linkId:string){
 const link=await supplierEntity(linkId,'supplier_material');
 const supplier=await supplierEntity(link.data.supplierId,'supplier');
 if(supplier.data.route!=='foreign')fail('ارتباط کالای خارجی یافت نشد.',404);
 return {link,supplier};
}

export async function GET(request:Request){
 try{
  const user=await requireAccess();
  if(!supplierCommercial(user,'foreign'))fail('مجوز مشاهدهٔ سوابق خرید خارجی را ندارید.',403);
  const query=new URL(request.url).searchParams,fileId=query.get('file');
  if(fileId){
   const file=await supplierEntity(fileId,fileType);
   const entry=await supplierEntity(file.data.historyId,historyType);
   await foreignLink(entry.data.linkId);
   const data=file.data,object=await firmwareBucket().get(data.objectKey);
   if(!object)throw new AccessError('فایل موقتاً در دسترس نیست.',503);
   const bytes=await object.arrayBuffer();
   if(bytes.byteLength!==data.size||await sha256(bytes)!==data.sha256)fail('یکپارچگی فایل تأیید نشد.',503);
   const filename=encodeURIComponent(data.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
   return new Response(bytes,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=purchase-history; filename*=UTF-8''"+filename,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
  }
  const {link}=await foreignLink(taskRequired(query.get('link'),200));
  const page=Number(query.get('page')||0);
  if(!Number.isSafeInteger(page)||page<0||page>100000)fail('صفحهٔ درخواستی معتبر نیست.');
  const db=storage();
  const entries=await db.prepare("SELECT id,data FROM flow_entities WHERE type=? AND json_extract(data,'$.linkId')=? ORDER BY COALESCE(NULLIF(json_extract(data,'$.day'),''),substr(created,1,10)) DESC,created DESC,id LIMIT ? OFFSET ?").bind(historyType,link.id,pageSize+1,page*pageSize).all<{id:string;data:string}>();
  const rows=entries.results.slice(0,pageSize);
  const files=await db.prepare("SELECT id,json_extract(data,'$.historyId') historyId,json_extract(data,'$.filename') filename FROM flow_entities WHERE type=? AND json_extract(data,'$.historyId') IN (SELECT value FROM json_each(?)) ORDER BY id").bind(fileType,JSON.stringify(rows.map(row=>row.id))).all<{id:string;historyId:string;filename:string}>();
  return json({entries:rows.map(row=>{
   const {requestHash,referenceKey,...fields}=JSON.parse(row.data);
   return {id:row.id,...fields,files:files.results.filter(file=>file.historyId===row.id).map(({id,filename})=>({id,filename}))};
  }),nextPage:entries.results.length>pageSize?page+1:null});
 }catch(error){return accessResponse(error)||json({error:'دریافت سوابق خرید انجام نشد.'},503);}
}

function historyDate(value:unknown){
 const day=taskText(value||'',10);
 if(day&&(!validDay(day)||day>dayAt()))fail('تاریخ خرید یا تحویل معتبر نیست.');
 return day;
}
function decimal(value:unknown,label:string,allowZero=false){
 const number=asciiDigits(taskText(value||'',24));
 if(number&&(!/^\d{1,14}(\.\d{1,6})?$/.test(number)||!allowZero&&Number(number)<=0))fail(label+' معتبر نیست.');
 return number;
}

export async function POST(request:Request){
 const objects:{id:string;key:string}[]=[];
 let entryId='',requestHash='';
 try{
  checkOrigin(request);
  const user=await requireAccess();
  if(!supplierHistoryWrite(user))fail('مجوز ثبت سوابق خرید خارجی را ندارید.',403);
  const type=request.headers.get('Content-Type')||'';
  if(!type.startsWith('multipart/form-data;'))fail('فرم ثبت سابقه معتبر نیست.');
  const raw=await boundedBody(request,maxFiles*MAX_BATCH_FILE_BYTES+128000);
  const form=await new Response(raw,{headers:{'Content-Type':type}}).formData(),metadata=form.get('metadata');
  if(typeof metadata!=='string'||metadata.length>12000)throw new AccessError('مشخصات سابقه معتبر نیست.',400);
  const input=JSON.parse(metadata) as Record<string,unknown>,id=taskRequired(input.id,36);
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))fail('شناسهٔ ثبت معتبر نیست.');
  const {link,supplier}=await foreignLink(taskRequired(input.linkId,200));
  if(supplier.data.deletedAt)fail('برای این تأمین‌کنندهٔ حذف‌شده امکان ثبت سابقه وجود ندارد.',409);
  const reference=taskRequired(input.reference,200);
  const referenceKey=asciiDigits(reference.normalize('NFKC')).replace(/\s+/g,' ').toLowerCase();
  const quantity=decimal(input.quantity,'مقدار'),unit=taskText(input.unit||'',35),price=decimal(input.price,'قیمت',true);
  const currency=taskText(input.currency||'',3).toUpperCase();
  if(quantity&&!unit)fail('واحد مقدار را مشخص کنید.');
  if((price||currency)&&(!price||!(/^[A-Z]{3}$/.test(currency))))fail('قیمت و کد سه‌حرفی ارز را با هم وارد کنید.');
  const day=historyDate(input.day),deliveredOn=historyDate(input.deliveredOn);
  if(day&&deliveredOn&&deliveredOn<day)fail('تاریخ تحویل قبل از تاریخ خرید است.');
  const fields={linkId:link.id,reference,referenceKey,day,quantity,unit,price,currency,deliveredOn,
   quality:taskText(input.quality||'',1000),notes:taskText(input.notes||'',2000)};
  const files=form.getAll('file');
  if(files.length>maxFiles)fail('حداکثر سه مدرک به هر سابقه پیوست کنید.');
  const attachments=[];
  for(const file of files){
   if(typeof file==='string')throw new AccessError('فایل پیوست معتبر نیست.',400);
   try{validateBatchFile(file.name,file.size);}catch(error){fail((error as Error).message);}
   const bytes=await file.arrayBuffer();
   attachments.push({bytes,filename:file.name,size:file.size,sha256:await sha256(bytes)});
  }
  const db=storage(),now=new Date().toISOString();
  entryId='supplier-history:'+id;
  requestHash=await sha256(new TextEncoder().encode(JSON.stringify({fields,files:attachments.map(({filename,size,sha256})=>({filename,size,sha256}))})));
  const prior=await db.prepare('SELECT data FROM flow_entities WHERE id=? AND type=?').bind(entryId,historyType).first<{data:string}>();
  if(prior){
   const saved=JSON.parse(prior.data);
   if(saved.actor!==user.userId||saved.requestHash!==requestHash)fail('شناسهٔ ثبت قبلاً برای اطلاعات دیگری استفاده شده است.',409);
   return json({saved:true,id:entryId,repeated:true});
  }
  const duplicate="NOT EXISTS(SELECT 1 FROM flow_entities WHERE type=? AND json_extract(data,'$.linkId')=? AND json_extract(data,'$.referenceKey')=?)";
  const conditions=[historyType,link.id,referenceKey];
  if(!await db.prepare('SELECT 1 WHERE '+duplicate).bind(...conditions).first())fail('این مرجع برای همین کالا و تأمین‌کننده ثبت شده است.',409);
  const statements=[];
  for(const file of attachments){
   const fileId=crypto.randomUUID(),objectKey='supplier-purchase-history/'+entryId+'/'+fileId;
   objects.push({id:fileId,key:objectKey});
   await firmwareBucket().put(objectKey,file.bytes,{httpMetadata:{contentType:'application/octet-stream'},sha256:file.sha256});
   const {filename,size,sha256}=file;
   statements.push(db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)')
    .bind(fileId,fileType,JSON.stringify({historyId:entryId,filename,size,sha256,objectKey}),now,now));
  }
  await db.batch([
   db.prepare(`INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'supplier_purchase_history','{}',?,?,
    CASE WHEN ${duplicate} AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)
    AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN 1 ELSE 0 END)`)
    .bind(id,user.userId,now,...conditions,link.id,link.revision,supplier.id,supplier.revision),
   db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)')
    .bind(entryId,historyType,JSON.stringify({...fields,actor:user.userId,recordedAt:now,requestHash}),now,now),
   ...statements,
   db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),user.userId,entryId,historyType,JSON.stringify({linkId:link.id}),now),
  ]);
  return json({saved:true,id:entryId},201);
 }catch(error){
  if(objects.length){
   try{
    const db=storage();
    await Promise.all(objects.map(async({id,key})=>{
     const saved=await db.prepare('SELECT id FROM flow_entities WHERE id=? AND type=?').bind(id,fileType).first();
     if(!saved)await firmwareBucket().delete(key);
    }));
   }catch{console.error('Supplier purchase history attachment cleanup deferred');}
  }
  return accessResponse(error)||json({error:'سابقه ثبت نشد. اگر هم‌زمان ثبت دیگری انجام شده، فهرست را تازه کنید.'},409);
 }
}
