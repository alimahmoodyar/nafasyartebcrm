import {AccessError} from './authorization';
import {storage} from './storage';
import {receiptObservationAccess,receiptNoteRole,prepareReceiptObservation} from './receipt-observations';
import {supplyLock,allocatePurchaseReceipt,holdChecks} from './sourcing';

function error(message:string,status=400):never{throw new AccessError(message,status)}
export async function completionContext(u:any,id:string){
 const note=await receiptObservationAccess(u,id),d=note.data;
 if(d.automatic?.kind!=='unlinked_purchase')error('این پرونده مربوط به تکمیل خرید بدون سفارش نیست.');
 if(!receiptNoteRole(u,'supply',d.route))error('تعیین تکلیف با مسئول تأمین مسیر این کالا است.',403);
 const db=storage(),r:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='receipt'").bind(d.receiptId).first();if(!r)error('رسید پیدا نشد.',404);
 return {note,receipt:{...r,data:JSON.parse(r.data)}};
}
export async function completionOrders(u:any,id:string){
 const {note,receipt}=await completionContext(u,id),rows=(await storage().prepare("SELECT * FROM flow_entities WHERE type='purchase_order' AND json_extract(data,'$.materialId')=? ORDER BY created DESC,id").bind(receipt.data.materialId).all()).results;
 return rows.map((r:any)=>({...r,data:JSON.parse(r.data)})).filter((r:any)=>['issued','paid','preparing','shipped','received','completed'].includes(r.data.state)&&['domestic','foreign'].includes(r.data.route)&&r.data.supplier&&Number.isSafeInteger(r.data.quantity)&&r.data.quantity>0&&(!note.data.route||note.data.route===r.data.route)&&receiptNoteRole(u,'supply',r.data.route)).map((r:any)=>({id:r.id,revision:r.revision,supplier:r.data.supplier,quantity:r.data.quantity,unit:r.data.unit,route:r.data.route,reference:r.data.fundingReference||r.data.quoteSnapshot?.reference||'',quoteId:r.data.quoteId||''}));
}
/** One transaction: attach the original receipt, reassign existing supply coverage, close every recipient copy. No stock movement. */
export async function completeReceiptPurchase(u:any,b:any){
 if(b.confirmed!==true||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.id)||typeof b.body!=='string'||!b.body.trim()||b.body.length>4000)error('توضیح تعیین تکلیف و تأیید لازم است.');
 const db=storage(),signature=JSON.stringify(b),old:any=await db.prepare('SELECT payload,actor FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(old){if(old.actor!==u.userId||old.payload!==signature)error('شناسه عملیات تکراری متفاوت است.',409);return {saved:true,repeated:true};}
 const {note,receipt}=await completionContext(u,b.observationId),d=note.data,r=receipt.data;
 if(note.revision!==b.revision||d.state!=='open'||r.purchaseOrderId)error('پرونده قبلاً تعیین تکلیف شده یا تغییر کرده است؛ تازه‌سازی کنید.',409);
 const choices=await completionOrders(u,b.observationId),choice=choices.find((o:any)=>o.id===b.purchaseOrderId&&o.revision===b.purchaseOrderRevision);if(!choice)error('خرید صادرشده و مرتبط با کالا و مسیر مجاز خود را انتخاب کنید.',409);
 const order:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='purchase_order'").bind(choice.id).first(),od=JSON.parse(order.data),batch:any=await db.prepare("SELECT * FROM records WHERE id=? AND kind='batch'").bind(receipt.id).first();if(!batch)error('بچ پیدا نشد.',404);
 if(order.revision!==choice.revision||od.unit!==JSON.parse(batch.payload).unit)error('خرید تغییر کرده یا واحد آن با بچ منطبق نیست.',409);
 const now=new Date().toISOString(),resolution={observationId:note.id,purchaseOrderId:choice.id,route:choice.route,supplier:choice.supplier,purchasedQuantity:choice.quantity,unit:choice.unit,quoteId:choice.quoteId,reference:choice.reference,notes:b.body.trim(),actor:u.userId,by:u.name,at:now};
 const stmts=[...await supplyLock(db,b.id)];
 const arrivals=(await db.prepare("SELECT data FROM flow_entities WHERE type='receipt' AND json_extract(data,'$.purchaseOrderId')=?").bind(choice.id).all()).results.reduce((n:number,row:any)=>n+JSON.parse(row.data).quantity,0),remaining=Math.max(0,od.quantity-arrivals);
 const rd={...r,purchaseOrderId:choice.id,purchaseCompletion:resolution,receiptComparison:{basis:'order_remaining',expected:remaining,actual:r.quantity,difference:r.quantity-remaining,purchaseOrderId:choice.id,shipmentQuantityKnown:false}},nd={...d,state:'resolved',resolution,responses:[...d.responses,{body:b.body.trim(),actor:u.userId,name:u.name,at:now}],history:[...d.history,{action:'purchase_completed',...resolution}]};
 if(remaining!==r.quantity){const review=await prepareReceiptObservation(u,{id:b.id},receipt.id,r.warehouseId,d.materialName,choice.route,{kind:'quantity_review',...rd.receiptComparison,message:'ارتباط خرید مشخص شد؛ تفاوت دریافت واقعی با مانده سفارش همچنان نیازمند بررسی تأمین است و به معنی کسری قطعی محموله نیست.'});rd.quantityObservationId=review.id;stmts.push(...review.statements);}
 for(const [id,revision] of [[note.id,note.revision],[receipt.id,receipt.revision],[order.id,order.revision]])stmts.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(id,revision,b.id));
 stmts.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?) THEN guard ELSE 0 END WHERE id=?').bind(batch.id,batch.payload,b.id));
 const inspected=['stored','awaiting_warehouse','rejected'].includes(r.state);
 let cover=inspected?r.accepted:r.quantity;
 if(r.state==='stored'){const stock:any=await db.prepare("SELECT COALESCE(SUM(quantity),0) n FROM inventory_balances WHERE item_id=? AND warehouse IN ('raw','line','transit')").bind(receipt.id).first(),held:any=await db.prepare("SELECT COALESCE(SUM(quantity),0) n FROM sourcing_holds WHERE source_type='stock' AND source_id=?").bind(receipt.id).first();cover=Math.min(cover,Math.max(0,stock.n-held.n));}
 stmts.push(...await allocatePurchaseReceipt(choice.id,receipt.id,cover,r.state==='stored'?'stock':'receipt'));
 for(const [id,data,revision] of [[note.id,nd,note.revision],[receipt.id,rd,receipt.revision],[order.id,{...od,lastReceiptAt:now},order.revision]] as any[])stmts.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,id,revision));
 stmts.push(db.prepare('UPDATE records SET payload=? WHERE id=? AND payload=?').bind(JSON.stringify({...JSON.parse(batch.payload),supplier:choice.supplier}),batch.id,batch.payload));
 const threads=(await db.prepare("SELECT * FROM flow_entities WHERE type='inbox_thread' AND json_extract(data,'$.receiptObservationId')=?").bind(note.id).all()).results;
 const result=(choice.route==='domestic'?'خرید داخلی':'خرید خارجی')+' بود و توسط '+u.name+' تعیین تکلیف شد.';
 for(const t of threads as any[]){stmts.push(db.prepare("UPDATE flow_entities SET data=json_set(data,'$.state','completed','$.resolution',?),revision=revision+1,updated=? WHERE id=?").bind(result,now,t.id),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'inbox_message',?,1,?,?)").bind('receipt-completed:'+b.id+':'+t.id,JSON.stringify({thread:t.id,body:result,mode:'message',author:u.userId,authorName:u.name}),now,now));}
 await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'receipt_purchase_completion',?,?,?,1)").bind(b.id,signature,u.userId,now),...stmts,...holdChecks(db,b.id,[receipt.id]),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,receipt.id,'receipt_purchase_completion',JSON.stringify(resolution),now)]);
 return {saved:true,receiptId:receipt.id,resolution};
}
