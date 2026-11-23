import {requireAccess,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {boundedBody} from '@/lib/firmware-storage';
import {profilePhotoCrop,profilePhotoImageLimit,profilePhotoSourceLimit,type ProfilePhotoCrop} from '@/lib/profile-photo';

const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
const rowSql="SELECT data,revision FROM flow_entities WHERE id=? AND type='account_profile'";
type Photo={image?:string;source?:string;crop?:ProfilePhotoCrop};

async function own(request:Request){
 const u=await requireAccess(),expected=request.headers.get('x-profile-account')||new URL(request.url).searchParams.get('account');
 if(expected&&expected!==u.userId)throw new AccessError('حساب تغییر کرده است؛ صفحه را تازه‌سازی کنید.',409);
 return u;
}

function jpeg(value:unknown,max:number){
 if(typeof value!=='string'||value.length>Math.ceil(max/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))
  throw new AccessError('فایل عکس یا اندازهٔ آن معتبر نیست.',400);
 let raw:string;
 try{raw=atob(value)}catch{throw new AccessError('عکس معتبر نیست.',400);}
 if(raw.length>max||raw.length<4||raw.charCodeAt(0)!==255||raw.charCodeAt(1)!==216||raw.charCodeAt(raw.length-2)!==255||raw.charCodeAt(raw.length-1)!==217)
  throw new AccessError('فقط عکس JPEG معتبر پذیرفته می‌شود.',400);
 return value;
}

export async function GET(request:Request){
 try{
  const u=await own(request),params=new URL(request.url).searchParams;
  const row=await storage().prepare(rowSql).bind('profile:'+u.userId).first<{data:string;revision:number}>();
  const data:Photo=row?JSON.parse(row.data):{};
  if(params.has('source')||params.has('image')){
   const image=params.has('source')?data.source:data.image;
   if(!image)throw new AccessError('عکس پروفایل ثبت نشده است.',404);
   return new Response(Uint8Array.from(atob(image),char=>char.charCodeAt(0)),{headers:{...headers,'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  return Response.json({accountId:u.userId,name:u.name,username:u.username,authType:u.authType,revision:row?.revision||0,hasPhoto:!!data.image,hasSource:!!data.source,crop:data.source?profilePhotoCrop(data.crop):null},{headers});
 }catch(error){return accessResponse(error)||Response.json({error:'پروفایل در دسترس نیست.'},{status:503,headers});}
}

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const u=await own(request),db=storage(),id='profile:'+u.userId;
  const maxBody=Math.ceil((profilePhotoImageLimit+profilePhotoSourceLimit)/3)*4+8192;
  const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,maxBody)));
  if(body?.confirmed!==true||!Number.isSafeInteger(body.revision)||body.revision<0||!['upload','remove'].includes(body.mode))
   throw new AccessError('اطلاعات پروفایل معتبر نیست.',400);
  const old=await db.prepare(rowSql).bind(id).first<{data:string;revision:number}>();
  if((old?.revision||0)!==body.revision)throw new AccessError('پروفایل تغییر کرده؛ دوباره باز کنید.',409);
  const previous:Photo=old?JSON.parse(old.data):{};
  const next:Photo={image:''};
  if(body.mode==='upload'){
   next.image=jpeg(body.image,profilePhotoImageLimit);
   if(body.crop!==undefined||body.source!==undefined){
    const crop=profilePhotoCrop(body.crop),source=body.source===undefined?previous.source||previous.image:jpeg(body.source,profilePhotoSourceLimit);
    if(!crop||!source)throw new AccessError('تنظیمات برش یا تصویر اصلی معتبر نیست.',400);
    next.source=source;
    next.crop=crop;
   }
  }
  if((previous.image||'')===next.image&&previous.source===next.source&&JSON.stringify(previous.crop)===JSON.stringify(next.crop))
   return Response.json({saved:true,revision:body.revision},{headers});

  const now=new Date().toISOString(),operationId=crypto.randomUUID();
  await db.batch([
   db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'profile_photo','{}',?,?,CASE WHEN COALESCE((SELECT revision FROM flow_entities WHERE id=?),0)=? THEN 1 ELSE 0 END)").bind(operationId,u.userId,now,id,body.revision),
   db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'account_profile',?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated").bind(id,JSON.stringify(next),now,now),
   db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(operationId,u.userId,u.userId,'profile_'+body.mode,JSON.stringify({hasPhoto:!!next.image}),now),
  ]);
  return Response.json({saved:true,revision:body.revision+1},{headers});
 }catch(error){return accessResponse(error)||Response.json({error:'ذخیره نشد؛ پروفایل را تازه‌سازی و دوباره تلاش کنید.'},{status:409,headers});}
}
