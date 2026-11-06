'use client';
import {warehouseTypes} from '@/lib/warehouse-receipt-policy';
export function WarehouseReceiptPolicyFields({draft,warehouses,onChange}:{draft:any;warehouses:any[];onChange:(patch:any)=>void}){
 const type=draft.warehouseType||'other',enabled=type==='storage'&&draft.directReceiptEnabled===true;
 return <><label className="field">نوع انبار<select required value={type} onChange={e=>onChange({warehouseType:e.target.value,...(e.target.value!=='storage'?{directReceiptEnabled:false}:{})})}>{Object.entries(warehouseTypes).map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></label>
 <label className="flow-check"><input type="checkbox" disabled={type!=='storage'} checked={enabled} onChange={e=>onChange({directReceiptEnabled:e.target.checked})}/>اجازه دریافت مستقیم مواد اولیه از خرید دارد</label>
 {enabled&&<><label className="field">قرنطینه ورودی<select value={draft.quarantineWarehouseId||''} onChange={e=>onChange({quarantineWarehouseId:e.target.value})}><option value="">ساخت خودکار قرنطینه زیر این انبار</option>{warehouses.filter(w=>w.data.active&&w.data.parentId===draft.warehouseId&&w.data.warehouseType==='quarantine').map(w=><option key={w.id} value={w.id}>{w.data.name}</option>)}</select></label><p className="notice wide">هر محموله ابتدا به این قرنطینه و کارتابل کنترل کیفیت می‌رود. موجودی فقط پس از کنترل کیفیت و تأیید جانمایی قابل استفاده می‌شود.</p></>}
 {type==='production_line'&&<p className="notice wide">خط تولید فقط مواد تأییدشده را با حواله داخلی دریافت می‌کند؛ ورود مستقیم خرید مجاز نیست.</p>}</>;
}
export function ReceiptWarehouseFields({warehouses,value,qcOwner='',onChange,onQcChange}:{warehouses:any[];value:string;qcOwner?:string|string[];onChange:(id:string)=>void;onQcChange:(id:any)=>void}){
 const w=warehouses.find(w=>w.id===value),members=w?.receiptQcMembers||[];
 return <><label className="field">انبار دریافت<select required value={value||''} onChange={e=>onChange(e.target.value)}><option value="">انتخاب انبار دریافت</option>{warehouses.filter(w=>w.canReceive&&w.data.active).map(w=><option key={w.id} value={w.id}>{w.data.name}</option>)}</select></label>
 {w&&<p className="notice wide" role="status">محل ورود خودکار: {w.receiptQuarantine?.name||'قرنطینه تعریف نشده است'}؛ سپس کنترل کیفیت ورودی.</p>}
 {members.length>1?<fieldset className="wide"><legend>مسئولان کنترل کیفیت این محموله</legend><p>بدون انتخاب، برای همه افراد مجاز ارسال می‌شود؛ تأیید یک نفر کافی است.</p>{members.map((m:any)=>{const ids=Array.isArray(qcOwner)?qcOwner:qcOwner?[qcOwner]:[];return <label key={m.id} className="flow-check"><input type="checkbox" checked={ids.includes(m.id)} onChange={e=>onQcChange(e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id))}/>{m.name}</label>})}</fieldset>:w&&<p className="subtle wide">{members.length===1?'ارجاع خودکار کنترل کیفیت به '+members[0].name:'محموله تا تعیین مسئول و انجام کنترل کیفیت در قرنطینه می‌ماند.'}</p>}
 {!warehouses.some(w=>w.canReceive&&w.data.active)&&<p className="notice error wide" role="alert">انبار دریافت مجاز و دارای قرنطینه در دسترسی شما نیست؛ مدیر باید قانون دریافت و مسئولیت انبار را تکمیل کند.</p>}</>;
}
