import {sourcingStepDestination} from './sourcing-review-contract';
import {hasDeliveryDays,needsPurchaseConfirmation} from './sourcing-delivery';
import {supplyAssignment,supplyRoleMember} from './sourcing-workflow';
import {stockQuality} from './stock-quality';
import {accessPermissions} from './permissions';
import {productProductionMode} from './model';
import {supplierWork,rfqComplete} from './suppliers';
import {replenishSteps,replenishmentPolicy,replenishTasks} from './replenishment';
import {storage} from './storage';
import {AccessError} from './authorization';
import type {Session} from './permissions';
import {dayAt,taskRequired,taskText,validDay,notice} from './duties';
import {scaled} from './production';
import {supplyRoles} from './sourcing-labels';
export {supplyRoles,supplyStates} from './sourcing-labels';
export const hasSupply=(u:Session,r:string)=>u.isAdmin||!!accessPermissions(u.permissions).supplyRoles?.includes(r);
export function productionRequestAccess(u:Session){
 const p=accessPermissions(u.permissions),inside=!p.salesAgentId&&!p.serviceAgentId&&!p.hospitalCenterId;
 const internal=inside&&(u.isAdmin||!!p.supplyRoles?.some(r=>['production_planning','engineering'].includes(r))||!!p.flowRoles?.includes('production'));
 const canCreate=inside&&(internal||!!p.supplyRoles?.includes('sales'));
 return {canCreate,internal,allowedProductionModes:internal?['routine','project']:canCreate?['project']:[]};
}
export function needProductionRequest(u:Session,product:any){
 const access=productionRequestAccess(u);if(!access.canCreate)throw new AccessError('فروش خانگی پیش‌فاکتور ثبت می‌کند؛ درخواست تولید با فروش بیمارستانی یا واحد تولید است.',403);
 if(access.internal)return access;
 const mode=productProductionMode(product);
 if(!mode)throw new AccessError('روش تولید این محصول هنوز مشخص نشده است؛ مسئول تعریف محصول ابتدا روتین یا ساخت سفارشی بیمارستانی را تعیین کند.',400);
 if(mode==='routine')throw new AccessError('محصول روتین خانگی به درخواست تولید فروش نیاز ندارد؛ پیش‌فاکتور را از بخش فروش ثبت کنید.',400);
 return access;
}
export function needSupply(u:Session,r:string){if(!hasSupply(u,r))throw new AccessError('مجوز این مرحله تأمین را ندارید.',403);}
export function day(v:unknown){const s=taskRequired(v,10);if(!validDay(s))throw new AccessError('تاریخ معتبر انتخاب کنید.',400);return s;}
export function quantity(v:unknown){try{return scaled(v)}catch(e){throw new AccessError((e as Error).message,400)}}
export function rial(v:unknown){const s=taskRequired(v,18);if(!/^\d{1,18}$/.test(s))throw new AccessError('مبلغ ریال باید عدد صحیح نامنفی باشد.',400);return BigInt(s).toString();}
function milli(v:unknown){const s=taskRequired(v,24);if(!/^\d{1,15}(\.\d{1,3})?$/.test(s))throw new AccessError('عدد نامنفی با حداکثر سه رقم اعشار لازم است.',400);const [i,d='']=s.split('.');return BigInt(i)*BigInt(1000)+BigInt(d.padEnd(3,'0'));}
export function quoteCost(q:any,amount:number){const price=milli(q.unitPrice),fx=milli(q.fxRate);if(price<=BigInt(0)||fx<=BigInt(0))throw new AccessError('قیمت و نرخ تبدیل باید مثبت باشند.',400);if(q.currency==='IRR'&&fx!==BigInt(1000)||q.currency==='IRT'&&fx!==BigInt(10000))throw new AccessError('نرخ ریال ۱ و تومان ۱۰ ریال است.',400);if(!['IRR','IRT','USD','CNY','EUR'].includes(q.currency))throw new AccessError('ارز معتبر نیست.',400);return ((price*BigInt(amount)*fx+BigInt(999999999))/BigInt(1000000000)+BigInt(rial(q.extrasRial))).toString();}
export const decode=(r:any)=>({...r,data:JSON.parse(r.data)});
export async function supplyEntities(type:string){return (await storage().prepare('SELECT * FROM flow_entities WHERE type=? ORDER BY created,id').bind(type).all()).results.map(decode);}
export async function stockCandidates(code:string,unit:string){return (await storage().prepare("SELECT r.id,r.payload,SUM(i.quantity) AS quantity,COALESCE((SELECT SUM(h.quantity) FROM sourcing_holds h WHERE h.source_type='stock' AND h.source_id=r.id),0) AS held FROM records r JOIN inventory_balances i ON i.item_id=r.id WHERE r.kind='batch' AND json_extract(r.payload,'$.partCode')=? AND json_extract(r.payload,'$.unit')=? AND json_extract(r.payload,'$.status')='تأیید' AND (COALESCE(json_extract(r.payload,'$.expiry'),'')='' OR json_extract(r.payload,'$.expiry')>=?) AND i.warehouse IN ('raw','line') GROUP BY r.id HAVING SUM(i.quantity)>0 ORDER BY r.created,r.id").bind(code,unit,dayAt()).all()).results as any[];}
/** Pending receipts cover purchasing demand, never physical production release. */
export async function pendingCandidates(code:string,unit:string,excludePlan=''){
 const db=storage(),rows=(await db.prepare("SELECT r.id,r.payload,f.data,i.quantity AS balance FROM records r JOIN flow_entities f ON f.id=r.id AND f.type='receipt' JOIN inventory_balances i ON i.item_id=r.id AND i.warehouse='quarantine' WHERE r.kind='batch' AND json_extract(r.payload,'$.partCode')=? AND json_extract(r.payload,'$.unit')=? AND i.quantity>0 ORDER BY r.created,r.id").bind(code,unit).all()).results as any[];
 const holds=(await db.prepare("SELECT * FROM sourcing_holds WHERE part_code=? AND unit=? AND plan_id<>?").bind(code,unit,excludePlan).all()).results as any[],poLeft=new Map<string,number>();
 for(const h of holds.filter(h=>h.source_type==='po'))poLeft.set(h.source_id,(poLeft.get(h.source_id)||0)+h.quantity);
 return rows.map(row=>{const data=JSON.parse(row.data),quantity=stockQuality('quarantine',row.balance,data,JSON.parse(row.payload),dayAt()).pending,directHeld=holds.filter(h=>h.source_type==='receipt'&&h.source_id===row.id).reduce((n,h)=>n+h.quantity,0),legacyHeld=Math.min(Math.max(0,quantity-directHeld),poLeft.get(data.purchaseOrderId)||0);poLeft.set(data.purchaseOrderId,Math.max(0,(poLeft.get(data.purchaseOrderId)||0)-legacyHeld));return {id:row.id,quantity,directHeld,legacyHeld,held:directHeld+legacyHeld,data};}).filter(c=>c.quantity>0);
}
async function orderedHolds(type:string,source:string){return (await storage().prepare("SELECT h.*,COALESCE(json_extract(p.data,'$.needBy'),json_extract(p.data,'$.due')) need_by FROM sourcing_holds h JOIN flow_entities p ON p.id=h.plan_id WHERE h.source_type=? AND h.source_id=? ORDER BY COALESCE(json_extract(p.data,'$.needBy'),json_extract(p.data,'$.due')),p.created,h.id").bind(type,source).all()).results as any[];}
function quota(rows:any[],id:string,capacity:number){for(const h of rows){const n=Math.min(capacity,h.quantity);if(h.id===id)return n;capacity-=n;}return 0;}
export async function coverage(plan:any){
 const db=storage(),holds=(await db.prepare('SELECT * FROM sourcing_holds WHERE plan_id=?').bind(plan.id).all()).results as any[],orders=await supplyEntities('purchase_order'),receipts=await supplyEntities('receipt'),lines=[];
 for(const l of plan.data.lines||[]){let stock=0,pending=0,pipeline=0;const candidates=await stockCandidates(l.partCode,l.unit),waiting=await pendingCandidates(l.partCode,l.unit);
  for(const h of holds.filter(h=>h.part_code===l.partCode&&h.unit===l.unit)){
   if(h.source_type==='stock'){const c=candidates.find(c=>c.id===h.source_id);if(c&&c.quantity>=c.held)stock+=h.quantity;}
   else if(h.source_type==='receipt'){const c=waiting.find(c=>c.id===h.source_id);if(c)pending+=quota(await orderedHolds('receipt',c.id),h.id,c.quantity);}
   else if(h.source_type==='po'){
    const o=orders.find(o=>o.id===h.source_id);if(!o||!['issued','paid','preparing','shipped'].includes(o.data.state))continue;
    let arrived=waiting.filter(c=>c.data.purchaseOrderId===o.id).reduce((n,c)=>n+Math.max(0,c.quantity-c.directHeld),0),future=Math.max(0,o.data.quantity-receipts.filter(r=>r.data.purchaseOrderId===o.id).reduce((n,r)=>n+r.data.quantity,0));
    for(const other of await orderedHolds('po',o.id)){const a=Math.min(arrived,other.quantity);arrived-=a;const f=o.data.eta>=dayAt()&&o.data.eta<=other.need_by?Math.min(future,other.quantity-a):0;future-=f;if(other.id===h.id){pending+=a;pipeline+=f;break;}}
   }
  }
  lines.push({...l,stock,pending,pipeline,shortage:Math.max(0,l.required-stock-pending-pipeline)});
 }
 return lines;
}
/** Called AFTER all stock entries in the same transaction; raw→line transfers keep holds. */
export function holdChecks(db:D1Database,operation:string,items:string[]){return [...new Set(items)].map(item=>db.prepare("UPDATE inventory_operations SET guard=CASE WHEN COALESCE((SELECT SUM(quantity) FROM inventory_balances WHERE item_id=? AND warehouse IN ('raw','line','transit')),0)>=COALESCE((SELECT SUM(quantity) FROM sourcing_holds WHERE source_type='stock' AND source_id=?),0) THEN guard ELSE 0 END WHERE id=?").bind(item,item,operation));}
function reserve(db:D1Database,h:any,type:string,source:string,n:number){return db.prepare("INSERT INTO sourcing_holds(id,plan_id,part_code,unit,source_type,source_id,quantity) VALUES(?,?,?,?,?,?,?) ON CONFLICT(plan_id,source_type,source_id) DO UPDATE SET quantity=sourcing_holds.quantity+excluded.quantity").bind(crypto.randomUUID(),h.plan_id,h.part_code,h.unit,type,source,n);}
/** Arrival moves its existing purchase claims to pending receipt claims atomically. */
export async function allocatePurchaseReceipt(orderId:string,batchId:string,amount:number,target='receipt'){
 const db=storage(),result:D1PreparedStatement[]=[];let left=amount;
 for(const h of await orderedHolds('po',orderId)){const n=Math.min(left,h.quantity);if(!n)break;result.push(db.prepare('DELETE FROM sourcing_holds WHERE id=?').bind(h.id));if(n<h.quantity)result.push(reserve(db,h,'po',orderId,h.quantity-n));result.push(reserve(db,h,target,batchId,n));left-=n;}
 return result;
}
/** A rejection removes purchasing coverage immediately; PO claims retain the
 * intended plan for an explicitly received replacement, without assuming stock. */
