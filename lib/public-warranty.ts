import {env} from 'cloudflare:workers';
import {generateActivationCode,normalizeActivationInput} from './activation-code';
import {panelConfig,validLine} from './sms-panel';
import {assetSmsReady,sendNafasyarSms} from './asset-sms';
import {AccessError} from './authorization';
import {normalizeSerial} from './distribution';
import {dayAt} from './duties';
import {customerInput,hospitalMatch,legacyMatch,lookup,product} from './phone-activation-service';
import {storage} from './storage';
import {WARRANTY_CODE_ISSUED} from './warranty';

const channel='public-warranty';
const label='فعال‌سازی از سایت نفس‌یار';
const ticketType='public_warranty_challenge';
const settings=()=>env as typeof env & {PUBLIC_WARRANTY_ACTIVATION?:string;PUBLIC_WARRANTY_TEST_MOBILE?:string;PUBLIC_WARRANTY_TEST_SERIAL?:string};
const fail=(message:string,status=400):never=>{throw new AccessError(message,status);};
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const contactSupport=()=>fail('این دستگاه برای فعال‌سازی اینترنتی آماده نیست. با پشتیبانی نفس‌یار تماس بگیرید.',409);
const validTicket=(token:unknown)=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);
const localizedDate=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Tehran'});

export async function publicWarrantyReady(){
 const {PUBLIC_WARRANTY_ACTIVATION,PUBLIC_WARRANTY_TEST_MOBILE}=settings();
 return PUBLIC_WARRANTY_ACTIVATION==='1'&&await assetSmsReady()
  &&(!PUBLIC_WARRANTY_TEST_MOBILE||/^09\d{9}$/.test(PUBLIC_WARRANTY_TEST_MOBILE));
}
export async function publicWarrantySmsTestReady(){
 const config=await panelConfig();
 return !!config.apiKey&&validLine(config.line)&&/^09\d{9}$/.test(config.mobile);
}
export async function sendPublicWarrantyTestSms(){
 const config=await panelConfig();
 const mobile=config.mobile;
 if(!config.apiKey||!validLine(config.line))return fail('کلید یا خط ارسال پیامک در تنظیمات سرور آماده نیست.',503);
 if(!mobile||!/^09\d{9}$/.test(mobile))return fail('شمارهٔ آزمون پیامک در میزبان تنظیم نشده است.',503);
 await rate('panel-test',mobile,1,300000);
 await sendNafasyarSms(mobile,'نفس‌یار طب\nاین پیامک برای تست ارسال شده است.',config);
 return {accepted:true,mobileLast4:mobile.slice(-4)};
}
async function rate(scope:string,value:string,limit:number,windowMs:number){
 const db=storage(),now=new Date().toISOString(),key=channel+':'+scope+':'+await hash(value);
 const row=await db.prepare('INSERT INTO login_attempts(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<=? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<=? THEN excluded.reset ELSE reset END RETURNING count')
  .bind(key,new Date(Date.now()+windowMs).toISOString(),now,now).first<{count:number}>();
 if(!row||row.count>limit)fail('تعداد درخواست زیاد است. کمی صبر کنید و دوباره تلاش کنید.',429);
}
function input(raw:unknown){
 if(!raw||Array.isArray(raw)||typeof raw!=='object')return fail('اطلاعات فرم معتبر نیست.');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(key=>!['serial','deviceCode','name','mobile','nationalId','postalCode','referrer','address'].includes(key)))return fail('اطلاعات فرم معتبر نیست.');
 const serial=typeof b.serial==='string'&&b.serial.length<=160?normalizeSerial(b.serial):'';
 if(!/^[A-Z0-9][A-Z0-9._/-]{0,159}$/.test(serial))fail('سریال درج‌شده روی بدنهٔ دستگاه را وارد کنید.');
 let deviceCode:string;
 try{deviceCode=normalizeActivationInput(b.deviceCode);}catch(error){return fail((error as Error).message);}
 const address=b.address??'';
 if(typeof address!=='string'||address.length>400)return fail('آدرس باید حداکثر ۴۰۰ نویسه باشد.');
 const customer={...customerInput({name:b.name,mobile:b.mobile,nationalId:b.nationalId,postalCode:b.postalCode,referrer:b.referrer},{}),address:address.trim()};
 const pilot=settings().PUBLIC_WARRANTY_TEST_MOBILE;
 if(pilot&&pilot!==customer.mobile)fail('این فرم فعلاً برای آزمون محدود در دسترس است.',403);
 return {serial,deviceCode,customer};
}
async function candidate(serial:string){
 const found=await lookup(serial).catch(error=>{
  if(error instanceof AccessError&&error.status===403)return contactSupport();
  throw error;
 });
 if(!found.device||found.result.state!=='new'||found.legacyEvents.length) return contactSupport();
 const row=found.productId?await storage().prepare("SELECT id,payload FROM records WHERE id=? AND kind='product'").bind(found.productId).first<{id:string;payload:string}>():null;
 const savedProduct=row?product(row.id,row.payload):null,months=found.result.months??savedProduct?.months;
 if(months===undefined||months<1)return contactSupport();
 const selected={id:found.productId,name:found.result.productName||savedProduct?.name||'',model:found.result.model||savedProduct?.model||'',code:savedProduct?.code||'',months};
 return {found,device:found.device,row,selected,snapshot:await hash(JSON.stringify([found.snapshot,row?.payload]))};
}
type Ticket={state:'sending'|'sent'|'complete';expires:string;fingerprint:string;snapshot:string;result?:{activatedDay:string;activationCode:string;welcomeStatus:'pending'|'sent'|'unconfirmed'}};

