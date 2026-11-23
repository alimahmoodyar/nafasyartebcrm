'use client';

import {useEffect,useState} from 'react';

type ProductCodes={rows:{id:string;name:string;internalCode:string;accountingCode:string}[];offset:number;nextOffset:number|null;total:number;missing:number};
const route='/api/accounting?view=product-codes';
const number=(n:number)=>n.toLocaleString('fa-IR');

export function AccountingProductCodes(){
 const [offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0);
 const [data,setData]=useState<ProductCodes|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  const request=new AbortController();
  setData(null);setError('');
  void fetch(route+'&offset='+offset,{cache:'no-store',signal:request.signal}).then(async response=>{
   const result=await response.json() as ProductCodes&{error?:string};
   if(!response.ok)throw Error(result.error||'پیش‌نمایش دریافت نشد.');
   if(!request.signal.aborted)setData(result);
  }).catch(e=>{if(!request.signal.aborted)setError(e.message);});
  return()=>request.abort();
 },[offset,refresh]);
 return <section className="panel inside">
  <h3>پیش‌نمایش خروجی کد کالا</h3>
  {error?<p className="notice error" role="alert">{error}</p>:!data?<p role="status">در حال دریافت کدهای کالا…</p>:<>
   {data.missing>0&&<p className="notice">{number(data.missing)} محصول از {number(data.total)} محصول کد حسابداری ندارد. خانهٔ «کد کالا» برای این محصولات در فایل خالی می‌ماند.</p>}
   {data.total===0?<p>محصولی برای خروجی وجود ندارد.</p>:<>
    <table><thead><tr><th>نام محصول</th><th>کد داخلی هم‌نفس</th><th>کد کالا در حسابداری</th></tr></thead>
     <tbody>{data.rows.map(row=><tr key={row.id}><td>{row.name}</td><td><bdi>{row.internalCode}</bdi></td><td>{row.accountingCode?<bdi>{row.accountingCode}</bdi>:<span className="subtle">ثبت نشده</span>}</td></tr>)}</tbody>
    </table>
    <div className="tools">
     <a className="btn primary" href={route+'&format=xlsx'} download>دریافت اکسل کدهای کالا</a>
     <button type="button" className="btn" disabled={data.offset===0} onClick={()=>setOffset(Math.max(0,data.offset-50))}>صفحه قبل</button>
     <button type="button" className="btn" disabled={data.nextOffset===null} onClick={()=>{if(data.nextOffset!==null)setOffset(data.nextOffset);}}>صفحه بعد</button>
    </div>
   </>}
  </>}
  <button type="button" className="btn" disabled={!data&&!error} onClick={()=>setRefresh(n=>n+1)}>تازه‌سازی</button>
 </section>;
}
