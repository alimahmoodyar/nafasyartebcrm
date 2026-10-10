import {storage} from './storage';
import {trainingContext} from './training-context';
import {dayAt,notice} from './duties';
import {apBuyer,apFinance} from './purchase-payables';
import {invoiceFollowups} from './purchase-invoice';
export async function syncPurchaseInvoiceTasks(today=dayAt()){
 if(trainingContext.getStore())return;const db=storage(),now=new Date().toISOString();
 const rows=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('purchase_payable','payable_file') ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const members=(await db.prepare('SELECT id,status,permissions FROM app_members ORDER BY id').all()).results as any[];
 const old=(await db.prepare("SELECT * FROM duty_runs WHERE template_id='purchase-invoice-document'").all()).results as any[],wanted=new Map<string,any>();
 for(const c of rows.filter(r=>r.type==='purchase_payable'))for(const item of invoiceFollowups(c,rows,today))for(const role of ['buyer','finance']){
 const eligible=members.filter(m=>m.status==='active').filter(m=>{const u={isAdmin:false,permissions:JSON.parse(m.permissions)};return role==='finance'?apFinance(u):apBuyer(u,c.data.route)}).map(m=>m.id);
 for(const mid of eligible.length?eligible:['@admin']){const id='purchase-invoice-document:'+c.id+':'+item.key+':'+role+':'+mid;wanted.set(id,{item,role,mid,missingOwner:!eligible.length});}}
 const writes:D1PreparedStatement[]=[];
 for(const [id,{item,role,mid,missingOwner}] of wanted){const existing=old.find(t=>t.id===id);if(existing&&['open','blocked','submitted'].includes(existing.state))continue;
 const data={...(existing?JSON.parse(existing.data):{}),purchaseInvoiceWorkflow:true,caseId:item.caseId,route:item.route,workflowRole:role,sourceSection:'sourcing',sourceId:item.caseId,title:item.title+' · '+item.supplier,instructions:'هفت روز از پرداخت گذشته است. فایل واقعی فاکتور را بارگذاری و به همان فاکتور متصل کنید؛ پرداخت تخصیص‌نیافته را به فاکتور صحیح متصل کنید. پاسخ متنی یا بستن دستی وظیفه جای سند را نمی‌گیرد.',positionName:role==='buyer'?'تدارکات / بازرگانی خرید':'مالی خرید',evidence:'file',remindHours:24,escalateHours:48,missingOwner,history:existing?JSON.parse(existing.data).history||[]:[]};
 writes.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,'purchase-invoice-document',?,?,'@admin',?,'open',?,1,?,?) ON CONFLICT(id) DO UPDATE SET state='open',due=excluded.due,data=excluded.data,revision=duty_runs.revision+1,updated=excluded.updated").bind(id,item.key,mid,item.due+'T00:00:00+03:30',JSON.stringify(data),now,now));
 writes.push(notice(id,mid,'invoice-document-missing',data.title+(missingOwner?'؛ نقش مسئول هنوز تعیین نشده است.':''),now));}
 for(const t of old.filter(t=>!wanted.has(t.id)&&['open','blocked','submitted'].includes(t.state))){const d=JSON.parse(t.data),stillNeeded=[...wanted.values()].some(w=>w.item.caseId===d.caseId&&w.item.key===t.period);writes.push(db.prepare("UPDATE duty_runs SET state=?,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(stillNeeded?'cancelled':'completed',now,t.id,t.revision));}
 if(!writes.length)return;
 const op=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'invoice_followup','{}','scheduler',?,1)").bind(op,now),
 db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'revision',revision)) FROM (SELECT id,revision FROM flow_entities WHERE type IN ('purchase_payable','payable_file') ORDER BY id))=? AND (SELECT json_group_array(json_object('id',id,'status',status,'permissions',permissions)) FROM (SELECT id,status,permissions FROM app_members ORDER BY id))=? THEN guard ELSE 0 END WHERE id=?").bind(JSON.stringify(rows.map(r=>({id:r.id,revision:r.revision}))),JSON.stringify(members),op),...writes]);
}
