import {checkOrigin,accessResponse} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {boundedBody} from '@/lib/firmware-storage';
import {day} from '@/lib/sourcing';
import {settlementUser,settlementRows,settlementBy,settleVisible,settleBuyer,settleFinance,settleText as txt,settleFail as fail,settleAmount,settlementPreview,settlementHelp} from '@/lib/purchase-settlement';
const json=(v:any,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
const uuid=(v:any)=>{if(typeof v!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v))fail('UUID معتبر لازم است.');return v;};
const array=(v:any,max=100)=>{if(!Array.isArray(v)||v.length>max)fail('فهرست معتبر لازم است.');return v;};
const amount=(v:any)=>{settleAmount(v);return v;};
async function token(data:any){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
const files=(rows:any[],id:string)=>rows.filter(r=>r.type==='settlement_file'&&r.data.settlementId===id).map(r=>({id:r.id,filename:r.data.filename,byteSize:r.data.byteSize,sha256:r.data.sha256}));
async function preview(s:any,rows:any[]){const p=settlementPreview(s.data,rows);return {...p,token:await token({revision:s.revision,preview:p,files:files(rows,s.id)})};}
export async function GET(request:Request){try{const u=await settlementUser(),rows=await settlementRows(),q=new URL(request.url).searchParams,plan=q.get('plan'),id=q.get('id');
 const visible=rows.filter(r=>r.type==='purchase_settlement'&&settleVisible(u,r)&&(!plan||r.data.planId===plan));
 if(id){const s=settlementBy(rows,id,u);return json({settlement:s,preview:await preview(s,rows),files:files(rows,s.id),buyer:settleBuyer(u,s.data.route),finance:settleFinance(u),help:settlementHelp});}
 const orders=rows.filter(r=>r.type==='purchase_order'&&settleVisible(u,r)&&(!plan||r.data.planId===plan)&&['issued','paid','preparing','shipped','closed'].includes(r.data.state));
 const receipts=rows.filter(r=>r.type==='receipt'&&orders.some(o=>o.id===r.data.purchaseOrderId)).map(r=>({...r,claimedBy:rows.find(s=>s.type==='purchase_settlement'&&s.data.lines.some((l:any)=>l.receiptId===r.id))?.id||''}));
 return json({settlements:visible,orders,receipts,buyerRoutes:['domestic','foreign'].filter(r=>settleBuyer(u,r)),finance:settleFinance(u),help:settlementHelp});
 }catch(e){return accessResponse(e)||json({error:'دریافت پرونده تسویه خرید ممکن نشد.'},503);}}
export async function POST(request:Request){try{checkOrigin(request);const u=await settlementUser(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,180000))),id=uuid(b.id);if(b.confirmed!==true)fail('تأیید صریح لازم است.');const db=storage(),signature=JSON.stringify(b),prior:any=await db.prepare('SELECT payload,actor FROM inventory_operations WHERE id=?').bind(id).first();if(prior){if(prior.payload!==signature||prior.actor!==u.userId)fail('شناسه عملیات برای درخواست دیگری استفاده شده است.',409);return json({saved:true,repeated:true});}
 const rows=await settlementRows(),old=b.settlementId?settlementBy(rows,txt(b.settlementId),u):null;const revision=old?.revision||0;if(b.revision!==revision)fail('نسخه تغییر کرده است؛ تازه‌سازی کنید.',409);const now=new Date().toISOString(),notes=txt(b.notes,4000),target=old?.id||id;let d:any=old?{...old.data}:{};const stmts:any[]=[],guards:any[]=[];
 const guard=(q:string,...args:any[])=>guards.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+q+' THEN guard ELSE 0 END WHERE id=?').bind(...args,id));
 guard('COALESCE((SELECT revision FROM flow_entities WHERE id=?),0)=?',target,revision);
 const version=(r:any)=>guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',r.id,r.revision);
 if(b.mode==='save'){
  if(old&&!['draft','returned','reopened'].includes(d.state))fail('فقط پیش‌نویس، برگشتی یا بازگشایی‌شده قابل ویرایش است.');
  const lines=array(b.lines,60);if(!lines.length||new Set(lines.map((l:any)=>l.receiptId)).size!==lines.length)fail('رسیدهای یکتا انتخاب کنید.');let first:any;
  const clean=lines.map((l:any)=>{const r=rows.find(x=>x.id===l.receiptId&&x.type==='receipt'),o=rows.find(x=>x.id===r?.data.purchaseOrderId&&x.type==='purchase_order');if(!r||!o||!['issued','paid','preparing','shipped','closed'].includes(o.data.state))fail('رسید مربوط به سفارش خرید معتبر لازم است.');if(!settleBuyer(u,o.data.route))fail('ثبت بازرگانی این مسیر در دسترسی شما نیست.',403);if(!first)first=o;
   const supplierKey=(o:any)=>o.data.supplierId||o.data.supplier.trim();if(o.data.planId!==first.data.planId||o.data.route!==first.data.route||supplierKey(o)!==supplierKey(first))fail('اقلام باید از یک تأمین‌کننده، مسیر و پرونده تأمین باشند.');
   if(rows.some(s=>s.type==='purchase_settlement'&&s.id!==target&&s.data.lines.some((v:any)=>v.receiptId===r.id)))fail('این بچ قبلاً در پرونده تسویه دیگری ثبت شده است.',409);version(r);version(o);
   return {receiptId:r.id,invoiceQuantity:txt(l.invoiceQuantity,20),unitPrice:amount(l.unitPrice),discount:amount(l.discount),notes:txt(l.notes||'مطابق فاکتور',2000)};});
  if(old?.data.approvals?.length&&JSON.stringify(clean.map((l:any)=>l.receiptId).sort())!==JSON.stringify(old.data.lines.map((l:any)=>l.receiptId).sort()))fail('در اصلاح تأییدشده، مجموعه بچ‌ها قابل تغییر نیست؛ مبلغ و مدرک را اصلاح کنید.');
  const currency=txt(b.currency,3);if(!['IRR','IRT','USD','CNY','EUR'].includes(currency))fail('ارز معتبر لازم است.');
  const expenses=array(b.expenses,40).map((e:any)=>({title:txt(e.title),amountRial:amount(e.amountRial),reference:txt(e.reference)}));
  d={...d,planId:first.data.planId,route:first.data.route,supplier:first.data.supplier,supplierId:first.data.supplierId||'',invoiceNumber:txt(b.invoiceNumber),invoiceDay:day(b.invoiceDay),currency,fxRate:amount(b.fxRate),fxDate:day(b.fxDate),fxSource:txt(b.fxSource),lines:clean,expenses,recoverableTaxRial:amount(b.recoverableTaxRial),reportedPaidRial:amount(b.reportedPaidRial),paymentReference:txt(b.paymentReference||'پرداخت گزارش نشده'),shipmentScope:txt(b.shipmentScope,2000),state:d.approvals?.length?'reopened':'draft',finance:null,notes};settlementPreview(d,rows);
  // Cross-document claim invariant is checked at commit, not just in the read snapshot.
  guard("(SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE type='purchase_settlement')=?",rows.filter(r=>r.type==='purchase_settlement').reduce((n,r)=>n+r.revision,0));
 }else{
  if(!old)fail('پرونده را ابتدا ذخیره کنید.');
  if(b.mode==='submit'){
   if(!settleBuyer(u,d.route))fail('ارسال با بازرگانی همان مسیر است.',403);if(!['draft','returned','reopened'].includes(d.state))fail('پرونده قابل ارسال نیست.');if(!files(rows,target).length)fail('فاکتور یا مدرک خرید را پیوست کنید.');const p=settlementPreview(d,rows);if(p.lines.some((l:any)=>settleAmount(l.unitPrice)<=BigInt(0)))fail('قیمت واقعی اقلام را تکمیل کنید.');d.state='submitted';d.submittedBy=u.userId;d.submittedAt=now;
  }else{
   if(!settleFinance(u))fail('تأیید قیمت و هزینه با دسترسی نوشتن مالی است.',403);
   if(b.mode==='reopen'){if(d.state!=='approved')fail('فقط پرونده تأییدشده بازگشایی می‌شود.');d.state='reopened';d.finance=null;}
   else{if(d.state!=='submitted')fail('پرونده باید در انتظار مالی باشد.');
    if(b.mode==='return'){d.state='returned';d.returnNote=notes;d.finance=null;}
    else if(b.mode==='review'){
     const lines=array(b.lines,60);if(lines.length!==d.lines.length||new Set(lines.map((l:any)=>l.receiptId)).size!==lines.length||lines.some((l:any)=>!d.lines.some((v:any)=>v.receiptId===l.receiptId)))fail('همه ردیف‌های پرونده را بررسی کنید.');
     d.finance={fxRate:amount(b.fxRate),fxDate:day(b.fxDate),fxSource:txt(b.fxSource),allocation:txt(b.allocation),lines:lines.map((l:any)=>({receiptId:l.receiptId,weight:amount(l.weight||'0'),extrasRial:amount(l.extrasRial||'0'),excludedRial:amount(l.excludedRial),disposition:typeof l.disposition==='string'?l.disposition.trim():'',notes:notes})),reviewedBy:u.userId,reviewedAt:now};settlementPreview(d,rows);
    }else if(b.mode==='approve'){
     if(!d.finance)fail('ابتدا بررسی و تخصیص مالی را ذخیره کنید.');const p=await preview(old,rows);if(b.token!==p.token)fail('رسید، قیمت یا پیش‌نمایش تغییر کرده است؛ دوباره بررسی کنید.',409);if(!p.ready)fail(p.problems.join(' / '));guard("(SELECT COUNT(*) FROM flow_entities WHERE type='settlement_file' AND json_extract(data,'$.settlementId')=?)=?",target,files(rows,target).length);
     for(const l of p.lines){const r=rows.find(x=>x.id===l.receiptId&&x.type==='receipt');version(r);const o=rows.find(x=>x.id===r.data.purchaseOrderId&&x.type==='purchase_order');version(o);
      if(!l.accepted)continue;const priceId='cost-price:'+r.data.batchId,price=rows.find(x=>x.id===priceId&&x.type==='cost_price');guard('COALESCE((SELECT revision FROM flow_entities WHERE id=?),0)=?',priceId,price?.revision||0);
      if(price?.data.settlementId&&price.data.settlementId!==target)fail('قیمت بچ متعلق به تسویه دیگری است.');
      const value={batchId:r.data.batchId,partCode:o.data.partCode,unit:o.data.unit,unitCost:l.unitCost,reference:'تسویه '+target+' / فاکتور '+d.invoiceNumber,notes,settlementId:target,settlementRevision:revision+1,history:[...(price?.data.history||[]),{at:now,actor:u.userId,name:u.name,notes,previous:price?{...price.data,history:undefined}:null}]};
      stmts.push(price?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(value),now,priceId,price.revision):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'cost_price',?,1,?,?)").bind(priceId,JSON.stringify(value),now,now));
      stmts.push(db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,priceId,'settlement_price',JSON.stringify(value),now));
     }
     d.state='approved';d.approvals=[...(d.approvals||[]),{at:now,by:u.userId,name:u.name,revision:revision+1,invoiceNumber:d.invoiceNumber,invoiceDay:d.invoiceDay,preview:p,files:files(rows,target),notes}];
    }else fail('عملیات معتبر نیست.');
   }
  }
 }
 d.history=[...(old?.data.history||[]),{at:now,actor:u.userId,name:u.name,mode:b.mode,notes,previous:old?{...old.data,history:undefined,approvals:undefined}:null}];
 const write=old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(d),now,target,revision):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'purchase_settlement',?,1,?,?)").bind(target,JSON.stringify(d),now,now);
 // Independent inbox tasks; sourcing follow-up projection does not close these tasks.
 if(['submit','return','reopen','approve'].includes(b.mode)){
  stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE template_id=? AND state NOT IN ('completed','cancelled')").bind(now,'purchase-settlement:'+target));
  if(b.mode!=='approve'){const members=(await db.prepare("SELECT id,permissions FROM app_members WHERE status='active'").all()).results as any[];const title=d.state==='submitted'?'بررسی مالی تسویه خرید':'اصلاح پرونده تسویه خرید';
   for(const m of members){const p=JSON.parse(m.permissions),who={isAdmin:false,permissions:p};if(!(d.state==='submitted'?settleFinance(who):settleBuyer(who,d.route)))continue;
    const tid='settlement:'+id+':'+m.id;stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?, ?,NULL,?,'open',?,1,?,?)").bind(tid,'purchase-settlement:'+target,now.slice(0,10)+'#'+String(revision+1),m.id,new Date(Date.parse(now)+48*3600000).toISOString(),JSON.stringify({title:title+' · '+d.supplier+' / '+d.invoiceNumber,sourceSection:d.state==='submitted'?'costing':'sourcing',sourcePlanId:d.planId,settlementId:target,instructions:'فرم تسویه خرید را باز کنید. ثبت پاسخ متنی جای تأیید پرونده را نمی‌گیرد.',history:[],evidence:'text'}),now,now));}
  }
 }
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'settlement_'+b.mode,signature,u.userId,now),...guards,write,...stmts,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'settlement_'+b.mode,JSON.stringify(d),now)]);return json({saved:true,id:target});
 }catch(e){return accessResponse(e)||json({error:'ثبت انجام نشد؛ نتیجه را بررسی و اطلاعات را تازه‌سازی کنید.'},409);}}
