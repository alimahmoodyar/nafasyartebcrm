import {storedAccessPermissions} from './permissions';
import {storage} from './storage';
import {AccessError} from './authorization';
import {calculateCosts,moneyMicro,moneyText} from './costing';
import {pricingRead,pricingExecutive,pricingFinance} from './pricing-access';
import {suggestedPrice,pricingKinds} from './pricing-contract';
import {salesRows,salesLock,liveSalesUser,sreq,integer,sday} from './sales';
import {leadMembers,leadMemberGuard} from './sales-leads';
import {selectSalesTemplate} from './sales-template';
import {dayAt} from './duties';
import {trainingContext} from './training-context';
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
const privateTypes="'pricing_cost','pricing_policy','pricing_approval'";
const hash=async(v:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(v))))).map(x=>x.toString(16).padStart(2,'0')).join('');
const percentBps=(v:any)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000||!/^\d+(\.\d{1,2})?$/.test(String(v)))fail('درصد معتبر با حداکثر دو رقم اعشار لازم است.');return Math.round(v*100);};
async function actor(u:any){if(trainingContext.getStore())fail('قیمت‌گذاری در اطلاعات واقعی شرکت انجام می‌شود.',403);u=await liveSalesUser(u);if(!pricingRead(u))fail('دسترسی قیمت‌گذاری برای این نقش تعریف نشده است.',403);return u;}
export async function pricingSource(){
 const db=storage(),[entities,records,boms]=await Promise.all([db.prepare("SELECT * FROM flow_entities WHERE type IN ('cost_material','cost_standard') ORDER BY id").all(),db.prepare("SELECT * FROM records WHERE kind='product' ORDER BY id").all(),db.prepare('SELECT * FROM bom_versions ORDER BY version DESC,id').all()]);
 const src={entities:entities.results.map((r:any)=>({...r,data:JSON.parse(r.data)})),records:records.results,boms:boms.results,entries:[],operations:[],orders:[]};
 return {src,token:await hash(src),standards:calculateCosts(src).standards,products:records.results.map((r:any)=>({id:r.id,...JSON.parse(r.payload)}))};
}
async function workspace(){const source=await pricingSource(),db=storage(),rows=(await db.prepare('SELECT * FROM flow_entities WHERE type IN ('+privateTypes+') ORDER BY created,id').all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));return {...source,rows,sales:await salesRows()};}
const basisFor=(w:any,p:any)=>w.rows.find((r:any)=>r.type==='pricing_cost'&&r.data.productId===p.id);
const policyFor=(w:any,p:any)=>w.rows.find((r:any)=>r.type==='pricing_policy'&&r.data.scope==='product'&&r.data.productId===p.id)||w.rows.find((r:any)=>r.type==='pricing_policy'&&r.data.scope==='group'&&r.data.group===p.group);
async function proposal(w:any,p:any,kind:string,proposalDay=dayAt()){
 const basis=basisFor(w,p),policy=policyFor(w,p),template:any=selectSalesTemplate(w.sales,kind,proposalDay),blockers:string[]=[];
 if(!basis)blockers.push('تأیید مالی مبنای هزینه لازم است.');else if(basis.data.method==='standard'&&basis.data.sourceToken!==w.token)blockers.push('منابع هزینه تغییر کرده؛ مالی مبنا را دوباره تأیید کند.');
 if(!policy)blockers.push('الگوی سود مدیرعامل تعریف نشده است.');if(!template)blockers.push('الگوی فروش این نوع خریدار تعریف نشده است.');
 const previous=w.rows.filter((r:any)=>r.type==='pricing_approval'&&r.data.productId===p.id&&r.data.kind===kind).at(-1);
 const input={productId:p.id,kind,basisId:basis?.id,basisRevision:basis?.revision,policyId:policy?.id,policyRevision:policy?.revision,templateId:template?.id,templateRevision:template?.revision,discountBps:template?.data.discountBps??0,previousId:previous?.id||'',sourceToken:basis?.data.method==='standard'?w.token:'',product:JSON.stringify(p)};
 let calculation:ReturnType<typeof suggestedPrice>|null=null;if(!blockers.length)try{calculation=suggestedPrice(basis.data.unitCost,policy.data.targetProfitBps,policy.data.minProfitBps,input.discountBps,policy.data.roundTo);}catch(e){blockers.push((e as Error).message);}
 const comparable=(v:any)=>JSON.stringify(Object.fromEntries(Object.entries(v).filter(([k])=>k!=='previousId')));
 return {...input,proposalDay,token:await hash({...input,proposalDay}),blockers,calculation,basis:basis?.data||null,policy:policy?.data||null,previous:previous?{id:previous.id,effectiveFrom:previous.data.effectiveFrom,unitPrice:previous.data.calculation.unitPrice}:null,changed:!previous||comparable(previous.data.input)!==comparable(input),name:p.name||p.model||p.code,group:p.group||''};
}
export async function getPricing(user:any,forDay=''){let u=await actor(user);const proposalDay=forDay?sday(forDay):dayAt();if(proposalDay<dayAt())fail('تاریخ پیشنهاد نمی‌تواند در گذشته باشد.');const w=await workspace(),products=w.products.filter((p:any)=>p.status==='فعال'),proposals=[];for(const p of products)for(const kind of Object.keys(pricingKinds))proposals.push(await proposal(w,p,kind,proposalDay));u=await actor(u);
 return {today:dayAt(),proposalDay,roles:{finance:pricingFinance(u),executive:pricingExecutive(u)},sourceToken:w.token,products:products.map((p:any)=>({id:p.id,name:p.name||p.model||p.code,group:p.group||'',standard:w.standards.find((s:any)=>s.productId===p.id)||null,basis:basisFor(w,p)||null})),policies:w.rows.filter((r:any)=>r.type==='pricing_policy'),proposals,approvals:w.rows.filter((r:any)=>r.type==='pricing_approval').reverse()};}