async function preparePilotDevice(serial:string){
 const {PUBLIC_WARRANTY_TEST_MOBILE:mobile,PUBLIC_WARRANTY_TEST_SERIAL:testSerial}=settings();
 if(!mobile||testSerial!==serial||!/^WARRANTY-TEST-[A-Z0-9-]{1,40}$/.test(serial))return;
 const db=storage(),now=new Date().toISOString(),productId='public-warranty-test-product:'+serial;
 const seed=(id:string,kind:string,data:unknown)=>db.prepare('INSERT INTO records(id,kind,payload,created) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,kind,JSON.stringify(data),now);
 await db.batch([
  seed(productId,'product',{name:'دستگاه آزمایشی فعال‌سازی',model:'TEST',code:'TEST',status:'فعال',warrantyMonths:24}),
  seed('device:'+serial,'device',{code:serial,product:productId,productName:'دستگاه آزمایشی فعال‌سازی',model:'TEST',warrantyMonths:24}),
 ]);
}

export async function requestPublicWarranty(raw:unknown,client:string){
 if(!await publicWarrantyReady())fail('ارسال پیامک فعال‌سازی فعلاً در دسترس نیست.',503);
 const details=input(raw);
 await rate('client',client,10,600000);
 await preparePilotDevice(details.serial);
 const target=await candidate(details.serial);
 await rate('serial',details.serial,3,3600000);
 await rate('mobile',details.customer.mobile,4,3600000);
 await rate('send','global',80,3600000);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const id=ticketType+':'+await hash(token),now=new Date().toISOString();
 const ticket:Ticket={state:'sending',expires:new Date(Date.now()+10*60000).toISOString(),fingerprint:await hash(token+JSON.stringify(details)),snapshot:target.snapshot};
 const db=storage();
 // Expired challenges remain unusable even if this bounded cleanup is unavailable.
 await db.prepare("DELETE FROM flow_entities WHERE id IN (SELECT id FROM flow_entities WHERE type=? AND json_extract(data,'$.expires')<? LIMIT 20)").bind(ticketType,now).run().catch(()=>{});
 await db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,ticketType,JSON.stringify(ticket),now,now).run();
 const code=generateActivationCode(details.deviceCode);
 await sendNafasyarSms(details.customer.mobile,`نفس‌یار طب\nکد فعال‌سازی: ${code}\nکد را روی دستگاه وارد کنید.`);
 await db.prepare("UPDATE flow_entities SET data=json_set(data,'$.state','sent'),revision=revision+1,updated=? WHERE id=? AND revision=1").bind(now,id).run();
 return {token,mobileLast4:details.customer.mobile.slice(-4)};
}

