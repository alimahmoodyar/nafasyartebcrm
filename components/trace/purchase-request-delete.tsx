"use client";
import {useRef,useState} from 'react';
import {Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
type Eligibility={allowed:boolean;reason:string;quoteCount:number;orderCount:number};
export function PurchaseRequestDelete({planId,revision,title,deletion,onDeleted}:{planId:string;revision:number;title:string;deletion?:Eligibility|null;onDeleted:()=>void|Promise<void>}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const operation=useRef<{signature:string;id:string}|null>(null),inFlight=useRef(false);
 if(!deletion)return null;
 if(!deletion.allowed)return <p className="subtle">حذف درخواست: {deletion.reason}</p>;
 async function remove(){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');const signature=JSON.stringify({planId,revision});if(operation.current?.signature!==signature)operation.current={signature,id:crypto.randomUUID()};try{
  const response=await fetch('/api/sourcing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:operation.current.id,mode:'delete_request',planId,revision,confirmed:true})}),result=await response.json() as any;
  if(!response.ok)throw Error(result.error||'حذف انجام نشد.');
  setOpen(false);operation.current=null;window.dispatchEvent(new Event('nafasyar-tasks-changed'));await onDeleted();
 }catch(e){setError(e instanceof Error?e.message:'حذف انجام نشد.')}finally{setBusy(false);inFlight.current=false}}
 return <><button data-pair-open="purchase-request-delete:75089c4d0c82" type="button" className="btn" onClick={()=>{setError('');setOpen(true)}}><Trash2 size={16} aria-hidden="true"/>حذف درخواست خرید</button><Dialog open={open} onOpenChange={value=>{if(!inFlight.current)setOpen(value)}}><DialogContent className="modal sm:max-w-lg"><DialogTitle>حذف درخواست خرید</DialogTitle><DialogDescription>«{title}» حذف شود؟ این کار قابل بازگشت نیست.</DialogDescription><p>درخواست، {deletion.quoteCount.toLocaleString('fa-IR')} استعلام و {deletion.orderCount.toLocaleString('fa-IR')} سفارشِ تأییدنشدهٔ مرتبط حذف می‌شوند و کارهای باز از کارتابل خارج می‌شوند. سابقهٔ حذف برای رهگیری محفوظ می‌ماند.</p><p className="subtle">حذف فقط پیش از تأیید وجه و صدور خرید توسط مالی مجاز است؛ وضعیت هنگام تأیید دوباره بررسی می‌شود.</p>{error&&<p className="notice error" role="alert">{error}</p>}<div className="tools"><button data-pair-open="purchase-request-delete:9015d5a5e5b7" type="button" className="btn" disabled={busy} onClick={()=>setOpen(false)}>انصراف</button><button type="button" className="btn primary" disabled={busy} onClick={()=>void remove()}>{busy?'در حال حذف…':'تأیید حذف درخواست'}</button></div></DialogContent></Dialog></>;
}
