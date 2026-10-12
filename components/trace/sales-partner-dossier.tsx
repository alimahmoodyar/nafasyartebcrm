'use client';
import {PhoneCall,MessagesSquare,Settings2,FileText} from 'lucide-react';
import {formatDate} from '@/lib/persian-date';
import {partnerKinds} from '@/lib/sales-network-contract';

const cash=(value:any)=>BigInt(value||0).toLocaleString('fa-IR')+' ریال';
const states:Record<string,string>={pending:'در انتظار بررسی',approved:'تأییدشده',rejected:'ردشده',paid:'پرداخت‌شده',cancelled:'لغوشده',open:'باز',closed:'بسته'};
const recordNames:Record<string,string>={sales_contact:'تماس / بازدید',sales_case:'درخواست همکاری',sales_contract:'قرارداد پورسانت',sales_commission_settlement:'تسویه پورسانت'};
const channels:Record<string,string>={call:'تماس',visit:'بازدید',meeting:'جلسه',message:'پیام'};

export function SalesPartnerDossier({agent:a,portfolio:p,records,roles,onBegin,modeNames}:{agent:any;portfolio:any;records:any[];roles:any;onBegin:(mode:string,agent:any,record?:any)=>void;modeNames:Record<string,string>}){
 const scope='sales-partner-'+a.id,kind=partnerKinds[a.data.kind as keyof typeof partnerKinds]||partnerKinds.representative;
 if(!p?.account)return <article className="sales-partner-card" aria-labelledby={scope+'-name'}><h3 id={scope+'-name'}>{a.data.name}</h3><p role="alert">گزارش حساب این پرونده دریافت نشده است؛ گزارش را تازه‌سازی کنید.</p></article>;
 const ac=p.account,referrer=a.data.kind==='referrer',bounced=ac.payments.filter((row:any)=>row.data.state==='bounced');
 const metrics=referrer?[['پورسانت وصول‌شده',p.commission.earned],['پورسانت پرداخت‌شده',p.commission.paid],['در انتظار تسویه',p.commission.reserved],['قابل درخواست',p.commission.available]]:[['مانده حساب',ac.balance],['بدهی خریدها',ac.debt],['وجه تخصیص‌نیافته',ac.credit],['بدهی سررسیدگذشته',ac.overdue]];
 return <article className="sales-partner-card" aria-labelledby={scope+'-name'}>
  <header className="sales-partner-heading">
   <div><h3 id={scope+'-name'}>{a.data.name}</h3><p className="subtle">پرونده پیگیری {kind}</p></div>
   <span className={'badge '+(a.data.active?'good':'warn')}>{a.data.active?'فعال':'غیرفعال'}</span>
  </header>
  {(a.data.contact||a.data.mobile||a.data.phone||a.data.address)&&<dl className="sales-partner-identity">
   {a.data.contact&&<div><dt>مسئول تماس</dt><dd>{a.data.contact}</dd></div>}
   {a.data.mobile&&<div><dt>شماره موبایل</dt><dd><bdi>{a.data.mobile}</bdi></dd></div>}
   {a.data.phone&&<div><dt>شماره ثابت</dt><dd><bdi>{a.data.phone}</bdi></dd></div>}
   {a.data.address&&<div className="sales-partner-address"><dt>نشانی</dt><dd>{a.data.address}</dd></div>}
  </dl>}
  <section className="sales-partner-section" aria-labelledby={scope+'-followup'}>
   <h4 id={scope+'-followup'}>پیگیری و تماس</h4>
   <dl className="sales-partner-dates">
    <div><dt>آخرین خرید</dt><dd>{p.lastPurchase?formatDate(p.lastPurchase):'هنوز خریدی ثبت نشده است.'}</dd></div>
    <div><dt>آخرین تماس</dt><dd>{p.lastContact?formatDate(p.lastContact):'هنوز تماسی ثبت نشده است.'}</dd></div>
    <div><dt>موعد تماس بعدی</dt><dd>{p.nextContact?formatDate(p.nextContact):'موعدی تعیین نشده است.'}</dd></div>
   </dl>
   {a.data.active&&(p.contactLate||p.inactive&&!referrer||BigInt(ac.overdue)>0)&&<ul className="sales-partner-alerts" aria-label="موارد نیازمند پیگیری">
    {p.contactLate&&<li>موعد تماس رسیده است.</li>}
    {p.inactive&&!referrer&&<li>موعد خرید مجدد گذشته است.</li>}
    {BigInt(ac.overdue)>0&&<li>این پرونده بدهی سررسیدگذشته دارد.</li>}
   </ul>}
   <div className="tools sales-partner-actions">
    {roles.staff&&<button type="button" className="btn" onClick={()=>onBegin('contact',a)}><PhoneCall size={18} aria-hidden="true"/>ثبت تماس یا بازدید</button>}
    {(roles.staff||roles.agent||roles.finance)&&<button type="button" className="btn" onClick={()=>onBegin('case',a)}><MessagesSquare size={18} aria-hidden="true"/>درخواست همکاری یا پشتیبانی</button>}
    {roles.manager&&<button type="button" className="btn" onClick={()=>onBegin('partner',a)}><Settings2 size={18} aria-hidden="true"/>تنظیم برنامه پیگیری</button>}
    {roles.manager&&referrer&&<button type="button" className="btn" onClick={()=>onBegin('contract',a)}><FileText size={18} aria-hidden="true"/>قرارداد پورسانت</button>}
   </div>
  </section>
  <section className="sales-partner-section" aria-labelledby={scope+'-account'}>
   <h4 id={scope+'-account'}>حساب و خریدها</h4>
   <dl className="sales-partner-metrics">{metrics.map(([label,amount])=><div key={label}><dt>{label}</dt><dd><bdi>{cash(amount)}</bdi></dd></div>)}</dl>
   {referrer?<>
    <p className="subtle">حساب این عامل بر اساس پورسانت فروش‌های معرفی‌شده محاسبه می‌شود.</p>
    {BigInt(p.commission.available)<0&&<p className="sales-partner-alerts" role="alert">به علت برگشت فروش یا وصول، مانده پورسانت نیاز به تعدیل دارد؛ پرداخت جدید متوقف است.</p>}
    {(roles.staff||roles.finance||roles.agent)&&<button type="button" className="btn" onClick={()=>onBegin('commission_settlement',a)}>درخواست تسویه پورسانت</button>}
    {p.commission.invoices.length?<div className="sales-table sales-partner-table" role="region" aria-label={'پورسانت فروش‌های '+a.data.name} tabIndex={0}><table><caption>پورسانت فروش‌های معرفی‌شده</caption><thead><tr><th>فاکتور</th><th>وصول خالص</th><th>نرخ</th><th>پورسانت</th></tr></thead><tbody>{p.commission.invoices.map((i:any)=><tr key={i.invoiceId}><td>{i.reference}</td><td>{cash(i.collected)}</td><td>{i.bps/100}٪</td><td>{cash(i.earned)}</td></tr>)}</tbody></table></div>:<p className="sales-partner-empty">هنوز فروش معرفی‌شده‌ای برای محاسبه پورسانت ثبت نشده است.</p>}
   </>:<>
    {ac.invoices.length?<div className="sales-table sales-partner-table" role="region" aria-label={'خریدها و تسویه‌های '+a.data.name} tabIndex={0}><table><caption>تسویه هر خرید و زمان باقیمانده</caption><thead><tr><th>خرید</th><th>مانده</th><th>وضعیت تسویه</th><th>سررسید اقساط باز</th></tr></thead><tbody>{ac.invoices.map((i:any)=>{
     const amount=BigInt(i.data.amount),paid=amount-BigInt(i.remaining),pct=amount>0?Number(paid*BigInt(10000)/amount)/100:0,open=i.installments.filter((v:any)=>BigInt(v.remaining)>0);
     return <tr key={i.id}><td>{i.data.reference}<br/>{formatDate(i.data.day)}</td><td>{cash(i.remaining)}</td><td><progress aria-label={'تسویه '+i.data.reference} max="100" value={pct}/><br/>{pct}٪</td><td>{open.length?open.map((v:any)=><p key={v.id}>{cash(v.remaining)} · {formatDate(v.due)} · {v.days<0?(-v.days)+' روز تأخیر':v.days+' روز باقی‌مانده'}</p>):'قسط بازی ندارد.'}</td></tr>;
    })}</tbody></table></div>:<p className="sales-partner-empty">هنوز خریدی برای این پرونده ثبت نشده است.</p>}
    {BigInt(ac.debt)>0?<div><h5>وضعیت سررسید بدهی‌ها</h5><p className="subtle">بدهی‌های باز از سررسیدنشده تا بیش از ۹۰ روز تأخیر دسته‌بندی شده‌اند.</p><div className="sales-partner-aging">{ac.aging.map((v:any)=><div key={v.label}><span>{v.label}</span><meter aria-label={v.label} min="0" max="100" value={Number(BigInt(v.amount)*BigInt(100)/BigInt(ac.debt))}/><bdi>{cash(v.amount)}</bdi></div>)}</div></div>:<p className="subtle">این پرونده بدهی بازی ندارد.</p>}
   </>}
   {bounced.length>0&&<div className="sales-partner-alerts"><h5>چک‌های برگشتی</h5><p>مبلغ چک برگشتی در مانده خرید لحاظ شده و دوباره به بدهی اضافه نمی‌شود.</p>{bounced.map((row:any)=><div key={row.id}><p>{row.data.reference} · مبلغ چک {cash(row.data.amount)}</p>{!row.data.checkInvoiceId&&!ac.allocations.some((link:any)=>link.data.creditId===row.id)&&<><p>خرید مرتبط مشخص نیست؛ اولویت وجه نقد خرید جدید متوقف است.</p>{roles.finance&&<button type="button" className="btn" onClick={()=>onBegin('check_link',a,row)}>اتصال به خرید</button>}</>}</div>)}</div>}
  </section>
  <section className="sales-partner-section" aria-labelledby={scope+'-history'}>
   <h4 id={scope+'-history'}>سوابق اقدامات ({records.length.toLocaleString('fa-IR')})</h4>
   {records.length?<div className="sales-partner-history">{[...records].reverse().map((r:any)=><article className="sales-partner-record" key={r.id}>
    <header><h5>{r.data.title||r.data.reference||recordNames[r.type]||modeNames[r.type.replace('sales_','')]||'اقدام ثبت‌شده'}</h5>{states[r.data.state]&&<span className="badge">{states[r.data.state]}</span>}</header>
    {r.created&&<p className="subtle">تاریخ ثبت: <time dateTime={r.created}>{formatDate(r.created)}</time>{r.type==='sales_contact'&&channels[r.data.channel]?' · '+channels[r.data.channel]:''}</p>}
    {r.data.notes&&<p className="sales-partner-notes">{r.data.notes}</p>}
    {r.data.nextDue&&<p>موعد پیگیری: {formatDate(r.data.nextDue)}{r.data.nextAction?' · '+r.data.nextAction:''}</p>}
    {r.data.amount&&<p>مبلغ: {cash(r.data.amount)}</p>}
    {r.type==='sales_contract'&&<p>پورسانت: {r.data.bps/100}٪ · {formatDate(r.data.start)} تا {formatDate(r.data.end)}</p>}
    <div className="tools sales-partner-actions">
     {roles.staff&&r.type==='sales_case'&&<button type="button" className="btn" onClick={()=>onBegin('case_update',a,r)}>پیگیری درخواست</button>}
     {roles.finance&&r.type==='sales_contract'&&r.data.state==='pending'&&<button type="button" className="btn" onClick={()=>onBegin('contract_review',a,r)}>بررسی قرارداد</button>}
     {roles.finance&&r.type==='sales_commission_settlement'&&r.data.state==='pending'&&<button type="button" className="btn" onClick={()=>onBegin('commission_review',a,r)}>بررسی تسویه</button>}
     {roles.finance&&r.type==='sales_commission_settlement'&&['pending','approved'].includes(r.data.state)&&<button type="button" className="btn" onClick={()=>onBegin('commission_cancel',a,r)}>لغو با دلیل</button>}
     {roles.finance&&r.type==='sales_commission_settlement'&&r.data.state==='approved'&&<button type="button" className="btn" onClick={()=>onBegin('commission_pay',a,r)}>ثبت پرداخت</button>}
    </div>
    {r.data.history?.length>0&&<details><summary>سابقه اقدامات این درخواست</summary>{r.data.history.map((h:any,i:number)=><p className="sales-partner-notes" key={i}>{formatDate(h.at)} · {modeNames[h.mode]||'اقدام ثبت‌شده'} · {h.notes}</p>)}</details>}
   </article>)}</div>:<p className="sales-partner-empty">هنوز تماس، درخواست همکاری، قرارداد یا تسویه‌ای ثبت نشده است.</p>}
  </section>
 </article>;
}
