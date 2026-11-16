import {accessWorkflowAsset,assetRow,ownsAsset,technicalAsset} from './asset-workflow';
import {requireAccess,checkOrigin,accessResponse} from './authorization';
import {boundedBody,firmwareBucket} from './firmware-storage';
import {validateBatchFile,MAX_BATCH_FILE_BYTES} from './batch-files';
import {sha256} from './firmware';
import {assetMembers,assetRows,commitAssets,assetFail} from './assets';
import {taskRequired} from './duties';
import {storage} from './storage';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
function imageType(b:Uint8Array){if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';if(new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP')return 'image/webp';return '';}
export async function GET(request:Request){try{
 const u=await requireAccess(),q=new URL(request.url).searchParams;
 if(q.has('assetId')){
  const {a,r}=await accessWorkflowAsset(u,q.get('assetId')||'');if(!a.custodian)assetFail('مدارک خرید فقط در دسترسی اموال‌دار است.',403);
  const raw=q.get('offset')||'0',offset=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(offset))assetFail('صفحه معتبر نیست.');
  const rows=(await storage().prepare("SELECT id,data,created FROM flow_entities WHERE type='asset_file' AND json_extract(data,'$.assetId')=? AND json_extract(data,'$.purpose')='purchase' ORDER BY created,id LIMIT 51 OFFSET ?").bind(r.id,offset).all()).results as any[];
  return Response.json({files:rows.slice(0,50).map(x=>{const d=JSON.parse(x.data);return {id:x.id,filename:d.filename,byteSize:d.byteSize,mime:d.mime||'',created:x.created};}),hasMore:rows.length>50},{headers});
 }
 const f=await assetRow(q.get('id')||'');if(!f||f.type!=='asset_file')assetFail('مدرک یافت نشد.',404);
 const {r:parent,a}=await accessWorkflowAsset(u,f.data.assetId);
 if(f.data.purpose==='purchase'){if(!a.custodian)assetFail('مدارک خرید فقط در دسترسی اموال‌دار است.',403);}else if(parent.data.custodyId!==f.data.custodyId)assetFail('مدرک مربوط به تحویل پیشین است.',404);
 const object=await firmwareBucket().get(f.data.objectKey);if(!object)assetFail('فایل در دسترس نیست.',404);const bytes=await object!.arrayBuffer();
 if(bytes.byteLength!==f.data.byteSize||await sha256(bytes)!==f.data.sha256)assetFail('یکپارچگی فایل تأیید نشد.',503);
 const mime=q.get('view')==='preview'?imageType(new Uint8Array(bytes)):'';
 return new Response(bytes,{headers:{...headers,'Content-Type':mime||'application/octet-stream','Content-Disposition':(mime?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(f.data.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16)),'Content-Security-Policy':"sandbox; default-src 'none'"}});
}catch(e){return accessResponse(e)||Response.json({error:'دریافت مدرک ممکن نشد.'},{status:503,headers})}}
export async function POST(request:Request){let key='',fileId='';try{
 checkOrigin(request);const u=await requireAccess();if(request.headers.get('x-asset-account')&&request.headers.get('x-asset-account')!==u.userId)assetFail('حساب ورود تغییر کرده است؛ صفحه را تازه کنید.',409);
 const q=new URL(request.url).searchParams;fileId=taskRequired(q.get('id'));const assetId=taskRequired(q.get('assetId')),filename=taskRequired(q.get('filename'),180),purpose=q.get('purpose')||'custody';
 if(!['custody','purchase'].includes(purpose)||q.get('confirmed')!=='true'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fileId))assetFail('تأیید و شناسه فایل لازم است.');
 const members=await assetMembers(),{r,a}=await accessWorkflowAsset(u,assetId),rows=await assetRows();
 if(purpose==='purchase'?!a.custodian:!(a.custodian||ownsAsset(r.data,a)||technicalAsset(r.data,a)))assetFail('اجازه پیوست این مدرک را ندارید.',403);
 const bytes=await boundedBody(request,MAX_BATCH_FILE_BYTES);try{validateBatchFile(filename,bytes.length)}catch(e){assetFail((e as Error).message)}const hash=await sha256(bytes.buffer as ArrayBuffer),old=rows.find(x=>x.id===fileId);
 if(old){if(old.type!=='asset_file'||old.data.assetId!==r.id||(old.data.purpose||'custody')!==purpose||purpose!=='purchase'&&old.data.custodyId!==r.data.custodyId||old.data.actor!==u.userId||old.data.sha256!==hash||old.data.filename!==filename)assetFail('شناسه فایل تکراری است.',409);return Response.json({id:fileId,repeated:true},{headers});}
 if(String(r.revision)!==q.get('revision'))assetFail('تحویل یا پرونده تغییر کرده؛ تازه‌سازی کنید.',409);
 key='assets/'+assetId+'/'+fileId+'/'+crypto.randomUUID();await firmwareBucket().put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
 await commitAssets(u,crypto.randomUUID(),JSON.stringify({fileId,assetId,filename,hash,purpose}),rows,members,[{id:fileId,type:'asset_file',revision:0,data:{assetId,custodyId:r.data.custodyId,purpose,filename,mime:imageType(bytes),actor:u.userId,objectKey:key,sha256:hash,byteSize:bytes.length}}],'upload');
 return Response.json({id:fileId,filename},{headers});
}catch(e){if(key)try{const linked:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='asset_file'").bind(fileId).first();if(linked&&JSON.parse(linked.data).objectKey===key)return Response.json({id:fileId},{headers});await firmwareBucket().delete(key)}catch{}return accessResponse(e)||Response.json({error:'مدرک ذخیره نشد؛ فهرست مدارک را تازه کنید.'},{status:409,headers})}}
