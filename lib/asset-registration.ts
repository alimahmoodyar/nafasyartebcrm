import {assetActor,assetMembers,assetRows,assetFail,commitAssets} from './assets';
import {assetCategory,nextAssetCode} from './asset-categories';
import {assetConditions} from './assets-contract';
import {storage} from './storage';
import {dayAt,validDay,taskRequired,taskText} from './duties';
import type {Session} from './permissions';
export const assetRegistrationId=(id:string)=>'asset-registration:'+id;
export function assetImageMime(b:Uint8Array){if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';if(b.length>=12&&new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP')return 'image/webp';return '';}
const uuid=(id:any)=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export async function registerAssetGroup(user:Session,b:any){
 const members=await assetMembers(),actor=await assetActor(user,members);if(!actor.custodian)assetFail('ثبت مال فقط با اموال‌دار است.',403);
 if(!b||!['register','register_group'].includes(b.mode)||b.confirmed!==true||!uuid(b.id)||b.revision!==0||b.recordId)assetFail('شناسه و تأیید ثبت اولیه معتبر لازم است.');
 const rows=await assetRows(),signature=JSON.stringify(b),db=storage(),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first(),groupId=assetRegistrationId(b.id);
 if(prior){if(prior.actor!==user.userId||prior.payload!==signature)assetFail('شناسه ثبت قبلاً با اطلاعات متفاوت استفاده شده است.',409);const group=rows.find(r=>r.id===groupId&&r.type==='asset_registration');if(!group)assetFail('ثبت قبلی باید بررسی شود.',409);return {saved:true,id:group.data.items[0].assetId,groupId,items:group.data.items,repeated:true};}
 const input=b.mode==='register'?[{condition:b.condition,serial:b.serial,copies:b.copies||1,photoFileIds:b.photoFileIds||(b.photoFileId?[b.photoFileId]:[])}]:b.items;
 if(!Array.isArray(input)||input.length<1||input.length>20)assetFail('تعداد اموال هر نوبت باید بین ۱ و ۲۰ باشد.');
 const name=taskRequired(b.name,200),category=taskRequired(b.category,100),location=taskRequired(b.location,300),day=taskRequired(b.day,10),notes=taskText(b.notes||'',4000);
 if(!validDay(day)||day>dayAt())assetFail('تاریخ ثبت واقعی معتبر لازم است.');
 const builtin=assetCategory(category),group=rows.find(r=>r.type==='asset_group'&&r.data.name===category),kind=builtin?.kind||(['mold','machine'].includes(b.assetKind)?b.assetKind:'office');
 const changes:any[]=[],items:any[]=[],used=new Set<string>();let photoCount=0;
 for(let index=0;index<input.length;index++){
  const unit=input[index];if(!unit||!Object.hasOwn(assetConditions,unit.condition))assetFail('وضعیت ظاهری هر مال را جداگانه انتخاب کنید.');
  if(!Array.isArray(unit.photoFileIds)||unit.photoFileIds.length<1||unit.photoFileIds.length>5)assetFail('برای هر مال حداقل یک عکس و حداکثر پنج عکس لازم است.');
  const copies=Number(unit.copies??1);if(!Number.isInteger(copies)||copies<1||copies>20)assetFail('تعداد لیبل هر مال بین ۱ و ۲۰ باشد.');
  const assetId=index===0?b.id:crypto.randomUUID();if(rows.some(r=>r.id===assetId))assetFail('شناسه این مال قبلاً ثبت شده است.',409);
  const photoFiles=unit.photoFileIds.map((fileId:any)=>{if(typeof fileId!=='string'||used.has(fileId))assetFail('عکس هر ردیف باید برای همان مال باشد.');used.add(fileId);const f=rows.find(r=>r.id===fileId&&r.type==='asset_file');if(!f||f.data.purpose!=='asset_photo'||!f.data.staged||f.data.registrationKey!==b.id||f.data.registrationNumber!==index+1||f.data.actor!==user.userId||!f.data.mime?.startsWith('image/'))assetFail('عکس اجباری همین ردیف را ابتدا بارگذاری کنید.');return f;});
  photoCount+=photoFiles.length;if(photoCount>40)assetFail('در هر نوبت حداکثر ۴۰ عکس ثبت کنید.');
  const code=nextAssetCode([...rows,...changes]),now=new Date().toISOString(),number=index+1,data={code,name,category,brand:taskText(b.brand||'',100),model:taskText(b.model||'',100),serial:taskText(unit.serial||'',200),specifications:taskText(b.specifications||'',6000),condition:unit.condition,assetKind:kind,controlled:!!group?.data.controlled||['mold','machine'].includes(kind),lifecycle:'active',meters:{hours:0,cycles:0},useState:'available',holderKind:'stock',holderId:'',holderName:'شرکت',location,custodyId:assetId,handedDay:day,reference:'ثبت شناسنامه',annualDue:'',lastConfirmedDay:'',registrationGroupId:groupId,registrationNumber:number,registrationCount:input.length,registrationPhotoId:photoFiles[0].id,labelCopies:copies,history:[{at:now,actor:user.userId,name:user.name,mode:'register',notes,holderKind:'stock',holderId:'',holderName:'شرکت',location,condition:unit.condition,custodyId:assetId}]};
  changes.push({id:assetId,type:'asset_item',revision:0,data},{id:'asset-register-event:'+assetId,type:'asset_event',revision:0,data:{assetId,custodyId:assetId,mode:'register',at:now,actor:user.userId,name:user.name,notes,details:{registrationGroupId:groupId,registrationNumber:number}}});
  for(const file of photoFiles)changes.push({...file,data:{...file.data,assetId,custodyId:assetId,staged:false}});
  items.push({assetId,code,number,copies,photoFileIds:photoFiles.map((f:any)=>f.id)});
 }
 changes.push({id:groupId,type:'asset_registration',revision:0,data:{name,items,createdBy:user.userId,createdAt:new Date().toISOString()}});
 await commitAssets(user,b.id,signature,rows,members,changes,'register_group');return {saved:true,id:items[0].assetId,groupId,items};
}
export async function assetRegistration(user:Session,id:string){const actor=await assetActor(user);if(!actor.custodian)assetFail('دسترسی اموال‌دار لازم است.',403);const rows=await assetRows(),group=rows.find(r=>r.id===id&&r.type==='asset_registration');if(!group)assetFail('گروه ثبت اموال یافت نشد.',404);const archived=new Set(rows.filter(r=>r.type==='asset_archived').map(r=>r.id));const items=group.data.items.filter((item:any)=>!archived.has(item.assetId)).map((item:any)=>{const asset=rows.find(r=>r.id===item.assetId&&r.type==='asset_item');if(!asset)assetFail('یکی از شناسنامه‌های گروه در دسترس نیست.',409);return {...item,id:asset.id,name:asset.data.name,code:asset.data.code,condition:asset.data.condition,photoId:item.photoFileIds[0]};});if(!items.length)assetFail('تمام شناسنامه‌های این گروه به‌عنوان ثبت اشتباه بایگانی شده‌اند.',409);return {actor,group,items};}
