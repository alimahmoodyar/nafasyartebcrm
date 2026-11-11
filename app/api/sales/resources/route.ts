import {accessResponse,checkOrigin,requireAccess,session} from '@/lib/authorization';
import {MAX_BATCH_FILE_BYTES,validateBatchFile} from '@/lib/batch-files';
import {boundedBody,firmwareBucket} from '@/lib/firmware-storage';
import {sha256} from '@/lib/firmware';
import {liveSalesUser,salesFail,salesRep,salesScope,salesStaff} from '@/lib/sales';
import {isUnscopedRepresentative} from '@/lib/permissions';
import {storage} from '@/lib/storage';

const categories=['catalog','promotion','training'];
const audiences=['all','representative','reseller'];
const previewFiles=[
 {id:'preview-catalog',title:'کاتالوگ دستگاه‌ها (آزمایشی)',category:'catalog',filename:'sample-catalog.txt',content:'نمونهٔ آزمایشی کاتالوگ\nدر کاتالوگ واقعی، مدل دستگاه، مشخصات فنی و اقلام همراه درج می‌شوند.\n'},
 {id:'preview-promotion',title:'اقلام تبلیغاتی فروش (آزمایشی)',category:'promotion',filename:'sample-promotion.txt',content:'نمونهٔ آزمایشی اقلام تبلیغاتی\nفایل‌های معرفی محصول و پوسترهای کمپین از این بخش قابل دریافت‌اند.\n'},
 {id:'preview-training',title:'راهنمای کارشناس فروش (آزمایشی)',category:'training',filename:'sample-training.txt',content:'نمونهٔ آزمایشی راهنمای فروش\nابتدا نیاز مشتری را ثبت کنید و سپس مشخصات مدل مناسب را با کاتالوگ تطبیق دهید.\n'},
];
type Resource={title:string;category:string;audience:string;filename:string;size:number;sha256:string;objectKey:string;actor:string};
type Row={id:string;data:string;revision:number;updated:string};
const headers={'Cache-Control':'private, no-store'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
const find=(id:string)=>storage().prepare("SELECT id,data,revision,updated FROM flow_entities WHERE id=? AND type='sales_resource'").bind(id).first<Row>();

export async function GET(request:Request){
 try{
  const user=await liveSalesUser(await session());
  const manage=salesStaff(user);
  const preview=isUnscopedRepresentative(user);
  let kind=preview?'representative':'';
  if(!manage&&salesRep(user))kind=(await salesScope(user,user.permissions.salesAgentId!,'read')).data.kind;
  if(!manage&&!['representative','reseller'].includes(kind))salesFail('دسترسی به فایل‌های فروش ندارید.',403);
  const id=new URL(request.url).searchParams.get('id');
  if(id){
   const sample=preview?previewFiles.find(file=>file.id===id):undefined;
   if(sample)return new Response(sample.content,{headers:{...headers,'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename='+sample.filename,'X-Content-Type-Options':'nosniff'}});
   const row=await find(id);
   if(!row)salesFail('فایل پیدا نشد.',404);
   const file=JSON.parse(row!.data) as Resource;
   if(!manage&&file.audience!=='all'&&file.audience!==kind)salesFail('فایل پیدا نشد.',404);
   const object=await firmwareBucket().get(file.objectKey);
   if(!object)salesFail('فایل موقتاً در دسترس نیست.',503);
   const bytes=await object!.arrayBuffer();
   if(bytes.byteLength!==file.size||await sha256(bytes)!==file.sha256)salesFail('یکپارچگی فایل تأیید نشد.',503);
   const filename=encodeURIComponent(file.filename).replace(/['()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
   return new Response(bytes,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=sales-file; filename*=UTF-8''"+filename,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
  }
  const {results}=await storage().prepare("SELECT id,data,revision,updated FROM flow_entities WHERE type='sales_resource' AND (?=1 OR json_extract(data,'$.audience') IN ('all',?)) ORDER BY updated DESC,id").bind(manage?1:0,kind).all<Row>();
  const files=results.map(row=>{
   const {title,category,audience,filename,size}=JSON.parse(row.data) as Resource;
   return {id:row.id,revision:row.revision,updated:row.updated,title,category,audience,filename,size};
  });
  const samples=preview?previewFiles.map(({id,title,category,filename})=>({id,title,category,filename,audience:'representative',revision:1})):[];
  return json({manage,files:[...samples,...files]});
 }catch(error){return accessResponse(error)||json({error:'دریافت فایل‌های فروش انجام نشد.'},503);}
}


export async function POST(request:Request){
 let uploadedKey='',resourceId='';
 try{
  checkOrigin(request);
  const user=await liveSalesUser(await requireAccess());
  if(!salesStaff(user))salesFail('بارگذاری فایل فقط برای فروش مجاز است.',403);
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.startsWith('multipart/form-data;'))salesFail('فایل را انتخاب کنید.',400);
  const bytes=await boundedBody(request,MAX_BATCH_FILE_BYTES+12000);
  const form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();
  const upload=form.get('file'),name=form.get('title'),category=form.get('category'),audience=form.get('audience');
  const title=typeof name==='string'?name.trim():'';
  if(!title||title.length>160||typeof category!=='string'||!categories.includes(category)||typeof audience!=='string'||!audiences.includes(audience))salesFail('نام، دسته و مخاطب معتبر را وارد کنید.',400);
  if(!upload||typeof upload==='string'||form.getAll('file').length!==1)return json({error:'یک فایل را انتخاب کنید.'},400);
  try{validateBatchFile(upload.name,upload.size);}catch(error){return json({error:(error as Error).message},400);}
  const previousId=form.get('id');
  if(previousId&&typeof previousId!=='string')salesFail('شناسهٔ فایل معتبر نیست.',400);
  const previous=typeof previousId==='string'&&previousId?await find(previousId):null;
  if(previousId&&!previous)salesFail('فایل پیدا نشد.',404);
  if(previous&&String(previous.revision)!==form.get('revision'))salesFail('فایل تغییر کرده است. فهرست را تازه کنید.',409);
  const db=storage(),bucket=firmwareBucket(),now=new Date().toISOString();
  resourceId=previous?.id||crypto.randomUUID();
  const raw=await upload.arrayBuffer(),hash=await sha256(raw);
  uploadedKey='sales-resources/'+resourceId+'/'+crypto.randomUUID();
  const data:Resource={title,category:String(category),audience:String(audience),filename:upload.name,size:upload.size,sha256:hash,objectKey:uploadedKey,actor:user.userId};
  await bucket.put(uploadedKey,raw,{sha256:hash});
  if(previous){
   const result=await db.prepare("UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND type='sales_resource' AND revision=?").bind(JSON.stringify(data),now,resourceId,previous.revision).run();
   if(!result.meta.changes)salesFail('فایل تغییر کرده است. فهرست را تازه کنید.',409);
   await bucket.delete((JSON.parse(previous.data) as Resource).objectKey).catch(()=>{});
  }else{
   await db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_resource',?,1,?,?)").bind(resourceId,JSON.stringify(data),now,now).run();
  }
  return json({saved:true,id:resourceId},previous?200:201);
 }catch(error){
  if(uploadedKey)try{
   const saved=await find(resourceId);
   if(saved&&(JSON.parse(saved.data) as Resource).objectKey===uploadedKey)return json({saved:true,id:resourceId});
   await firmwareBucket().delete(uploadedKey);
  }catch{console.error('Sales resource reconciliation deferred');}
  return accessResponse(error)||json({error:'ذخیرهٔ فایل انجام نشد.'},503);
 }
}
