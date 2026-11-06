/** Presentation-only projection of already-authorized receipts. Stored lots are history;
 * rejected lots still in quarantine remain open until a separate disposition finishes. */
export const receiptStates:Record<string,string>={awaiting_qc_template:'در قرنطینه؛ منتظر تعریف فرم کنترل کیفیت توسط مسئول فنی',pending_qc:'در قرنطینه؛ منتظر کنترل کیفیت',awaiting_relabel:'تأیید کیفیت؛ منتظر تعویض لیبل صحیح',awaiting_warehouse:'تأیید کیفیت؛ آماده جانمایی',stored:'جانمایی‌شده',rejected:'مردود در قرنطینه'};
export function receiptClosed(r:any){return r.data.state==='stored';}
export function receiptSearchText(v:any){return String(v??'').normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).toLocaleLowerCase().trim();}
export function receiptList(entities:any[],rows:any[],options:{view?:string;q?:string;state?:string;page?:number;size?:number}={}){
 const receipts=entities.filter(e=>e.type==='receipt'),history=options.view==='history',query=receiptSearchText(options.q),byId=new Map(rows.map(r=>[r.id,r.data])),materials=new Map(entities.filter(e=>e.type==='material').map(e=>[e.id,e.data]));
 const found=receipts.filter(r=>receiptClosed(r)===history&&(!options.state||r.data.state===options.state)&&(!query||query.split(/\s+/).every(term=>receiptSearchText([r.id,byId.get(r.id)?.code,byId.get(r.id)?.partCode,byId.get(r.id)?.part,materials.get(r.data.materialId)?.name,materials.get(r.data.materialId)?.code,r.data.day,r.data.receivedBy].join(' ')).includes(term))));
 const size=Math.max(1,Math.min(100,Math.trunc(options.size||20))),pages=Math.max(1,Math.ceil(found.length/size)),page=Math.min(pages,Math.max(1,Math.trunc(options.page||1)));
 return {items:found.slice((page-1)*size,page*size),total:found.length,page,pages,openCount:receipts.filter(r=>!receiptClosed(r)).length,historyCount:receipts.filter(receiptClosed).length};
}