export async function reconcileReceiptHolds(batchId:string,accepted:number,orderId='',shelved=false){
 const db=storage(),result:D1PreparedStatement[]=[];let left=accepted;
 for(const h of await orderedHolds('receipt',batchId)){
  const n=Math.min(left,h.quantity);left-=n;result.push(db.prepare('DELETE FROM sourcing_holds WHERE id=?').bind(h.id));
  if(n)result.push(reserve(db,h,shelved?'stock':'receipt',batchId,n));
  if(h.quantity>n&&orderId)result.push(reserve(db,h,'po',orderId,h.quantity-n));
 }
 // Legacy receipts may still carry PO claims rather than receipt claims.
 if(shelved&&left&&orderId)result.push(...await allocatePurchaseReceipt(orderId,batchId,left,'stock'));
 return result;
}
export async function allocateAcceptedPurchase(orderId:string,batchId:string,accepted:number){return reconcileReceiptHolds(batchId,accepted,orderId,true);}
/** Lock snapshot used by planning and receipt/shelving. No runtime schema mutation. */
export async function supplyLock(db:D1Database,id:string){const r:any=await db.prepare("SELECT revision FROM flow_entities WHERE id='sourcing-lock'").first();return [db.prepare("UPDATE inventory_operations SET guard=CASE WHEN COALESCE((SELECT revision FROM flow_entities WHERE id='sourcing-lock'),0)=? THEN guard ELSE 0 END WHERE id=?").bind(r?.revision||0,id),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES('sourcing-lock','sourcing_lock','{}',1,?,?) ON CONFLICT(id) DO UPDATE SET revision=flow_entities.revision+1,updated=excluded.updated").bind(new Date().toISOString(),new Date().toISOString())];}
export function nextWork(p:any,quotes:any[],orders:any[],lines:any[]){const steps:{key:string;role:string;title:string;dueDay?:string}[]=[];const add=(key:string,role:string,title:string,dueDay?:string)=>steps.push({key,role,title,...(dueDay?{dueDay}:{})});if(p.data.state==='pending')add('approve','ceo','بررسی درخواست تولید');if(['waiting_bom','approved','sourcing','ready'].includes(p.data.state)&&p.data.finance?.status!=='approved')add('budget','finance','اعلام برنامه تأمین مالی');if(p.data.state==='waiting_bom')add('bom','engineering','تکمیل و معرفی BOM');if(p.data.state==='project_returned')add('project_review','inventory','اصلاح و محاسبه مجدد کسری از پروژه مبدأ');if(p.data.state==='direct_returned')add('direct_resubmit','inventory','اصلاح درخواست مستقیم برگشتی');if(p.data.state==='inventory_review')add('inventory_review','inventory','بررسی و تأیید نیاز مواد پیش از بازرگانی');if(p.data.state==='inventory_returned')add('inventory_correction','engineering','اصلاح نیاز برگشتی انبار');if(p.data.state==='approved')add('inventory','inventory','محاسبه مواد و تخصیص موجودی');if(p.data.state==='sourcing'||p.data.state==='ready'){
 for(const l of lines){const os=orders.filter(o=>o.data.planId===p.id&&o.data.partCode===l.partCode&&!['cancelled','closed'].includes(o.data.state));if(!os.length){if(['technical','design'].includes(l.procurement?.status)){add('procurement:'+l.partCode+':'+l.procurement.status,'engineering',(l.procurement.status==='design'?'پیگیری تغییر طراحی و تأیید کیفیت ':'تعیین تکلیف تأمین داخلی/خارجی ')+l.name);continue;}}if(l.shortage>0&&!os.length){if(l.procurement?.status==='searching'){add('search:'+l.partCode+':'+l.procurement.nextFollowup,'domestic','جست‌وجوی تأمین‌کننده جایگزین '+l.name+' · پیگیری '+l.procurement.nextFollowup);continue;}if(!l.routes?.length){add('routes:'+l.partCode,'engineering','تعیین مسیر مجاز تأمین '+l.name);continue;}const qs=quotes.filter(q=>q.data.planId===p.id&&q.data.partCode===l.partCode&&q.data.round===l.round);for(const r of l.routes)if(!qs.some(q=>q.data.route===r)||!rfqComplete(p,l,qs))add('quote:'+l.partCode+':'+l.round+':'+r,r,'استعلام '+l.name);if(l.routes.every((r:string)=>qs.some(q=>q.data.route===r))&&rfqComplete(p,l,qs)){if(qs.some(q=>!q.data.unavailable&&q.data.technical==='pending'))add('technical:'+l.partCode+':'+l.round,'engineering','بررسی فنی پیشنهاد '+l.name);else if(qs.some(q=>q.data.supplierLinkId&&!q.data.unavailable&&q.data.technical==='pass'&&q.data.financial!=='pass'))add('financial:'+l.partCode+':'+l.round,'finance','کنترل مالی پیشنهاد '+l.name);else add('award:'+l.partCode+':'+l.round,'ceo','مقایسه و انتخاب تأمین‌کننده '+l.name);}}}
 for(const o of orders.filter(o=>o.data.planId===p.id&&!['cancelled','closed'].includes(o.data.state)))add((o.data.state==='issued'&&needsPurchaseConfirmation(o.data)?'confirm:':'po:')+o.id,o.data.state==='awaiting_funding'?'finance':o.data.route,o.data.state==='awaiting_funding'?'تأمین وجه و صدور دستور خرید':needsPurchaseConfirmation(o.data)?'قطعی‌کردن خرید نزد تأمین‌کننده':'پیگیری سفارش تا پذیرش انبار',hasDeliveryDays(o.data)&&o.data.purchaseConfirmedAt?o.data.eta:undefined);
 if(lines.length&&lines.every(l=>l.stock>=l.required&&!['technical','design'].includes(l.procurement?.status)))add('ready','inventory','اعلام آمادگی و تحویل برنامه به تولید');
 }return supplierWork(p,steps,quotes,lines).map(s=>sourcingStepDestination(s,p.id));}
export async function followupStatements(plan:any,steps:ReturnType<typeof nextWork>,now:string){
 if(plan.data.origin==='replenishment'&&!plan.data.manualRequest)return replenishTasks(plan,await replenishSteps(plan,steps),now);
 steps=await replenishSteps(plan,steps);
 const db=storage(),members=(await db.prepare("SELECT * FROM app_members WHERE status='active'").all()).results as any[],policy=(await replenishmentPolicy()).data;
 const prefix='sourcing:'+plan.id+':',previous=(await db.prepare('SELECT * FROM duty_runs WHERE template_id LIKE ?').bind(prefix+'%').all()).results as any[],statements:D1PreparedStatement[]=[],wanted=new Set<string>();
 const managers=members.filter(m=>supplyRoleMember(m,'ceo')||supplyRoleMember(m,'commerce_manager')).sort((a,b)=>a.id.localeCompare(b.id));
 for(const step of steps){
  if(step.sourceSection==='flow')continue; // Receipt custody/QC already has its own authoritative material task.
  const a=supplyAssignment(plan,step,members,policy),responsible=a.owner||managers.find(m=>m.id===policy.supervisor)||managers[0];
  // Without any active manager the API explicitly exposes missingOwner; never invent an account.
  if(!responsible)continue;
  const dueDay=step.dueDay|| (step.key.startsWith('search:')?plan.data.lines.find((l:any)=>step.key.startsWith('search:'+l.partCode+':'))?.procurement?.nextFollowup||plan.data.needBy:plan.data.needBy);
  const key=prefix+step.key+(a.owner?'':':unassigned'),id=key+':'+responsible.id;wanted.add(id);
  const old=previous.find(t=>t.id===id);if(old&&!['completed','cancelled'].includes(old.state)){const due=new Date(dueDay+'T16:00:00+03:30').toISOString();const data=JSON.parse(old.data),routeChanged=data.sourceSection!==(step.sourceSection||'sourcing')||(data.sourceId||'')!==(step.sourceId||'');if(routeChanged||step.dueDay&&old.due!==due){data.sourceSection=step.sourceSection||'sourcing';data.sourceId=step.sourceId||'';data.history=[...(data.history||[]),{mode:routeChanged?'workflow_destination_updated':'delivery_due_updated',...(step.dueDay&&old.due!==due?{previousDue:old.due,due}:{}),actor:'workflow',at:now}];statements.push(db.prepare('UPDATE duty_runs SET due=?,data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(step.dueDay?due:old.due,JSON.stringify(data),now,old.id,old.revision));}continue;}
  const data={title:(a.owner?'':'نیازمند تعیین مسئول: ')+step.title+' · '+plan.data.productName,sourceSection:step.sourceSection||'sourcing',sourceId:step.sourceId||'',sourcePlanId:plan.id,sourcingWorkflow:true,workflowRole:step.role,missingOwner:!a.owner,instructions:(step.instructions||'')+'\n'+(a.owner?'نتیجه را در فرم اصلی پرونده ثبت کنید؛ پاسخ متنی جای اقدام را نمی‌گیرد.':'مسئول این مرحله را از افراد دارای نقش انتخاب کنید؛ یا فرد واجد نقش مسئولیت را بپذیرد.'),evidence:'text',remindHours:24,escalateHours:24,history:[],answer:'',extensionRequested:''};
  if(old){const before=JSON.parse(old.data);data.history=[...(before.history||[]),{mode:'workflow',note:'مرحله دوباره نیازمند اقدام است.',priorAnswer:before.answer||'',actor:'workflow',at:now}] as any;}
  statements.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,NULL,?,'open',?,1,?,?) ON CONFLICT(id) DO UPDATE SET state='open',due=excluded.due,data=excluded.data,revision=duty_runs.revision+1,updated=excluded.updated").bind(id,key,dueDay,responsible.id,new Date(dueDay+'T16:00:00+03:30').toISOString(),JSON.stringify(data),now,now));
  if(!a.owner)statements.push(notice(id,'@admin','missing-owner','تعیین مسئول لازم است: '+data.title,now));
 }
 // Superseded recipients lose only the task, never its evidence or audit trail.
 for(const t of previous)if(!wanted.has(t.id)&&!['completed','cancelled'].includes(t.state))statements.push(db.prepare("UPDATE duty_runs SET state='cancelled',revision=revision+1,updated=? WHERE id=? AND revision=?").bind(now,t.id,t.revision));
 // Retire the previous legacy projection if this case used replenishment-specific tasks.
 statements.push(db.prepare("UPDATE duty_runs SET state='cancelled',revision=revision+1,updated=? WHERE template_id LIKE ? AND state NOT IN ('completed','cancelled')").bind(now,'replenishment:'+plan.id+':%'));
 return statements;
}
export async function syncSourcingFollowups(){const db=storage(),plans=await supplyEntities('sourcing_plan'),quotes=await supplyEntities('sourcing_quote'),orders=await supplyEntities('purchase_order');for(const p of plans){const statements=await followupStatements(p,nextWork(p,quotes,orders,await coverage(p)),new Date().toISOString());if(!statements.length)continue;const id=crypto.randomUUID();try{await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'sourcing_followup','{}','scheduler',?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN 1 ELSE 0 END)").bind(id,new Date().toISOString(),p.id,p.revision),...statements]);}catch(e){if(!/constraint|guard/i.test(String(e)))throw e;}}}
export async function installSupplyPositions(u:Session){if(!u.isAdmin)return;const db=storage(),now=new Date().toISOString();const defs=[{id:'supply-position:ceo',name:'مدیرعامل',unit:'مدیریت',mission:'تأیید برنامه تولید و انتخاب مستند مسیر تأمین.',responsibilities:'بررسی مقدار و موعد؛ انتخاب پیشنهاد تأمین با هزینه تمام‌شده و ریسک؛ تأیید استثنا؛ پیگیری موانع بین واحدها.',authorityBoundaries:'تأیید برنامه جای ثبت وصول، QC یا دستور پرداخت را نمی‌گیرد.',reportingTo:'هیئت‌مدیره / صاحبان شرکت',handoffs:'فروش، مالی، انبار، بازرگانی و تحقیق و توسعه',metrics:'برنامه‌های معطل تصمیم و تحقق موعد تأمین'}, {id:'supply-position:engineering',name:'مسئول تحقیق و توسعه',unit:'تحقیق و توسعه',mission:'تثبیت مشخصات فنی، BOM و صلاحیت فنی پیشنهادهای تأمین.',responsibilities:'تعریف نسخه BOM؛ کنترل واحد و ضریب مصرف؛ تعیین مسیرهای مجاز تأمین؛ تأیید/رد فنی پیشنهاد با دلیل؛ بررسی تغییر قطعه.',authorityBoundaries:'تأیید فنی به معنی مجوز خرید یا پرداخت نیست؛ BOM پرونده مصوب بدون بازبینی برنامه تغییر نمی‌کند.',reportingTo:'مدیرعامل',handoffs:'تولید، QC، انبار و بازرگانی',metrics:'BOM ناقص؛ زمان پاسخ فنی؛ تغییرات مستند'}];for(const p of defs){const {id,...data}=p;await db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) SELECT ?,'position',?,1,?,? WHERE NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='position' AND (id=? OR json_extract(data,'$.name')=?))").bind(id,JSON.stringify({...data,members:[],supervisor:'',active:true}),now,now,id,p.name).run();}}

export function inventoryReviewSnapshot(lines:any[]){return JSON.stringify(lines.map(l=>({partCode:l.partCode,unit:l.unit,required:l.required,stock:l.stock||0,pending:l.pending||0,pipeline:l.pipeline||0,shortage:l.shortage,routes:l.routes||[],specs:l.specs||''})).sort((a,b)=>a.partCode.localeCompare(b.partCode)));}
export async function inventoryReviewToken(plan:any,lines:any[]){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({id:plan.id,revision:plan.revision,bom:plan.data.bom?.id,lines:inventoryReviewSnapshot(lines)}))))).map(n=>n.toString(16).padStart(2,'0')).join('');}
