'use client';
import {quoteValidity} from '@/lib/quote-validity';
import {transportMethods} from '@/lib/domestic-freight-contract';
import {formatDate} from '@/lib/persian-date';
import {quoteNumber} from '@/lib/sourcing-quote-comparison';
import {NumberInput} from './number-input';
import {SolarDate} from './solar-date';
import {Select,SelectTrigger,SelectContent,SelectItem,SelectValue} from '@/components/ui/select';

type Props={draft:any;line:any;choices:any[];submittedQuotes?:any[];busy:boolean;notice:string;onPatch:(patch:any)=>void;onNewSupplier:()=>void;onSync:()=>void;onUpload:(files:FileList|null)=>void;onRemove:(file:any)=>void};
export function SourcingQuoteFields({draft:d,line,choices,submittedQuotes=[],busy,notice,onPatch,onNewSupplier,onSync,onUpload,onRemove}:Props){
 const kind=d.procurementStatus||(d.unavailable?'unavailable':'price'),foreign=d.route==='foreign',legacy=!!d.quoteId&&(d.deliveryDays===undefined||d.deliveryDays==='')&&!!d.eta;
 const pick=(label:string,value:string,items:[string,string][],onChange:(v:string)=>void)=><label className="field">{label}<Select dir="rtl" required value={value||'none'} onValueChange={v=>onChange(v==='none'?'':v)}><SelectTrigger><SelectValue placeholder="انتخاب کنید"/></SelectTrigger><SelectContent><SelectItem value="none">انتخاب کنید</SelectItem>{items.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select></label>;
 const input=(key:string,label:string,required=true)=><label className="field">{label}<NumberInput fieldKey={key} type={['deliveryDays','validityDays'].includes(key)?'number':undefined} min={key==='validityDays'?1:key==='deliveryDays'?0:undefined} max={['deliveryDays','validityDays'].includes(key)?3650:undefined} step={['deliveryDays','validityDays'].includes(key)?1:undefined} groupNumber={['unitPrice','extrasRial','fxRate','deliveryDays','requiredAdvanceRial','freightAmount','validityDays'].includes(key)} required={required} value={d[key]??''} onChange={e=>onPatch({commercialVersion:3,[key]:e.target.value,...(key==='freightAmount'?{freightStatus:e.target.value.trim()?'known':'pending'}:{})})}/></label>;
 const note=(key:string,label:string,required=false)=><label className="field">{label}<textarea rows={2} required={required} value={d[key]||''} onChange={e=>onPatch({[key]:e.target.value})}/></label>;
 const setKind=(next:string)=>onPatch({unavailable:next==='unavailable',procurementStatus:['searching','technical'].includes(next)?next:''});
 return <section className="sourcing-quote-form" aria-label="اطلاعات استعلام">
  <div className="sourcing-quote-summary"><strong>{line?.name}</strong><span>کد {d.partCode} · {((line?.shortage||0)/1000).toLocaleString('fa-IR')} {line?.unit}</span></div>
  {submittedQuotes.length>0&&<details className="sourcing-quote-responses"><summary>استعلام‌های ثبت‌شدهٔ همین کالا ({quoteNumber(submittedQuotes.length)})</summary><ul>{submittedQuotes.map(q=><li data-pair-row={JSON.stringify(q.id)} key={q.id}><strong>{q.data.supplier}</strong><span>{q.data.unavailable?'پیشنهاد نداد':<>جمع: {quoteNumber(q.data.totalRial)} ریال{q.data.freight?.status==='pending'?'؛ حمل هنوز مشخص نیست':''}</>}</span>{!q.data.unavailable&&<small>{q.data.quantity!==undefined&&<>{quoteNumber(q.data.quantity/1000)} {q.data.unit||line?.unit} · </>}{Number.isInteger(q.data.deliveryDays)?quoteNumber(q.data.deliveryDays)+' روز تقویمی':q.data.eta?formatDate(q.data.eta):''}</small>}</li>)}</ul></details>}
  {!d.procurementStatus&&<>
   {choices.length?pick('تأمین‌کننده این استعلام',d.supplierLinkId||'',choices.map(t=>[t.linkId,t.name]),v=>{const t=choices.find(t=>t.linkId===v);onPatch({supplierLinkId:v,supplier:t?.name||''})}):<div className="sourcing-quote-no-source"><p>تأمین‌کنندهٔ دیگری برای ثبت پاسخ در فهرست نیست. می‌توانید تأمین‌کنندهٔ جدید به همین کالا اضافه کنید.</p><button type="button" className="btn" disabled={busy||!line?.materialId} onClick={onNewSupplier}>افزودن تأمین‌کننده برای استعلام بعدی</button></div>}
   <details className="sourcing-quote-disclosure"><summary>افزودن یا تازه‌سازی تأمین‌کننده</summary><div className="sourcing-quote-supplier-tools"><button type="button" className="btn" disabled={busy||!line?.materialId} onClick={onNewSupplier}>تأمین‌کننده جدید برای این کالا</button><button type="button" className="btn" disabled={busy} onClick={onSync}>به‌روزرسانی تأمین‌کنندگان این کالا</button></div></details>
  </>}
  {notice&&<p className="sourcing-quote-status" role="status">{notice}</p>}
  {kind==='price'&&<><label className="flow-check"><input type="checkbox" checked={d.requestOnly===true} onChange={e=>onPatch({requestOnly:e.target.checked})}/>فعلاً درخواست استعلام ثبت شود؛ پاسخ قیمت هنوز نرسیده است.</label>{d.requestOnly?<SolarDate label="مهلت پاسخ (اختیاری)" value={d.responseDue||''} onChange={v=>onPatch({responseDue:v})}/>:<>
   <div className="sourcing-quote-grid" data-quote-core>
    {input('availableQuantity','مقدار قابل تأمین؛ خالی یعنی کل نیاز',false)}{input('unitPrice',foreign?'قیمت واحد در ارز پیشنهاد':'قیمت واحد (ریال)')}
    {input('paymentTerms','شرایط پرداخت')}
 {pick('صورتحساب رسمی و ثبت در مؤدیان',d.officialInvoice||'',[['yes','متعهد به ارائه رسمی و ثبت در مؤدیان'],['no','بدون فاکتور رسمی'],['unknown','هنوز مشخص نیست']],officialInvoice=>onPatch({commercialVersion:3,officialInvoice}))}
 {pick('مالیات و عوارض',d.taxStatus||'',[['known','نرخ مشخص'],['exempt','معاف'],['unknown','هنوز مشخص نیست']],taxStatus=>onPatch({commercialVersion:3,taxStatus}))}
 {d.taxStatus==='known'&&input('taxRate','درصد مالیات و عوارض')}
 {input('discountRial','تخفیف کل کالا (ریال)',false)}
 {pick('سایر هزینه‌ها تا کف کارخانه؛ شامل حمل و بیمه و تخلیه',d.extraStatus||'',[['included','همه داخل قیمت است'],['separate','هزینه جداگانه دارد'],['unknown','هزینه هنوز کامل نیست']],extraStatus=>onPatch({commercialVersion:3,extraStatus}))}
 {d.extraStatus==='separate'&&input('otherCostsRial','جمع تمام هزینه‌های جداگانه تا کارخانه (ریال)')}
 <p className="subtle">حملِ داخل قیمت دوباره اضافه نشود؛ مبلغ این بخش تمام هزینه‌های جداگانه حمل و جانبی است. هزینه نامشخص صفر حساب نمی‌شود.</p>
 {pick('روش دریافت پاسخ',d.responseMethod||'',[['phone','تلفنی'],['message','پیام'],['document','پیش‌فاکتور']],responseMethod=>onPatch({commercialVersion:3,responseMethod}))}
 {input('respondent','نام پاسخ‌دهنده')}
    {input('deliveryDays','مدت تحویل (روز تقویمی)',!legacy)}
    {input('validityDays','مدت اعتبار اعلامی فروشنده (روز تقویمی؛ اختیاری)',false)}<p className="subtle">{(()=>{if(!d.validityDays)return 'مهلت اعتبار اعلام نشده است؛ هنگام توافق شروع دوباره با فروشنده بررسی شود.';try{return 'معتبر تا '+formatDate(quoteValidity(d.quoteDate,d.validityDays).validUntil)+'؛ از تاریخ پیش‌فاکتور '+formatDate(d.quoteDate)}catch{return d.validUntil?'پایان اعتبار ثبت‌شده قبلی: '+formatDate(d.validUntil):'تعداد روز اعتبار را وارد کنید.'}})()}</p>
   </div>
   {legacy&&<small>موعد ثبت‌شده قبلی: {formatDate(d.eta)}؛ برای تبدیل این پیشنهاد، مدت تحویل را به روز وارد کنید.</small>}
   {foreign&&<div className="sourcing-quote-grid">{pick('ارز قیمت',d.currency,[['IRR','ریال'],['IRT','تومان'],['USD','دلار'],['CNY','یوان'],['EUR','یورو']],currency=>onPatch({currency,...(currency==='IRR'?{fxRate:'1'}:currency==='IRT'?{fxRate:'10'}:{})}))}{input('fxRate','هر واحد ارز چند ریال؟')}<SolarDate label="تاریخ نرخ تبدیل" value={d.fxDate} onChange={fxDate=>onPatch({fxDate})}/>{input('fxSource','منبع نرخ تبدیل')}</div>}
   {!foreign&&<div className="sourcing-quote-grid">{pick('روش حمل',d.transportMethod||'',Object.entries(transportMethods),transportMethod=>onPatch({transportMethod,freightStatus:transportMethod==='seller'?'':'pending',freightAmount:''}))}
    {d.transportMethod==='seller'&&pick('فروشنده کرایه جداگانه دریافت می‌کند؟',d.freightStatus==='no_charge'?'no':d.freightStatus?'yes':'',[['no','خیر'],['yes','بله']],v=>onPatch({freightStatus:v==='no'?'no_charge':v==='yes'?'pending':'',freightAmount:''}))}
    {(d.transportMethod==='carrier'||d.transportMethod==='seller'&&['pending','known'].includes(d.freightStatus))&&<details className="sourcing-quote-disclosure"><summary>کرایه از قبل مشخص است؟ ثبت مبلغ (اختیاری)</summary>{input('freightAmount','مبلغ حمل همین مقدار (ریال)',false)}<small>اگر کرایه مشخص نیست، مبلغ را خالی بگذارید.</small></details>}
    {d.transportMethod&&<p className="sourcing-quote-freight-note">{d.transportMethod==='company'?'هزینه تحویل‌گیری با خودروی شرکت بعداً در تسویه تعیین می‌شود.':d.freightStatus==='no_charge'?'بدون هزینه جداگانه برای شرکت.':d.freightStatus==='known'?'کرایه مشخص‌شده در جمع مبالغ معلوم منظور می‌شود.':'هزینه حمل پس از حمل مشخص می‌شود؛ خالی بودن مبلغ، صفر قطعی نیست.'}</p>}
   </div>}
   <details className="sourcing-quote-disclosure"><summary>جزئیات بیشتر{Number(d.extrasRial)>0?' · هزینه جانبی '+Number(d.extrasRial).toLocaleString('fa-IR')+' ریال':''}</summary><div className="sourcing-quote-grid">
    {!legacy&&pick('شروع مهلت تحویل',d.deliveryStart||'confirmation',[['confirmation','پس از قطعی‌شدن خرید'],['advance_payment','پس از قطعی‌شدن و پیش‌پرداخت']],deliveryStart=>onPatch({deliveryStart}))}
    {d.deliveryStart==='advance_payment'&&input('requiredAdvanceRial','پیش‌پرداخت لازم برای شروع (ریال)')}
    {foreign&&<>{input('extrasRial','جمع هزینه جانبی (ریال)')}{note('costNotes','شرح هزینه جانبی',Number(d.extrasRial)>0)}</>}
    <SolarDate label="تاریخ پیش‌فاکتور؛ مبنای روزهای اعتبار" value={d.quoteDate||''} onChange={quoteDate=>onPatch({quoteDate})}/>{note('specs','مشخصات پیشنهادی؛ در صورت تفاوت با نیاز کالا')}
    {input('reference','شماره پیشنهاد یا پیش‌فاکتور (اختیاری)',false)}
   </div><label className="field">پیوست پیش‌فاکتور (اختیاری)<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" multiple disabled={busy} onChange={e=>{onUpload(e.target.files);e.currentTarget.value=''}}/><small>تصویر یا PDF؛ هر فایل حداکثر ۱۰ مگابایت</small></label>{(d.newQuoteFiles||[]).map((f:any)=><p key={f.id}>{f.filename} · <button type="button" className="btn" disabled={busy} onClick={()=>onRemove(f)}>حذف پیوست</button></p>)}{(d.files||[]).map((f:any)=><p key={f.id}><a href={'/api/sourcing/quote-files?id='+encodeURIComponent(f.id)}>{f.filename}</a></p>)}</details>
  </>}</>}
  <details className="sourcing-quote-disclosure" open={kind!=='price'||undefined}><summary>پاسخ منفی یا نیاز به پیگیری</summary><div className="sourcing-quote-outcomes" role="group" aria-label="نتیجه استعلام">{[['price','ثبت قیمت'],['unavailable','پیشنهاد نداد'],...(!foreign?[['searching','جست‌وجوی جایگزین'],['technical','ارجاع فنی']]:[])].map(([value,label])=><button key={value} type="button" className={'btn '+(kind===value?'active':'')} aria-pressed={kind===value} onClick={()=>setKind(value)}>{label}</button>)}</div>{kind==='unavailable'&&note('reason','علت ارائه نشدن پیشنهاد',true)}{d.procurementStatus&&<>{note('notes',kind==='searching'?'نتیجه بررسی و پیگیری بعدی':'علت نیاز به تصمیم فنی یا تأمین خارجی',true)}{kind==='searching'&&<SolarDate label="موعد پیگیری بعدی" value={d.nextFollowup||''} onChange={nextFollowup=>onPatch({nextFollowup})}/>}</>}</details>
 </section>;
}
