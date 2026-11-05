'use client';
import {transportMethods,freightStatuses} from '@/lib/domestic-freight-contract';
import {NumberInput} from './number-input';
import {SolarDate} from './solar-date';
import {Select,SelectTrigger,SelectContent,SelectItem,SelectValue} from '@/components/ui/select';

type Props={draft:any;line:any;choices:any[];busy:boolean;notice:string;onPatch:(patch:any)=>void;onNewSupplier:()=>void;onSync:()=>void;onUpload:(files:FileList|null)=>void;onRemove:(file:any)=>void};
export function SourcingQuoteFields({draft:d,line,choices,busy,notice,onPatch,onNewSupplier,onSync,onUpload,onRemove}:Props){
 const kind=d.procurementStatus||(d.unavailable?'unavailable':'price'),foreign=d.route==='foreign';
 const pick=(label:string,value:string,items:[string,string][],onChange:(v:string)=>void)=><label className="field">{label}<Select dir="rtl" required value={value||'none'} onValueChange={v=>onChange(v==='none'?'':v)}><SelectTrigger><SelectValue placeholder="انتخاب کنید"/></SelectTrigger><SelectContent><SelectItem value="none">انتخاب کنید</SelectItem>{items.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select></label>;
 const input=(key:string,label:string,required=true)=><label className="field">{label}<NumberInput fieldKey={key} groupNumber={['unitPrice','extrasRial','fxRate','freightAmount'].includes(key)} required={required} value={d[key]??''} onChange={e=>onPatch({[key]:e.target.value})}/></label>;
 const note=(key:string,label:string,required=false)=><label className="field">{label}<textarea rows={2} required={required} value={d[key]||''} onChange={e=>onPatch({[key]:e.target.value})}/></label>;
 const setKind=(next:string)=>onPatch({unavailable:next==='unavailable',procurementStatus:['searching','technical'].includes(next)?next:''});
 return <section className="sourcing-quote-form" aria-label="اطلاعات استعلام">
  <div className="sourcing-quote-summary"><strong>{line?.name}</strong><span>کد {d.partCode} · {((line?.shortage||0)/1000).toLocaleString('fa-IR')} {line?.unit}</span></div>
  {!d.procurementStatus&&<>
   {choices.length?pick('تأمین‌کننده این استعلام',d.supplierLinkId||'',choices.map(t=>[t.linkId,t.name]),v=>{const t=choices.find(t=>t.linkId===v);onPatch({supplierLinkId:v,supplier:t?.name||''})}):<p className="notice error">منبع بدون پاسخ ندارید؛ تأمین‌کننده دیگری اضافه کنید یا پاسخ قبلی را از جدول ویرایش کنید.</p>}
   <details className="sourcing-quote-disclosure"><summary>افزودن یا تازه‌سازی تأمین‌کننده</summary><div className="sourcing-quote-supplier-tools"><button type="button" className="btn" disabled={busy||!line?.materialId} onClick={onNewSupplier}>تأمین‌کننده جدید برای این کالا</button><button type="button" className="btn" disabled={busy} onClick={onSync}>به‌روزرسانی تأمین‌کنندگان این کالا</button></div></details>
  </>}
  {notice&&<p className="sourcing-quote-status" role="status">{notice}</p>}
  {kind==='price'&&<>
   <div className="sourcing-quote-grid" data-quote-core>
    {input('unitPrice',foreign?'قیمت واحد در ارز پیشنهاد':'قیمت واحد (ریال)')}
    {input('paymentTerms','شرایط پرداخت')}
    <SolarDate label="موعد تحویل" value={d.eta} onChange={eta=>onPatch({eta})}/>
    <SolarDate label="اعتبار قیمت تا" value={d.validUntil} onChange={validUntil=>onPatch({validUntil})}/>
   </div>
   {foreign&&<div className="sourcing-quote-grid">{pick('ارز قیمت',d.currency,[['IRR','ریال'],['IRT','تومان'],['USD','دلار'],['CNY','یوان'],['EUR','یورو']],currency=>onPatch({currency,...(currency==='IRR'?{fxRate:'1'}:currency==='IRT'?{fxRate:'10'}:{})}))}{input('fxRate','هر واحد ارز چند ریال؟')}<SolarDate label="تاریخ نرخ تبدیل" value={d.fxDate} onChange={fxDate=>onPatch({fxDate})}/>{input('fxSource','منبع نرخ تبدیل')}</div>}
   {!foreign&&<div className="sourcing-quote-grid">{pick('روش حمل',d.transportMethod||'',Object.entries(transportMethods),transportMethod=>onPatch({transportMethod}))}{pick('وضعیت هزینه حمل',d.freightStatus||'',Object.entries(freightStatuses),freightStatus=>onPatch({freightStatus}))}{d.freightStatus==='known'&&input('freightAmount','مبلغ حمل همین مقدار (ریال)')}<p>حمل نامشخص صفر قطعی نیست؛ هزینه واقعی بعداً در تسویه همین خرید ثبت می‌شود.</p></div>}
   <details className="sourcing-quote-disclosure"><summary>جزئیات بیشتر{Number(d.extrasRial)>0?' · هزینه جانبی '+Number(d.extrasRial).toLocaleString('fa-IR')+' ریال':''}</summary><div className="sourcing-quote-grid">
    {foreign&&<>{input('extrasRial','جمع هزینه جانبی (ریال)')}{note('costNotes','شرح هزینه جانبی',Number(d.extrasRial)>0)}</>}
    {note('specs','مشخصات پیشنهادی؛ در صورت تفاوت با نیاز کالا')}
    {input('reference','شماره پیشنهاد یا پیش‌فاکتور (اختیاری)',false)}
   </div><label className="field">پیوست پیش‌فاکتور (اختیاری)<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" multiple disabled={busy} onChange={e=>{onUpload(e.target.files);e.currentTarget.value=''}}/><small>تصویر یا PDF؛ هر فایل حداکثر ۱۰ مگابایت</small></label>{(d.newQuoteFiles||[]).map((f:any)=><p key={f.id}>{f.filename} · <button type="button" className="btn" disabled={busy} onClick={()=>onRemove(f)}>حذف پیوست</button></p>)}{(d.files||[]).map((f:any)=><p key={f.id}><a href={'/api/sourcing/quote-files?id='+encodeURIComponent(f.id)}>{f.filename}</a></p>)}</details>
  </>}
  <details className="sourcing-quote-disclosure" open={kind!=='price'||undefined}><summary>پاسخ منفی یا نیاز به پیگیری</summary><div className="sourcing-quote-outcomes" role="group" aria-label="نتیجه استعلام">{[['price','ثبت قیمت'],['unavailable','پیشنهاد نداد'],...(!foreign?[['searching','جست‌وجوی جایگزین'],['technical','ارجاع فنی']]:[])].map(([value,label])=><button key={value} type="button" className={'btn '+(kind===value?'active':'')} aria-pressed={kind===value} onClick={()=>setKind(value)}>{label}</button>)}</div>{kind==='unavailable'&&note('reason','علت ارائه نشدن پیشنهاد',true)}{d.procurementStatus&&<>{note('notes',kind==='searching'?'نتیجه بررسی و پیگیری بعدی':'علت نیاز به تصمیم فنی یا تأمین خارجی',true)}{kind==='searching'&&<SolarDate label="موعد پیگیری بعدی" value={d.nextFollowup||''} onChange={nextFollowup=>onPatch({nextFollowup})}/>}</>}</details>
 </section>;
}