export async function confirmPublicWarranty(raw:unknown,token:unknown,entered:unknown,client:string){
 if(!await publicWarrantyReady())fail('فعال‌سازی اینترنتی فعلاً در دسترس نیست.',503);
 if(typeof token!=='string'||!validTicket(token))return fail('درخواست منقضی شده است. کد تازه بگیرید.',410);
 const details=input(raw),{serial,customer}=details,db=storage(),id=ticketType+':'+await hash(token);
 await rate('confirm-client',client,30,600000);
 const row=await db.prepare('SELECT data,revision FROM flow_entities WHERE id=? AND type=?').bind(id,ticketType).first<{data:string;revision:number}>();
 const now=new Date().toISOString();
 if(!row)return fail('درخواست منقضی شده است. کد تازه بگیرید.',410);
 const ticket=JSON.parse(row.data) as Ticket;
 if(ticket.state==='sending'||ticket.expires<now||ticket.fingerprint!==await hash(token+JSON.stringify(details)))return fail('درخواست معتبر نیست یا منقضی شده است. کد تازه بگیرید.',410);
 await rate('confirm',id,5,600000);
 const code=typeof entered==='string'?normalizeSerial(entered):'';
 if(!/^\d{5}$/.test(code)||code!==generateActivationCode(details.deviceCode))fail('کد پنج‌رقمی واردشده صحیح نیست.',403);
 if(ticket.state==='complete')return ticket.result!;
 const {found,device,row:productRow,selected,snapshot}=await candidate(serial);
 if(snapshot!==ticket.snapshot)fail('شناسنامهٔ دستگاه تغییر کرده است. کد تازه بگیرید.',409);
 const op=crypto.randomUUID(),day=dayAt(new Date(now)),result:NonNullable<Ticket['result']>={activatedDay:day,activationCode:code,welcomeStatus:'pending'};
 const guard=(sql:string,...args:unknown[])=>db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+sql+' THEN guard ELSE 0 END WHERE id=?').bind(...args,op);
 const profile={serial,customer,product:selected,actorId:channel,actorName:label,at:now};
 await db.batch([
  db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'public_warranty_activation','{}',?,?,1)").bind(op,channel,now),
  guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=? AND type=? AND json_extract(data,'$.expires')>=?)",id,row.revision,ticketType,now),
  guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='device' AND payload=?)",device.id,device.payload),
  guard("1=(SELECT COUNT(*) FROM records WHERE kind='device' AND json_extract(payload,'$.code')=?)",serial),
  ...(productRow?[guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='product' AND payload=?)",productRow.id,productRow.payload)]:[]),
  guard('NOT EXISTS(SELECT 1 FROM flow_entities WHERE '+hospitalMatch+')',serial,serial,device.id,device.id),
  guard('NOT EXISTS(SELECT 1 FROM flow_entities WHERE '+legacyMatch+')',serial,serial,serial),
  guard('NOT EXISTS(SELECT 1 FROM access_audit WHERE target=? AND action=?)','warranty:'+device.id,WARRANTY_CODE_ISSUED),
  db.prepare('INSERT INTO service_activations(serial,day,months,source,created,actor) VALUES(?,?,?,?,?,?)').bind(serial,day,selected.months,channel,now,channel),
  db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'phone_activation_device',?,1,?,?)").bind(found.profileId,JSON.stringify(profile),now,now),
  db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'phone_activation_event',?,1,?,?)").bind(found.historyPrefix+op,JSON.stringify({purpose:'activate',serial,day,first:true,at:now,actorName:label,actorId:channel,dealer:found.result.dealer}),now,now),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),channel,'warranty:'+device.id,WARRANTY_CODE_ISSUED,JSON.stringify({operationId:op}),now),
  db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify({...ticket,state:'complete',result}),now,id,row.revision),
 ]);
 try{
  await sendNafasyarSms(customer.mobile,'به خانوادهٔ نفس‌یار خوش آمدید!\nشروع گارانتی دستگاه: '+localizedDate.format(new Date(now)));
  result.welcomeStatus='sent';
 }catch{result.welcomeStatus='unconfirmed';}
 await db.prepare("UPDATE flow_entities SET data=json_set(data,'$.result.welcomeStatus',?),revision=revision+1,updated=? WHERE id=? AND type=?")
  .bind(result.welcomeStatus,new Date().toISOString(),id,ticketType).run().catch(()=>{});
 return result;
}
