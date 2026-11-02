'use client';
import type {ReceiptPurchase} from '@/lib/receipt-purchases';
const quantity=(v:number)=>(v/1000).toLocaleString('fa-IR',{maximumFractionDigits:3});
export function ReceiptPurchaseOrders({orders,value,onChange}:{orders:ReceiptPurchase[];value:string;onChange:(id:string)=>void}){
 if(!orders.length)return <p className="subtle wide">سفارش خرید بازی برای این کالا ثبت نشده است.</p>;
 return <section className="receipt-purchases wide" aria-label="سفارش‌های خرید باز همین کالا">
  <div className="receipt-purchases__heading"><strong>سفارش‌های خرید باز این کالا</strong><span>{orders.length===1&&value===orders[0].id?'سفارش زیر پیش‌انتخاب شده؛ مشخصات محموله را بررسی کنید.':'سفارش مربوط به این محموله را انتخاب کنید.'}</span></div>
  <div className="receipt-purchases__scroll"><table><thead><tr><th scope="col"><span className="sr-only">انتخاب</span></th><th scope="col">سفارش / تأمین‌کننده</th><th scope="col">مقدار سفارش</th><th scope="col">دریافت‌شده</th><th scope="col">باقی‌مانده</th></tr></thead><tbody>{orders.map(o=><tr key={o.id} className={value===o.id?'is-selected':''}>
   <td><input type="radio" name="receipt-purchase-order" aria-label={'انتخاب سفارش '+o.id+' از '+o.supplier} checked={value===o.id} onChange={()=>onChange(o.id)}/></td>
   <td><button type="button" className="receipt-purchases__identity" onClick={()=>onChange(o.id)}><strong>{o.supplier}</strong><bdi dir="ltr">{o.id}</bdi></button></td>
   <td><bdi>{quantity(o.quantity)}</bdi><small>{o.unit}</small></td><td><bdi>{quantity(o.received)}</bdi></td><td><bdi>{quantity(o.remaining)}</bdi></td>
  </tr>)}</tbody></table></div>
  {value&&<button type="button" className="receipt-purchases__clear" onClick={()=>onChange('')}>دریافت بدون اتصال به سفارش خرید</button>}
 </section>;
}
