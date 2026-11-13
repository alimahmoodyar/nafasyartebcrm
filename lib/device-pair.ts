import {AccessError,realSession,requireAccess} from './authorization';
import {digest,newToken} from './password-auth';
import {storage} from './storage';

export const PAIR_INVITE_MS=120_000,PAIR_LIFE_MS=8*3600_000,PAIR_PRESENT_MS=20_000;
export type PairWork={kind:'scan'|'navigate';code?:string;section?:string;target?:string};
export type PairField={value:string|boolean|string[];version:number;by:string};
export type PairDocument={protocol?:number;actions?:import('./paired-open-actions').PairedOpenAction[];owner:string;scope:string;a:string;b:string;inviteHash:string;inviteUntil:number;expires:number;closed:boolean;aSeen:number;bSeen:number;work:PairWork|null;epoch:number;fields:Record<string,PairField>;commit:{id:string;by:string;state:'sending'|'done'|'uncertain';status?:number}|null};
function fail(message:string,status=400):never{throw new AccessError(message,status)}
const token=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)?v:fail('شناسهٔ اتصال معتبر نیست.');
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)?v:fail('شناسهٔ کار معتبر نیست.');
const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
async function actor(){const effective=await requireAccess(),real=await realSession();return {owner:real.userId,scope:await digest(JSON.stringify(stable({id:effective.userId,admin:effective.isAdmin,permissions:effective.permissions,profile:effective.profileReview||null,preview:effective.rolePreview||null})))};}
function cleanWork(v:any):PairWork{
 if(v?.kind==='scan'&&typeof v.code==='string'&&v.code.trim()&&v.code.length<=3000)return {kind:'scan',code:v.code};
 if(v?.kind==='navigate'&&typeof v.section==='string'&&/^[a-z][a-z0-9-]{0,80}$/.test(v.section)&&typeof (v.target??'')==='string'&&(v.target||'').length<=500)return {kind:'navigate',section:v.section,target:v.target||''};
 return fail('کار مشترک معتبر نیست.');
}
function cleanValue(v:any):PairField['value']{if(typeof v==='boolean'||typeof v==='string'&&v.length<=16000||Array.isArray(v)&&v.length<=200&&v.every(s=>typeof s==='string'&&s.length<=2000))return v;return fail('مقدار فیلد بیش از حد مجاز است.');}
export function pairView(id:string,revision:number,d:PairDocument,side:'a'|'b',now=Date.now()){
 const connected=!!d.b&&now-d.aSeen<PAIR_PRESENT_MS&&now-d.bSeen<PAIR_PRESENT_MS;
 return {id,revision,side,paired:!!d.b,connected,expires:d.expires,inviteUntil:d.inviteUntil,work:d.work,epoch:d.epoch,actions:connected?(d.actions||[]):[],fields:connected?d.fields:{},commit:d.commit};
}
/** Connection state only. Never executes a business operation or grants record access. */
export async function devicePair(mode:string,b:any={}){
 const who=await actor(),db=storage(),now=Date.now(),key=await digest(token(b.deviceKey));
 if(mode==='create'){
  if(b.protocol!==2)fail('هر دو دستگاه را تازه‌سازی کنید و دوباره وصل شوید.',409);
  // Bound the number of active sessions per real person. Expired connection data is
  // scrubbed in small batches; domain data and audit history are never removed.
  await db.prepare("DELETE FROM flow_entities WHERE id IN (SELECT id FROM flow_entities WHERE type='device_pair' AND CAST(json_extract(data,'$.expires') AS INTEGER)<? LIMIT 20)").bind(now).run();
  const active:any=await db.prepare("SELECT count(*) n FROM flow_entities WHERE type='device_pair' AND json_extract(data,'$.owner')=? AND json_extract(data,'$.closed')=0 AND json_extract(data,'$.expires')>?").bind(who.owner,now).first();
  if(active.n>=6)fail('اتصال‌های قبلی را قطع کنید و دوباره تلاش کنید.',429);
  const id=crypto.randomUUID(),invite=newToken(),d:PairDocument={protocol:2,...who,a:key,b:'',inviteHash:await digest(invite),inviteUntil:now+PAIR_INVITE_MS,expires:now+PAIR_LIFE_MS,closed:false,aSeen:now,bSeen:0,work:null,epoch:0,actions:[],fields:{},commit:null};
  await db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'device_pair',?,1,?,?)").bind(id,JSON.stringify(d),new Date(now).toISOString(),new Date(now).toISOString()).run();
  return {...pairView(id,1,d,'a',now),invite};
 }
 const id=uuid(b.id),row:any=await db.prepare("SELECT data,revision FROM flow_entities WHERE id=? AND type='device_pair'").bind(id).first();
 if(!row)fail('اتصال پیدا نشد یا پایان یافته است.',404);
 const d:PairDocument=JSON.parse(row.data);if(d.owner!==who.owner)fail('این اتصال متعلق به حساب شما نیست.',403);
 const side=key===d.a?'a':key===d.b?'b':null;
 if(mode==='close'&&side){
  await db.prepare("UPDATE flow_entities SET data=json_set(data,'$.closed',json('true'),'$.fields',json('{}'),'$.actions',json('[]'),'$.work',NULL,'$.inviteHash',''),revision=revision+1 WHERE id=? AND type='device_pair'").bind(id).run();return {closed:true};
 }
 if(b.protocol!==2||d.protocol!==2)fail('نسخهٔ اتصال تغییر کرده است؛ هر دو دستگاه را تازه‌سازی و دوباره وصل کنید.',410);
 if(!side&&mode!=='join')fail('این دستگاه عضو اتصال نیست.',403);
 if(d.closed||d.expires<=now)fail('اتصال پایان یافته است؛ دوباره وصل شوید.',410);
 if(d.scope!==who.scope){
  // A permission/profile change closes the old pair, including its drafts.
  if(side)await db.prepare("UPDATE flow_entities SET data=json_set(data,'$.closed',json('true'),'$.fields',json('{}'),'$.actions',json('[]'),'$.work',NULL),revision=revision+1 WHERE id=? AND type='device_pair'").bind(id).run();
  fail('نقش یا دسترسی تغییر کرده است؛ دو دستگاه را با نقش یکسان دوباره وصل کنید.',403);
 }
 if(mode==='join'){
  if(side||d.b||now>d.inviteUntil||await digest(token(b.invite))!==d.inviteHash)fail('کد اتصال مصرف شده یا منقضی است؛ کد تازه بگیرید.',409);
  const result=await db.prepare("UPDATE flow_entities SET data=json_set(data,'$.b',?,'$.bSeen',?,'$.inviteHash',''),revision=revision+1 WHERE id=? AND type='device_pair' AND revision=? AND json_extract(data,'$.closed')=0").bind(key,now,id,row.revision).run();
  if(!result.meta.changes)fail('این کد هم‌زمان استفاده شد؛ کد تازه بگیرید.',409);
  return pairView(id,row.revision+1,{...d,b:key,bSeen:now,inviteHash:''},'b',now);
 }
 if(!side)fail('این دستگاه عضو اتصال نیست.',403);
 const path=side==='a'?'$.aSeen':'$.bSeen';
 if(mode==='poll'){
  await db.prepare("UPDATE flow_entities SET data=json_set(data,?,?) WHERE id=? AND type='device_pair'").bind(path,now,id).run();
  const current:any=await db.prepare("SELECT data,revision FROM flow_entities WHERE id=? AND type='device_pair'").bind(id).first();const fresh:PairDocument=JSON.parse(current.data);
  if(fresh.closed)fail('اتصال قطع شده است.',410);
  return pairView(id,current.revision,fresh,side,now);
 }
 const ready=!!d.b&&now-d.aSeen<PAIR_PRESENT_MS&&now-d.bSeen<PAIR_PRESENT_MS;
 if(!ready)fail('ارتباط دو دستگاه برقرار نیست؛ تغییرات ارسال‌نشده را نگه دارید.',409);
 if(!Number.isInteger(b.revision)||b.revision!==row.revision)fail('نسخهٔ کار تغییر کرده است؛ آخرین وضعیت را دریافت کنید.',409);
 if(mode!=='work'&&b.epoch!==d.epoch)fail('این فرم دیگر کار مشترک فعال نیست.',409);
 let changes:any={};
 if(mode==='work'){
  if(d.commit?.state==='sending'||d.commit?.state==='uncertain')fail('نتیجهٔ ثبت قبلی روشن نیست؛ ابتدا سابقهٔ همان عملیات را بررسی کنید.',409);
  changes={work:cleanWork(b.work),epoch:d.epoch+1,actions:[],fields:{},commit:null};
 }else if(mode==='ui'){
  if(!d.work||d.commit?.state==='sending'||d.commit?.state==='uncertain')fail('تا مشخص‌شدن نتیجهٔ ثبت، فرم دیگری باز نکنید.',409);
  const actionId=uuid(b.actionId);const actions=d.actions||[];
  if(actions.some(a=>a.id===actionId))return pairView(id,row.revision,d,side,now);
  if(actions.length>=120)fail('برای ادامه، صفحهٔ مشترک را دوباره باز کنید.',409);
  if(typeof b.key!=='string'||!/^[a-z0-9-]+:[a-f0-9]{12}$/.test(b.key)||typeof b.item!=='string'||b.item.length>2000||typeof b.label!=='string'||b.label.length>200)fail('فرم مشترک معتبر نیست.');
  const nextActions=[...actions,{id:actionId,key:b.key,item:b.item,label:b.label,by:side,beforeFields:d.fields}];if(JSON.stringify(nextActions).length>500000)fail('حجم کار مشترک زیاد شده است؛ صفحه را دوباره باز کنید.',409);
  changes={actions:nextActions,fields:{},commit:null};
 }else if(mode==='fields'){
  if(d.commit)fail('این مرحله ثبت شده یا در حال ثبت است؛ فرم را تازه کنید.',409);
  if(!d.work)fail('ابتدا یک کار مشترک باز کنید.');
  if(!Array.isArray(b.changes)||!b.changes.length||b.changes.length>40)fail('تعداد تغییرات معتبر نیست.');
  const fields={...d.fields};
  for(const c of b.changes){
   if(typeof c.key!=='string'||!/^[a-f0-9]{64}$/.test(c.key)||!Number.isInteger(c.version)||c.version<0)fail('شناسهٔ فیلد معتبر نیست.');
   if((fields[c.key]?.version||0)!==c.version)fail('این فیلد هم‌زمان در دستگاه دیگر تغییر کرده است؛ یکی از مقدارها را انتخاب کنید.',409);
   fields[c.key]={value:cleanValue(c.value),version:c.version+1,by:side};
  }
  if(Object.keys(fields).length>300||JSON.stringify(fields).length>150000)fail('پیش‌نویس از اندازهٔ مجاز بیشتر است.');
  changes={fields};
 }else if(mode==='begin'){
  if(d.commit||!d.work)fail('این مرحله قبلاً برای ثبت ارسال شده است؛ سابقه را بررسی کنید.',409);
  changes={commit:{id:uuid(b.operationId),by:side,state:'sending'}};
 }else if(mode==='finish'){
  if(!d.commit||d.commit.by!==side||d.commit.id!==b.operationId||d.commit.state!=='sending')fail('مالک ثبت مشترک تغییر کرده است.',409);
  changes={commit:{...d.commit,state:b.uncertain?'uncertain':'done',status:Number.isInteger(b.status)?b.status:0}};
 }else fail('دستور اتصال معتبر نیست.');
 // JSON patches preserve concurrent heartbeats. Revision CAS serializes writes
 // from both devices; an uncertain submission is never automatically retried.
 const args:any[]=[];const assignments=Object.entries(changes).map(([k,v])=>{args.push('$.'+k,JSON.stringify(v));return ',?,json(?)'}).join('');
 const result=await db.prepare("UPDATE flow_entities SET data=json_set(data"+assignments+"),revision=revision+1,updated=? WHERE id=? AND type='device_pair' AND revision=? AND json_extract(data,'$.closed')=0").bind(...args,new Date(now).toISOString(),id,row.revision).run();
 if(!result.meta.changes)fail('تغییر هم‌زمان رخ داد؛ وضعیت تازه را دریافت کنید.',409);
 return pairView(id,row.revision+1,{...d,...changes},side,now);
}