export async function applyPricing(user:any,b:any){
 const u=await actor(user);if(b.confirmed!==true||typeof b.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id))fail('تأیید و شناسه عملیات معتبر لازم است.');
 if(b.mode==='cost'? !pricingFinance(u):!['policy','approve'].includes(b.mode)||!pricingExecutive(u))fail('مجوز این مرحله قیمت‌گذاری را ندارید.',403);
 const db=storage(),signature=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه تکراری برای درخواست متفاوت است.',409);return {saved:true,repeated:true,id:b.id};}
 const locks=await salesLock(db,b.id),w=await workspace(),members=await leadMembers(),now=new Date().toISOString(),notes=sreq(b.notes,4000),guards:any[]=[],writes:any[]=[];let target=b.id,data:any,type='';
 if(!u.isAdmin){const m=members.find(m=>m.status==='active'&&(m.subject===u.userId||'local:'+m.id===u.userId));if(!m||JSON.stringify(storedAccessPermissions(m.permissions))!==JSON.stringify(u.permissions))fail('دسترسی تغییر کرده است؛ دوباره وارد شوید.',403);}
 const guard=(condition:string,...args:any[])=>guards.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+condition+' THEN guard ELSE 0 END WHERE id=?').bind(...args,b.id));
 const p=w.products.find((p:any)=>p.id===b.productId&&p.status==='فعال'),requireProduct=()=>{if(!p)fail('محصول فعال را انتخاب کنید.');return p;};
 if(b.mode==='cost'){
  requireProduct();type='pricing_cost';const old=basisFor(w,p);target=old?.id||b.id;if(b.revision!==(old?.revision||0))fail('مبنای هزینه تغییر کرده؛ تازه‌سازی کنید.',409);
  let unitCost='',source:any=null;if(b.method==='standard'){if(b.sourceToken!==w.token)fail('منابع هزینه تغییر کرده‌اند.',409);source=w.standards.find((s:any)=>s.productId===p.id);if(!source?.complete||!source.total)fail('هزینه استاندارد ناقص است؛ نرخ قطعات و دستمزد/سربار را تکمیل کنید.');unitCost=source.total;}
  else if(b.method==='documented'){try{unitCost=moneyText(moneyMicro(b.unitCost));}catch{fail('بهای مستند معتبر وارد کنید.');}}else fail('روش مبنای هزینه معتبر نیست.');if(moneyMicro(unitCost)<=BigInt(0))fail('هزینه مثبت لازم است.');
  data={productId:p.id,method:b.method,unitCost,reference:sreq(b.reference,500),sourceToken:source?w.token:'',source,confirmedAt:now,confirmedBy:u.userId,notes,history:[...(old?.data.history||[]),...(old?[{at:now,previous:old.data.unitCost,actor:u.userId}]:[])]};
 }else if(b.mode==='policy'){
  if(!['product','group'].includes(b.scope))fail('محصول یا گروه محصول را انتخاب کنید.');const group=b.scope==='group'?sreq(b.group):'';if(b.scope==='product')requireProduct();else if(!w.products.some((p:any)=>p.status==='فعال'&&p.group===group))fail('گروه محصول معتبر نیست.');
  type='pricing_policy';const old=w.rows.find((r:any)=>r.type===type&&r.data.scope===b.scope&&(b.scope==='product'?r.data.productId===p.id:r.data.group===group));if(b.revision!==(old?.revision||0))fail('الگوی سود تغییر کرده؛ تازه‌سازی کنید.',409);target=old?.id||b.id;
  const targetProfitBps=b.targetPercent===undefined?integer(b.targetProfitBps,0,100000):percentBps(b.targetPercent),minProfitBps=b.minPercent===undefined?integer(b.minProfitBps,0,targetProfitBps):percentBps(b.minPercent),roundTo=integer(b.roundTo??1000,1,1000000);if(minProfitBps>targetProfitBps)fail('حداقل سود نباید از سود هدف بیشتر باشد.');if(b.targetProfitBps!==undefined&&b.targetProfitBps!==targetProfitBps||b.minProfitBps!==undefined&&b.minProfitBps!==minProfitBps)fail('درصدهای ارسال‌شده با هم سازگار نیستند.');
  data={scope:b.scope,productId:b.scope==='product'?p.id:'',group,targetProfitBps,minProfitBps,roundTo,basis:'markup-on-cost-after-discount-v1',approvedBy:u.userId,approvedAt:now,notes,history:[...(old?.data.history||[]),...(old?[{at:now,previous:{targetProfitBps:old.data.targetProfitBps,minProfitBps:old.data.minProfitBps,roundTo:old.data.roundTo},actor:u.userId}]:[])]};
 }else{
  requireProduct();if(!Object.hasOwn(pricingKinds,b.kind))fail('نوع خریدار معتبر نیست.');const effectiveFrom=sday(b.effectiveFrom);if(effectiveFrom<dayAt())fail('شروع قیمت جدید نمی‌تواند در گذشته باشد.');const v=await proposal(w,p,b.kind,effectiveFrom);if(v.blockers.length)fail(v.blockers.join(' '));if(!v.calculation)fail('محاسبه قیمت کامل نیست.');if(b.token!==v.token)fail('پیشنهاد تغییر کرده؛ پیشنهاد تازه را بررسی کنید.',409);
  type='pricing_approval';data={productId:p.id,kind:b.kind,effectiveFrom,input:Object.fromEntries(Object.entries(v).filter(([k])=>['productId','kind','basisId','basisRevision','policyId','policyRevision','templateId','templateRevision','discountBps','previousId','sourceToken','product'].includes(k))),calculation:v.calculation,costSnapshot:v.basis,policySnapshot:v.policy,approvedAt:now,approvedBy:u.userId,notes};
  // Public sales price carries no cost, profit or approval notes. The confidential floor stays in pricing_approval.
  writes.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_price',?,1,?,?)").bind('approved-price:'+b.id,JSON.stringify({productId:p.id,agentId:'',kind:b.kind,unitPrice:v.calculation!.unitPrice,active:true,effectiveFrom,pricingApprovalId:b.id,reference:'قیمت مصوب بر اساس بهای تمام‌شده'}),now,now));
 }
 guard('(SELECT COUNT(*) FROM flow_entities WHERE type IN ('+privateTypes+'))=?',w.rows.length);guard('(SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE type IN ('+privateTypes+'))=?',w.rows.reduce((n:number,r:any)=>n+r.revision,0));
 if(p){const r:any=w.src.records.find((r:any)=>r.id===p.id);guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='product' AND payload=?)",p.id,r.payload);}
 if(b.mode==='cost'&&b.method==='standard'||b.mode==='approve'&&data.costSnapshot.method==='standard'){
  guard("(SELECT COUNT(*) FROM flow_entities WHERE type IN ('cost_material','cost_standard'))=?",w.src.entities.length);for(const e of w.src.entities)guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',e.id,e.revision);
  guard('(SELECT COUNT(*) FROM bom_versions)=?',w.src.boms.length);for(const bom of w.src.boms)guard('EXISTS(SELECT 1 FROM bom_versions WHERE id=? AND lines=? AND product_id=? AND version=?)',bom.id,bom.lines,bom.product_id,bom.version);
 }
 const old=w.rows.find((r:any)=>r.id===target);writes.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,target,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(target,type,JSON.stringify(data),now,now));
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'pricing_'+b.mode,signature,u.userId,now),...locks,leadMemberGuard(db,b.id,members),...guards,...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'pricing_'+b.mode,JSON.stringify(data),now)]);return {saved:true,id:target};
}
