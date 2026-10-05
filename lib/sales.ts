import {storage} from './storage';
import {AccessError} from './authorization';
import type {Session} from './permissions';
import {dayAt,addDay,validDay,taskRequired,taskText} from './duties';
import {salesAccounts,salesTargetProgress,rial,total,salesRequestChannels} from './sales-contract';
import {sha256} from './firmware';
export const salesFail=(m:string,status=400):never=>{throw new AccessError(m,status)};
export {salesRep,salesManager,salesStaff,salesFinance,salesRead,salesWarehouse} from './sales-access';
import {salesRep,salesRead,salesWarehouse} from './sales-access';
export const sreq=taskRequired,stxt=taskText;
export function money(v:unknown,positive=false){const s=sreq(v,18);if(!/^\d{1,18}$/.test(s)||positive&&BigInt(s)<=BigInt(0))salesFail('مبلغ باید ریال صحیح '+(positive?'مثبت':'نامنفی')+' باشد.');return BigInt(s).toString();}
export function sday(v:unknown){const s=sreq(v,10);if(!validDay(s))salesFail('تاریخ معتبر لازم است.');return s;}
export function salesSubmission(u:Session,agentId:string,source:any,at:string){
 if(salesRep(u)){if(source!=null)salesFail('نماینده درخواست را مستقیماً از حساب خودش ثبت می‌کند.');return {actor:u.userId,actorName:u.name,agentId,onBehalf:false,channel:'portal',at};}
 if(!source||typeof source!=='object'||Array.isArray(source)||!Object.hasOwn(salesRequestChannels,source.channel))salesFail('روش دریافت درخواست نماینده را مشخص کنید.');
 const day=sday(source.day);if(day>dayAt())salesFail('تاریخ دریافت درخواست در آینده نباشد.');
 return {actor:u.userId,actorName:u.name,agentId,onBehalf:true,channel:source.channel,contactName:sreq(source.contactName,200),day,reference:sreq(source.reference,1000),at};
}
export function integer(v:unknown,min=1,max=10000){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)salesFail('عدد صحیح در محدوده مجاز وارد کنید.');return v as number;}
export function arr(v:unknown,max=100){if(!Array.isArray(v)||!v.length||v.length>max)salesFail('فهرست غیرخالی معتبر لازم است.');return v as any[];}
export const salesDecode=(r:any)=>({...r,data:JSON.parse(r.data)});
export async function salesRows(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type GLOB 'sales_*' ORDER BY created,id").all()).results.map(salesDecode);}
export async function salesEntity(id:string,type:string){const r:any=await storage().prepare('SELECT * FROM flow_entities WHERE id=? AND type=?').bind(id,type).first();if(!r)salesFail('پرونده پیدا نشد.',404);return salesDecode(r);}
export async function salesScope(u:Session,id:string){if(!salesRead(u)&&!salesWarehouse(u)||salesRep(u)&&id!==u.permissions.salesAgentId)salesFail('پرونده پیدا نشد یا دسترسی ندارید.',404);const a=await salesEntity(id,'sales_agent');if(salesRep(u)&&!a.data.active)salesFail('نمایندگی غیرفعال شده است.',403);return a;}
export async function salesLock(db:D1Database,id:string){const r:any=await db.prepare("SELECT revision FROM flow_entities WHERE id='sales-lock'").first();const now=new Date().toISOString();return [db.prepare("UPDATE inventory_operations SET guard=CASE WHEN COALESCE((SELECT revision FROM flow_entities WHERE id='sales-lock'),0)=? THEN guard ELSE 0 END WHERE id=?").bind(r?.revision||0,id),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES('sales-lock','sales_lock','{}',1,?,?) ON CONFLICT(id) DO UPDATE SET revision=flow_entities.revision+1,updated=excluded.updated").bind(now,now)];}
export async function salesQuote(agent:any,items:any[],rows:any[]){
 if(!agent.data.active)salesFail('نمایندگی غیرفعال است.');const today=dayAt();const targets=rows.filter(r=>r.type==='sales_target'&&r.data.agentId===agent.id&&r.data.state==='active'&&r.data.start<=today&&r.data.end>=today);if(targets.length>1)salesFail('بازه قوانین تخفیف تداخل دارد.',409);
 const target=targets[0],progress=target?salesTargetProgress(target,rows,today):null,discountBps=progress?.discountBps||0;
 const lines:any[]=[];for(const i of arr(items,30)){const productId=sreq(i.productId),quantity=integer(i.quantity,1,10000);if(lines.some(l=>l.productId===productId))salesFail('کالای تکراری را در یک ردیف ثبت کنید.');
 const r:any=await storage().prepare("SELECT payload FROM records WHERE id=? AND kind='product'").bind(productId).first();if(!r||JSON.parse(r.payload).status==='غیرفعال'||JSON.parse(r.payload).status==='توقف تولید')salesFail('محصول فعال موجود نیست.');const product=JSON.parse(r.payload);
 const prices=rows.filter(p=>p.type==='sales_price'&&p.data.productId===productId&&p.data.active&&(p.data.agentId===''||p.data.agentId===agent.id));const price=prices.find(p=>p.data.agentId===agent.id)||prices.find(p=>p.data.agentId==='');if(!price)salesFail('قیمت فعال برای محصول ثبت نشده است.');const lineBps=target&&target.data.productIds.length&&!target.data.productIds.includes(productId)?0:discountBps;const unitNet=(rial(price.data.unitPrice)*BigInt(10000-lineBps))/BigInt(10000);if(unitNet<=BigInt(0))salesFail('قیمت پس از تخفیف معتبر نیست.');
 lines.push({productId,name:product.name||product.model||product.code,model:product.model||'',quantity,priceId:price.id,priceRevision:price.revision,unitPrice:price.data.unitPrice,discountBps:lineBps,unitNet:String(unitNet),net:String(unitNet*BigInt(quantity)),discount:String((rial(price.data.unitPrice)-unitNet)*BigInt(quantity))});}
 if(total(lines,l=>l.net)>BigInt('999999999999999999'))salesFail('جمع سفارش از سقف مبلغ مجاز بیشتر است.');
 const quote={agentId:agent.id,agentRevision:agent.revision,day:today,lines,amount:String(total(lines,l=>l.net)),discount:String(total(lines,l=>l.discount)),discountBps,targetId:target?.id||'',targetRevision:target?.revision||0,targetProgress:progress?.progress||'0',discountPolicy:'net-invoiced-next-order-v1',termDays:agent.data.termDays,due:addDay(today,agent.data.termDays),recipient:{name:agent.data.name,phone:agent.data.phone,address:agent.data.address,province:agent.data.province,city:agent.data.city}};
 return {...quote,quoteHash:await sha256(new TextEncoder().encode(JSON.stringify(quote)).buffer)};
}
export function publicSalesFile(f:any){const {objectKey,uploadSignature,actor,...data}=f.data;return {...f,data};}
export async function salesDelivery(rows:any[],agentIds:string[]){
 const orders=rows.filter(r=>r.type==='sales_order'&&agentIds.includes(r.data.agentId)),orderIds=new Set(orders.map(o=>o.id));
 const sales=(await storage().prepare("SELECT * FROM flow_entities WHERE type='sale'").all()).results.map(salesDecode).filter(s=>orderIds.has(s.data.salesOrderId));
 const missions=(await storage().prepare("SELECT * FROM flow_entities WHERE type='transport' AND json_extract(data,'$.kind')='sale'").all()).results.map(salesDecode);
 const devices=(await storage().prepare("SELECT id,payload FROM records WHERE kind='device'").all()).results as any[];
 return sales.map(s=>{const m=missions.find(m=>m.data.sourceId===s.id&&m.data.state!=='cancelled');return {id:s.id,revision:s.revision,orderId:s.data.salesOrderId,productId:s.data.productId,state:s.data.state,count:s.data.count,deviceIds:s.data.deviceIds,devices:s.data.deviceIds.map((id:string)=>({id,serial:devices.find(d=>d.id===id)?JSON.parse(devices.find(d=>d.id===id).payload).code:id})),dispatchedAt:s.data.dispatchedAt||'',deliveredAt:s.data.deliveredAt||'',transport:m?{id:m.id,revision:m.revision,state:m.data.state,code:m.data.code,due:m.data.due,carrier:m.data.carrier,waybill:m.data.waybill,tracking:m.data.tracking,packages:m.data.packages,receipt:m.data.receipt||null}:null};});
}
