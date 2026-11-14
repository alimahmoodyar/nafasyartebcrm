import {env} from 'cloudflare:workers';
import {storage} from './storage';
import {firmwareBucket} from './firmware-storage';
import {sha256} from './firmware';
import {AccessError} from './authorization';
import {transportAccess,purchaseTransportRequester,transportManager} from './transport';
import {taskRequired as req} from './duties';
const fail=(s:string,status=400):never=>{throw new AccessError(s,status)};
const hash=(s:string)=>sha256(new TextEncoder().encode(s).buffer as ArrayBuffer);
export async function issueTransportLink(u:any,b:any,origin:string){
 if(b.confirmed!==true)fail('تأیید ارسال پیامک لازم است.');
 const m=await transportAccess(u,req(b.missionId)),d=m.data;
 if(d.kind!=='purchase_order'||!purchaseTransportRequester(u,{data:{route:d.purchaseRoute}})&&!transportManager(u)&&!u.isAdmin)fail('دسترسی هماهنگی این حمل را ندارید.',403);
 if(m.revision!==b.revision||!['requested','assigned'].includes(d.state)||d.driverId)fail('نسخه جاری حمل بیرونی قبل از دریافت لازم است.',409);
 if(d.externalAccess?.issuedAt&&Date.now()-Date.parse(d.externalAccess.issuedAt)<60000)fail('برای ارسال مجدد یک دقیقه صبر کنید.',429);
 const mobile=req(b.mobile,11);if(!/^09\d{9}$/.test(mobile))fail('شماره موبایل معتبر لازم است.');
 const configured=String((env as any).CARGO_PUBLIC_ORIGIN||'');
 let publicOrigin:URL;try{publicOrigin=new URL(configured);if(publicOrigin.protocol!=='https:'||publicOrigin.username||publicOrigin.password||publicOrigin.pathname!=='/'||publicOrigin.search||publicOrigin.hash||publicOrigin.origin===new URL(origin).origin)throw Error('origin');}catch{fail('صفحه عمومی دریافت بار هنوز تنظیم نشده است؛ پیامکی ارسال نشد.',503);}
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join(''),now=new Date().toISOString();
 const link=publicOrigin!.origin+'/transport/handover#'+m.id+':'+token;
 const access={tokenHash:await hash(token),mobile,name:req(b.name,200),expires:new Date(Date.now()+7*86400000).toISOString(),issuedBy:u.userId,issuedAt:now};
 await storage().batch([storage().prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'transport_external_link','{}',?,?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN 1 ELSE 0 END)").bind(crypto.randomUUID(),u.userId,now,m.id,m.revision),storage().prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify({...d,externalAccess:access,externalSend:{state:'prepared',at:now},history:[...d.history,{mode:'external_link',actor:u.userId,actorName:u.name,at:now}]}),now,m.id,m.revision)]);
 const text='نفس‌یار؛ دریافت بار '+d.code+'\nمبدأ: '+d.pickup+'\nتلفن: '+(d.pickupPhone||'در پرونده درج نشده')+'\nمقصد: '+d.destination+'\nتلفن: '+d.phone+'\nمشاهده بار و ثبت دریافت:\n'+link+'\nلغو11';
 if(!(env as any).SMSIR_API_KEY||!(env as any).SMSIR_LINE_NUMBER)fail('پیامک تنظیم نشده است؛ لینک صادر شده ولی پیام ارسال نشده.',503);
 let accepted=false;try{const r=await fetch('https://api.sms.ir/v1/send/bulk',{method:'POST',redirect:'error',headers:{'X-API-KEY':(env as any).SMSIR_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({lineNumber:Number((env as any).SMSIR_LINE_NUMBER),MessageText:text,Mobiles:[mobile],SendDateTime:null}),signal:AbortSignal.timeout(15000)}),j:any=await r.json();accepted=r.ok&&j.status===1&&j.data?.messageIds?.length===1;}catch{}
 // No blind retry: accepted by provider does not prove handset delivery.
 return {link,expires:access.expires,smsAccepted:accepted,message:accepted?'پیامک پذیرفته شد؛ تحویل به گوشی هنوز تأیید نشده.':'ارسال پیامک تأیید نشد؛ لینک قابل کپی است. ارسال دوباره را دستی انجام دهید.'};
}
export async function externalMission(missionId:string,token:string){
 if(!/^[a-f0-9-]{36}$/i.test(missionId)||!/^[a-f0-9]{64}$/.test(token))fail('لینک معتبر نیست.',404);
 const r:any=await storage().prepare("SELECT * FROM flow_entities WHERE id=? AND type='transport'").bind(missionId).first();
 if(!r)fail('لینک معتبر نیست.',404);const d=JSON.parse(r.data),a=d.externalAccess;
 if(d.kind!=='purchase_order'||!['requested','assigned','collected'].includes(d.state)||!a||!Number.isFinite(Date.parse(a.expires))||Date.parse(a.expires)<=Date.now()||a.tokenHash!==await hash(token)||d.driverId)fail('لینک منقضی یا باطل شده است.',403);
 return {...r,data:d};
}
export function externalSummary(m:any){const d=m.data;return {id:m.id,revision:m.revision,code:d.code,pickup:d.pickup,pickupPhone:d.pickupPhone,destination:d.destination,recipient:d.recipient,phone:d.phone,items:d.items,packages:d.packages,vehicle:d.purchaseShipping?.vehicleSize,equipment:d.purchaseShipping?.equipment,due:d.due,state:d.state,received:!!d.externalReceipt};}
export async function saveExternalPhoto(m:any,file:File){
 if(m.data.externalReceipt)fail('دریافت قبلاً ثبت شده است.',409);const count:any=await storage().prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='transport_file' AND json_extract(data,'$.missionId')=?").bind(m.id).first();if(count.n>=6)fail('حداکثر شش عکس بار مجاز است.');if(!file.size||file.size>10*1024*1024)fail('عکس باید حداکثر ۱۰ مگابایت باشد.');
 const bytes=await file.arrayBuffer(),b=new Uint8Array(bytes),head=new TextDecoder().decode(b.slice(0,12));const mime=b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71?'image/png':head.startsWith('RIFF')&&head.slice(8,12)==='WEBP'?'image/webp':'';if(!mime)fail('عکس معتبر JPEG، PNG یا WEBP انتخاب کنید.');
 const id=crypto.randomUUID(),key='transport/'+id+'/'+crypto.randomUUID(),digest=await sha256(bytes),now=new Date().toISOString();await firmwareBucket().put(key,bytes);
 try{await storage().batch([storage().prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'transport_external_photo','{}',?,?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN 1 ELSE 0 END)").bind(crypto.randomUUID(),'external:'+m.id,now,m.id,m.revision),storage().prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'transport_file',?,1,?,?)").bind(id,JSON.stringify({missionId:m.id,purpose:'condition',objectKey:key,filename:'cargo.jpg',mime,size:file.size,sha256:digest,actor:'external:'+m.id}),now,now),storage().prepare('UPDATE flow_entities SET revision=revision+1,updated=? WHERE id=? AND revision=?').bind(now,m.id,m.revision)]);}catch(e){await firmwareBucket().delete(key);throw e;}return {id};
}
export async function confirmExternalReceipt(m:any,b:any){
 if(m.data.externalReceipt)return {saved:true,repeated:true};
 if(m.revision!==b.revision||!['requested','assigned'].includes(m.data.state)||b.confirmed!==true)fail('وضعیت تغییر کرده؛ دوباره باز کنید.',409);
 const n=Number(b.packages);if(!Number.isInteger(n)||n<1||n>10000)fail('تعداد بسته معتبر وارد کنید.');
 const condition=req(b.condition,1000),notes=String(b.notes||'').trim().slice(0,4000);if(!['سالم؛ محتویات پلمب شمارش نشده','سالم و قابل مشاهده','آسیب‌دیده','نیازمند بررسی'].includes(condition))fail('وضعیت ظاهری معتبر انتخاب کنید.');if((n!==m.data.packages||condition==='آسیب‌دیده'||condition==='نیازمند بررسی')&&!notes)fail('مغایرت یا آسیب را توضیح دهید.');
 const photo:any=await storage().prepare("SELECT id FROM flow_entities WHERE type='transport_file' AND json_extract(data,'$.missionId')=? AND json_extract(data,'$.purpose')='condition' AND json_extract(data,'$.actor')=? LIMIT 1").bind(m.id,'external:'+m.id).first();if(!photo)fail('حداقل یک عکس بار ثبت کنید.');
 const now=new Date().toISOString(),receipt={packages:n,condition,notes,handedBy:req(b.handedBy,200),at:now,via:'mobile_link',invitedName:m.data.externalAccess.name,mobile:m.data.externalAccess.mobile};
 const next={...m.data,state:'collected',actualPackages:n,collectedDay:now.slice(0,10),externalReceipt:receipt,history:[...m.data.history,{mode:'collect',actor:'external:'+m.id,actorName:'لینک راننده بیرونی',at:now,notes,packages:n,condition}]};
 await storage().batch([storage().prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'transport_external_receipt','{}',?,?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='transport_file') THEN 1 ELSE 0 END)").bind(crypto.randomUUID(),'external:'+m.id,now,m.id,m.revision,photo.id),storage().prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(next),now,m.id,m.revision)]);
 return {saved:true};
}
