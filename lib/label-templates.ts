import {AccessError,can,requireAccess} from './authorization';
import {storage} from './storage';
import {rollFields,readRoll,type LabelTemplate} from './label-roll';

export async function labelTemplateAccess(){
 const user=await requireAccess(),p=user.permissions;
 if(!user.isAdmin&&(p.salesAgentId||p.serviceAgentId||p.salesRoles?.includes('agent')||p.serviceRoles?.includes('agent')||p.qmsRoles?.includes('observer')||
  !(can(user,'device','read')||can(user,'batch','read')||p.flowRoles?.some(r=>r==='inventory'||r==='qc')||p.warehouseResponsibilities?.length)))
  throw new AccessError('دسترسی به قالب‌های چاپ مجاز نیست.',403);
 return user;
}

export async function listLabelTemplates(){
 const {results}=await storage().prepare("SELECT id,data,revision FROM flow_entities WHERE type='label_template' ORDER BY json_extract(data,'$.name'),id").all<{id:string;data:string;revision:number}>();
 return results.map(({id,data,revision}):LabelTemplate=>({id,revision,...JSON.parse(data)}));
}

export async function saveLabelTemplate(actor:string,body:any){
 const name=typeof body?.name==='string'?body.name.normalize('NFKC').trim().replace(/\s+/g,' '):'';
 if(body?.confirmed!==true||!name||name.length>80||!Number.isInteger(body.revision)||body.revision<0||
  (body.revision>0?!/^label-template:[a-f\d-]{36}$/.test(body.id):!!body.id))
  throw new AccessError('نام، نسخهٔ قالب یا تأیید ثبت معتبر نیست.',400);
 const params=new URLSearchParams();
 for(const [key] of rollFields){
  if(typeof body.roll?.[key]!=='number')throw new AccessError('تمام اندازه‌های رول را وارد کنید.',400);
  params.set(key,String(body.roll[key]));
 }
 const roll=readRoll(params),data=JSON.stringify({name,roll}),db=storage();
 const previous=body.id?await db.prepare("SELECT data,revision FROM flow_entities WHERE id=? AND type='label_template'").bind(body.id).first<{data:string;revision:number}>():null;
 if(body.revision>0&&previous?.revision!==body.revision)throw new AccessError('قالب تغییر کرده است. فهرست را تازه کنید.',409);
 if(previous?.data===data)return {id:body.id,name,roll,revision:previous.revision};
 const id=body.id||'label-template:'+crypto.randomUUID(),now=new Date().toISOString(),op=crypto.randomUUID();
 try{
  await db.batch([
   db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'label_template_save','{}',?,?,CASE WHEN COALESCE((SELECT revision FROM flow_entities WHERE id=? AND type='label_template'),0)=? AND NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='label_template' AND id<>? AND json_extract(data,'$.name')=? COLLATE NOCASE) AND (? > 0 OR (SELECT COUNT(*) FROM flow_entities WHERE type='label_template')<100) THEN 1 ELSE 0 END)").bind(op,actor,now,id,body.revision,id,name,body.revision),
   db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'label_template',?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated").bind(id,data,now,now),
   db.prepare("INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,'label_template_save',?,?,?)").bind(op,actor,id,previous?.data??null,data,now)
  ]);
 }catch(error){
  if(/guard|CHECK constraint/i.test(String(error)))throw new AccessError('نام قالب تکراری است، فهرست تغییر کرده یا ظرفیت قالب‌ها پر شده است.',409);
  throw error;
 }
 return {id,name,roll,revision:body.revision+1};
}
