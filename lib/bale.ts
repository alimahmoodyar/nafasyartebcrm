import {AccessError} from './authorization';
import {storage} from './storage';
import {trainingContext} from './training-context';
import {encryptToken,decryptToken} from './llm-secrets';
import {baleRequest,baleFile,BaleProviderError} from './bale-transport';
import type {Session} from './permissions';

const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const now=()=>new Date().toISOString();
export const baleUuid=(v:unknown):string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)?v:fail('شناسه عملیات معتبر نیست.');
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export async function baleBoundary(u?:Session){
 if(trainingContext.getStore()||u?.rolePreview||u?.profileReview)fail('اتصال بیرونی بله در محیط آزمایش نقش فعال نیست.',403);
 const control:any=await storage().prepare('SELECT phase FROM reset_control WHERE id=1').first();if(control?.phase==='maintenance')fail('سامانه در حالت نگهداری است.',423);
}
export const baleConfig=()=>storage().prepare("SELECT * FROM bale_config WHERE id='company'").first<any>();
export function baleConfigView(c:any){return {configured:!!c,enabled:!!c?.enabled,username:c?.username||'',revision:c?.revision||0};}
const audit=(u:Session,target:string,action:string,data:unknown)=>storage().prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'bale_'+action,JSON.stringify(data),now());
async function guarded(u:Session,condition:string,args:unknown[],statements:D1PreparedStatement[]){
 const db=storage();return db.batch([db.prepare(`INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'bale_mutation','{}',?,?,CASE WHEN ${condition} THEN 1 ELSE 0 END)`).bind(crypto.randomUUID(),u.userId,now(),...args),...statements]);
}
async function ready(){const c=await baleConfig();if(!c?.enabled)fail('مدیر باید اتصال بله را فعال کند.',409);return c;}
async function owner(u:Session){
 const local=u.userId.startsWith('local:');
 const member:any=await storage().prepare("SELECT id FROM app_members WHERE status='active' AND "+(local?'id=?':'subject=?')).bind(local?u.userId.slice(6):u.userId).first();
 if(member)return 'user:'+member.id;if(u.isAdmin)return 'owner:'+u.userId;return fail('حساب فعال یافت نشد.',403);
}
async function recipient(u:Session,supplierId?:string){
 if(!supplierId)return {owner:await owner(u),kind:'user',label:u.name};
 if(!u.isAdmin)fail('اتصال حساب تأمین‌کننده فقط با مدیر است.',403);
 const row:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='supplier'").bind(supplierId).first();
 if(!row)fail('تأمین‌کننده یافت نشد.',404);const d=JSON.parse(row.data);if(d.deletedAt||d.active===false)fail('تأمین‌کننده فعال انتخاب کنید.');
 return {owner:'supplier:'+supplierId,kind:'supplier',label:String(d.name||d.title||supplierId)};
}
async function ownedLink(u:Session,id:string){const row:any=await storage().prepare('SELECT * FROM bale_links WHERE id=?').bind(id).first();if(!row||row.owner!==await owner(u)&&!(u.isAdmin&&row.kind==='supplier'))fail('این اتصال در دسترسی شما نیست.',403);return row;}
export async function baleStatus(u:Session,manage=false){
 await baleBoundary(u);const c=await baleConfig();if(manage&&!u.isAdmin)fail('دسترسی مدیر لازم است.',403);
 const own=await owner(u),links=(await storage().prepare(manage?'SELECT * FROM bale_links ORDER BY updated DESC LIMIT 200':'SELECT * FROM bale_links WHERE owner=?').bind(...(manage?[]:[own])).all()).results as any[];
 const result=[];for(const l of links){const invitation:any=await storage().prepare("SELECT id,candidate_name,state,expires FROM bale_invites WHERE link_id=? AND state IN ('waiting','claimed') AND expires>? ORDER BY expires DESC LIMIT 1").bind(l.id,Date.now()).first();result.push({id:l.id,label:l.label,kind:l.kind,state:l.state,chatName:l.chat_name||'',revision:l.revision,pending:invitation?{id:invitation.id,name:invitation.candidate_name||'',state:invitation.state,expires:invitation.expires}:null});}
 const outbox=(await storage().prepare(manage?'SELECT o.id,o.link_id,o.purpose,o.state,o.message_id,o.error,o.created FROM bale_outbox o ORDER BY created DESC LIMIT 50':'SELECT o.id,o.link_id,o.purpose,o.state,o.message_id,o.error,o.created FROM bale_outbox o JOIN bale_links l ON l.id=o.link_id WHERE l.owner=? ORDER BY o.created DESC LIMIT 20').bind(...(manage?[]:[own])).all()).results;
 const suppliers=manage?(await storage().prepare("SELECT id,data FROM flow_entities WHERE type='supplier' ORDER BY updated DESC LIMIT 500").all()).results.filter((r:any)=>{const d=JSON.parse(r.data);return !d.deletedAt&&d.active!==false}).map((r:any)=>({id:r.id,name:JSON.parse(r.data).name||r.id})):[];
 return {accountId:u.userId,config:baleConfigView(c),links:result,outbox:outbox.map((r:any)=>({...r,state:r.state==='sending'&&Date.parse(r.created)<Date.now()-120000?'unknown':r.state})),suppliers};
}
export async function saveBaleConfig(u:Session,b:any){
 await baleBoundary(u);if(!u.isAdmin)fail('دسترسی مدیر لازم است.',403);if(b.confirmed!==true||!Number.isSafeInteger(b.revision)||typeof b.enabled!=='boolean')fail('تأیید و نسخه معتبر لازم است.');
 const old=await baleConfig();if((old?.revision||0)!==b.revision)fail('تنظیمات تغییر کرده است؛ تازه‌سازی کنید.',409);
 let cipher=old?.token_cipher,botId=old?.bot_id,username=old?.username;
 if(b.token){
  if(typeof b.token!=='string'||!/^\d{1,24}:[A-Za-z0-9_-]{20,180}$/.test(b.token))fail('توکن بازو معتبر نیست.');
  const me=await baleRequest(b.token,'getMe');if(me?.is_bot!==true||!Number.isSafeInteger(me.id)||typeof me.username!=='string'||!/^\w{3,100}$/.test(me.username))fail('هویت بازوی بله تأیید نشد.',502);
  const webhook=await baleRequest(b.token,'getWebhookInfo');if(webhook?.url)fail('این بازو وب‌هوک فعال دارد؛ بازوی اختصاصی بدون وب‌هوک انتخاب کنید.',409);
  botId=String(me.id);username=me.username;
  if(old&&old.bot_id!==botId){const count:any=await storage().prepare("SELECT COUNT(*) n FROM bale_links WHERE state='active'").first();if(count.n)fail('پیش از تغییر بازو، اتصال‌های فعال قبلی را قطع کنید.',409);}
  cipher=await encryptToken(b.token,'bale:company');
 }
 if(!cipher)fail('توکن بازو را در همین فرم امن وارد کنید.');
 const at=now(),db=storage();const change=old?db.prepare("UPDATE bale_config SET token_cipher=?,bot_id=?,username=?,enabled=?,revision=revision+1,poll_offset=CASE WHEN bot_id=? THEN poll_offset ELSE 0 END,poll_after=0,updated=? WHERE id='company' AND revision=?").bind(cipher,botId,username,b.enabled?1:0,botId,at,b.revision):db.prepare("INSERT INTO bale_config(id,token_cipher,bot_id,username,enabled,revision,updated) VALUES('company',?,?,?,?,1,?)").bind(cipher,botId,username,b.enabled?1:0,at);
 await guarded(u,"COALESCE((SELECT revision FROM bale_config WHERE id='company'),0)=?",[b.revision],[change,audit(u,'company','config',{enabled:b.enabled,tokenChanged:!!b.token,revision:b.revision+1})]);
 return {config:baleConfigView(await baleConfig())};
}
export async function inviteBale(u:Session,b:any){
 await baleBoundary(u);if(b.confirmed!==true)fail('تأیید لازم است.');const code=baleUuid(b.id),id=await hash(code),c=await ready(),target=await recipient(u,b.supplierId),db=storage();
 const existing:any=await db.prepare('SELECT i.*,l.owner FROM bale_invites i JOIN bale_links l ON l.id=i.link_id WHERE i.id=?').bind(id).first();
 if(existing){if(existing.owner!==target.owner||existing.bot_id!==c.bot_id)fail('شناسه عملیات قبلاً برای گیرنده دیگری استفاده شده است.',409);if(existing.expires<=Date.now()||!['waiting','claimed'].includes(existing.state))fail('پیوند منقضی یا مصرف شده است؛ پیوند جدید بسازید.',409);return {url:`https://ble.ir/${c.username}?start=${code}`,expires:existing.expires};}
 const previous:any=await db.prepare('SELECT * FROM bale_links WHERE owner=?').bind(target.owner).first(),linkId=previous?.id||crypto.randomUUID(),expires=Date.now()+10*60000;
 await guarded(u,"EXISTS(SELECT 1 FROM bale_config WHERE id='company' AND revision=? AND enabled=1)",[c.revision],[
  db.prepare("INSERT INTO bale_links(id,owner,kind,label,bot_id,state,revision,updated) VALUES(?,?,?,?,?,'unlinked',1,?) ON CONFLICT(owner) DO UPDATE SET label=excluded.label").bind(linkId,target.owner,target.kind,target.label,c.bot_id,now()),
  db.prepare("UPDATE bale_invites SET state='cancelled' WHERE link_id=? AND state IN ('waiting','claimed')").bind(linkId),
  db.prepare("INSERT INTO bale_invites(id,link_id,bot_id,expires,state) VALUES(?,?,?,?,'waiting')").bind(id,linkId,c.bot_id,expires),audit(u,linkId,'invite',{kind:target.kind})
 ]);return {url:`https://ble.ir/${c.username}?start=${code}`,expires};
}
export async function confirmBale(u:Session,b:any){
 await baleBoundary(u);if(b.confirmed!==true)fail('تأیید لازم است.');const c=await ready(),link=await ownedLink(u,b.linkId),db=storage();
 const i:any=await db.prepare("SELECT * FROM bale_invites WHERE id=? AND link_id=? AND state='claimed' AND expires>? AND bot_id=?").bind(b.inviteId,link.id,Date.now(),c.bot_id).first();
 if(!i)fail('پیوند آمادهٔ تأیید نیست یا منقضی شده است.',409);
 if(link.revision!==b.revision)fail('اتصال تغییر کرده است؛ تازه‌سازی کنید.',409);
 await guarded(u,"EXISTS(SELECT 1 FROM bale_links WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM bale_invites WHERE id=? AND state='claimed' AND expires>?) AND EXISTS(SELECT 1 FROM bale_config WHERE id='company' AND revision=? AND enabled=1)",[link.id,b.revision,i.id,Date.now(),c.revision],[
  db.prepare("UPDATE bale_links SET chat_id=?,chat_name=?,bot_id=?,state='active',revision=revision+1,updated=? WHERE id=? AND revision=?").bind(i.candidate_chat,i.candidate_name,c.bot_id,now(),link.id,b.revision),
  db.prepare("UPDATE bale_invites SET state='consumed' WHERE link_id=? AND state IN ('waiting','claimed')").bind(link.id),audit(u,link.id,'confirm',{revision:b.revision+1})
 ]);return {connected:true};
}
export async function unlinkBale(u:Session,b:any){
 await baleBoundary(u);if(b.confirmed!==true)fail('تأیید لازم است.');const link=await ownedLink(u,b.linkId);if(b.revision!==link.revision)fail('اتصال تغییر کرده است.',409);
 await guarded(u,'EXISTS(SELECT 1 FROM bale_links WHERE id=? AND revision=?)',[link.id,b.revision],[storage().prepare("UPDATE bale_links SET state='revoked',chat_id=NULL,chat_name=NULL,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(now(),link.id,b.revision),storage().prepare("UPDATE bale_invites SET state='cancelled' WHERE link_id=? AND state IN ('waiting','claimed')").bind(link.id),audit(u,link.id,'unlink',{})]);return {disconnected:true};
}
// One receiver for all future inbound workflows; currently only pairing is handled.
// Use polling rather than assuming undocumented webhook signatures from the provider.
export async function pollBale(u?:Session){
 await baleBoundary(u);const c=await ready(),db=storage(),stamp=Date.now();
 const claim=await db.prepare("UPDATE bale_config SET poll_after=? WHERE id='company' AND revision=? AND poll_after<=?").bind(stamp+30000,c.revision,stamp).run();if(!claim.meta.changes)return {polled:false};
 const token=await decryptToken(c.token_cipher,'bale:company'),updates=await baleRequest(token,'getUpdates',{offset:c.poll_offset,limit:100,timeout:0});
 if(!Array.isArray(updates))fail('پاسخ دریافت پیام معتبر نبود.',502);
 let offset=c.poll_offset;for(const update of updates){
  if(!Number.isSafeInteger(update.update_id)||update.update_id<0)fail('شناسه پیام معتبر نبود.',502);
  offset=Math.max(offset,update.update_id+1);const m=update.message;
  if(m?.chat?.type!=='private'||m?.from?.is_bot||!Number.isSafeInteger(m?.from?.id)||m.from.id!==m.chat.id||typeof m.text!=='string')continue;
  const code=/^\/start(?:@\w+)? ([0-9a-f-]{36})$/i.exec(m.text)?.[1];if(!code)continue;
  const candidateName=[m.from.first_name,m.from.last_name,m.from.username?'@'+m.from.username:''].filter(v=>typeof v==='string').join(' ').slice(0,200)||'کاربر بله';
  await db.prepare("UPDATE bale_invites SET candidate_chat=?,candidate_name=?,state='claimed' WHERE id=? AND bot_id=? AND state='waiting' AND expires>? AND EXISTS(SELECT 1 FROM bale_config WHERE id='company' AND revision=? AND enabled=1)").bind(String(m.chat.id),candidateName,await hash(code),c.bot_id,Date.now(),c.revision).run();
 }
 await db.prepare("UPDATE bale_config SET poll_offset=?,poll_after=? WHERE id='company' AND revision=?").bind(offset,Date.now()+10000,c.revision).run();return {polled:true};
}
export type BaleMessage={id:string;linkId:string;purpose:string;sourceRef:string;text:string;file?:{bytes:Uint8Array;filename:string;mime:string}};
// Domain services MUST authorize the exact business record, recipient and attachment.
// No HTTP/MCP endpoint accepts arbitrary messages, chat IDs, URLs or file keys.
export async function sendBale(u:Session,b:BaleMessage,authorize:(link:{id:string;owner:string;kind:string})=>Promise<void>){
 await baleBoundary(u);baleUuid(b.id);if(!b.purpose||b.purpose.length>80||!b.sourceRef||b.sourceRef.length>200||typeof b.text!=='string'||b.text.length>4096||!b.text.trim()&&!b.file)fail('پیام معتبر نیست.');
 const c=await ready(),db=storage(),l:any=await db.prepare("SELECT * FROM bale_links WHERE id=? AND state='active' AND bot_id=?").bind(b.linkId,c.bot_id).first();if(!l)fail('گیرنده اتصال فعال بله ندارد.',409);
 if(l.owner.startsWith('user:')&&!await db.prepare("SELECT id FROM app_members WHERE id=? AND status='active'").bind(l.owner.slice(5)).first())fail('حساب گیرنده غیرفعال است.',409);
 if(l.kind==='supplier'){const p:any=await db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='supplier'").bind(l.owner.slice(9)).first();if(!p||JSON.parse(p.data).deletedAt||JSON.parse(p.data).active===false)fail('پرونده گیرنده فعال نیست.',409);}
 await authorize(l);
 const form=b.file?baleFile(b.file.bytes,b.file.filename,b.file.mime,b.text):null;
 const fingerprint=await hash(JSON.stringify({linkId:l.id,botId:l.bot_id,chatId:l.chat_id,linkRevision:l.revision,actor:u.userId,purpose:b.purpose,sourceRef:b.sourceRef,text:b.text,file:b.file?{filename:b.file.filename,mime:b.file.mime,hash:await crypto.subtle.digest('SHA-256',new Uint8Array(b.file.bytes)).then(v=>Array.from(new Uint8Array(v)))}:null}));
 const old:any=await db.prepare('SELECT * FROM bale_outbox WHERE id=?').bind(b.id).first();if(old){if(old.actor!==u.userId||old.payload_hash!==fingerprint)fail('شناسه ارسال برای پیام دیگری استفاده شده است.',409);return {id:old.id,state:old.state==='sending'&&Date.parse(old.created)<Date.now()-120000?'unknown':old.state,messageId:old.message_id,repeated:true};}
 const at=now();await db.batch([
  db.prepare("INSERT INTO bale_outbox(id,link_id,actor,purpose,source_ref,payload_hash,bot_id,chat_id,link_revision,state,created,updated) SELECT ?,?,?,?,?,?,?,?,?, 'sending',?,? FROM bale_links WHERE id=? AND revision=? AND state='active' AND bot_id=? AND EXISTS(SELECT 1 FROM bale_config WHERE id='company' AND enabled=1 AND revision=?)").bind(b.id,l.id,u.userId,b.purpose,b.sourceRef,fingerprint,c.bot_id,l.chat_id,l.revision,at,at,l.id,l.revision,c.bot_id,c.revision),audit(u,b.id,'send_requested',{purpose:b.purpose,linkId:l.id,sourceRef:b.sourceRef})
 ]);
 const claimed:any=await db.prepare('SELECT * FROM bale_outbox WHERE id=?').bind(b.id).first();if(!claimed)fail('اتصال گیرنده یا تنظیمات تغییر کرده است.',409);
 let state='unknown',messageId:string|null=null,error:string|null=null;
 try{const token=await decryptToken(c.token_cipher,'bale:company');if(form)form.set('chat_id',l.chat_id);const response=await baleRequest(token,form?'sendDocument':'sendMessage',form||{chat_id:l.chat_id,text:b.text});if(!Number.isSafeInteger(response?.message_id))throw new BaleProviderError('unknown','پاسخ ارسال شماره پیام نداشت.');state='sent';messageId=String(response.message_id);}
 catch(e){state=e instanceof BaleProviderError?e.outcome:'failed';error=e instanceof BaleProviderError?e.code:'ارسال به دلیل تنظیمات اتصال انجام نشد.';}
 await db.batch([db.prepare('UPDATE bale_outbox SET state=?,message_id=?,error=?,updated=? WHERE id=?').bind(state,messageId,error,now(),b.id),audit(u,b.id,'send_result',{state,messageId})]);
 return {id:b.id,state,messageId,error};
}
export async function testBaleSend(u:Session,id:string){const own=await owner(u),l:any=await storage().prepare("SELECT id FROM bale_links WHERE owner=? AND state='active'").bind(own).first();if(!l)fail('ابتدا حساب بلهٔ خود را متصل کنید.',409);return sendBale(u,{id,linkId:l.id,purpose:'connection_test',sourceRef:'self',text:'اتصال هم‌نفس به بله با موفقیت آزمایش شد.'},async link=>{if(link.owner!==own)fail('گیرنده آزمون باید حساب خود شما باشد.',403);});}
