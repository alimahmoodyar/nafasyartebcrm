export const transportRoles:Record<string,string>={manager:'مسئول تدارکات و حمل‌ونقل',driver:'کارشناس تدارکات و حمل‌ونقل'};
export const transportStates:Record<string,string>={requested:'در انتظار تخصیص',assigned:'مأموریت تخصیص‌یافته',collected:'در اختیار راننده',carrier:'تحویل باربری',offered:'در انتظار تأیید مقصد',disputed:'مغایرت دریافت',delivered:'تحویل نهایی',cancelled:'لغوشده'};
export const transportKinds:Record<string,string>={purchase_order:'دریافت خرید از تأمین‌کننده',sale:'ارسال محصول',as_shipment:'ارسال قطعات خدمات',as_claim:'دریافت داغی',as_case:'دریافت دستگاه تعمیراتی'};
export const transportActions:Record<string,string>={create:'درخواست حمل',assign:'تخصیص / تغییر مأموریت',collect:'تأیید دریافت راننده',carrier:'تحویل به باربری',offer:'اعلام تحویل به مقصد',receipt:'تأیید دریافت مقصد',resolve:'بررسی مغایرت',documents:'تکمیل اطلاعات بارنامه',expense:'ثبت هزینه حمل',expense_review:'بررسی هزینه حمل',cancel:'لغو درخواست',vehicle:'تعریف / ویرایش خودرو',link_party:'اتصال گیرنده فروش به نمایندگی'};
export type TransportField={key:string;label:string;type?:'text'|'textarea'|'select'|'number'|'date'|'boolean';source?:string;options?:string[][];optional?:boolean};
const f=(key:string,label:string,extra:Partial<TransportField>={}):TransportField=>({key,label,...extra});
const notes=f('notes','توضیحات / مدرک انجام کار',{type:'textarea'}),day=f('day','تاریخ واقعی انجام',{type:'date'}),packages=f('packages','تعداد بسته',{type:'number'});
export const transportForms:Record<string,TransportField[]>={
 create:[f('sourceKey','سفارش یا پرونده مرتبط',{type:'select',source:'sources'}),packages,f('route','روش تحویل',{type:'select',options:[['carrier','از طریق باربری'],['direct','مستقیم']]}),f('pickup','نشانی / محل دریافت'),f('destination','نشانی مقصد'),f('recipient','نام تحویل‌گیرنده'),f('phone','شماره تماس مقصد'),f('due','موعد انجام',{type:'date'}),f('receiverId','مسئول دریافت داخل شرکت؛ برگشتی یا خرید',{type:'select',source:'receivers',optional:true}),notes],
 assign:[f('receiverId','مسئول دریافت داخلی؛ اگر هنوز مشخص نشده',{type:'select',source:'receivers',optional:true}),f('driverId','راننده',{type:'select',source:'drivers'}),f('vehicleId','خودرو',{type:'select',source:'vehicles'}),f('due','موعد انجام',{type:'date'}),notes],
 collect:[packages,day,f('condition','وضعیت ظاهری بسته‌ها'),notes],
 carrier:[f('carrier','نام باربری'),f('waybill','شماره بارنامه',{optional:true}),f('tracking','کد رهگیری',{optional:true}),day,notes],
 documents:[f('carrier','نام باربری'),f('waybill','شماره بارنامه',{optional:true}),f('tracking','کد رهگیری',{optional:true}),notes],
 offer:[f('handoverTo','نام فرد تحویل‌گیرنده'),day,notes],
 receipt:[packages,day,f('result','نتیجه دریافت',{type:'select',options:[['complete','کامل و سالم'],['shortage','کسری'],['damage','آسیب‌دیده']]}),f('location','محل نگهداری داخل شرکت؛ برای داغی',{optional:true}),notes],
 resolve:[f('resolution','نتیجه بررسی',{type:'select',options:[['retry','پیگیری و درخواست دریافت مجدد'],['accepted','مغایرت با مدرک رفع شد؛ دریافت مجدد لازم است']]}),notes],
 expense:[f('amountRial','هزینه حمل (ریال)',{type:'number'}),f('reference','شماره رسید هزینه'),notes],
 expense_review:[f('expenseId','هزینه مورد بررسی',{type:'select',source:'expenses'}),f('approved','تأیید هزینه',{type:'boolean'}),notes],
 cancel:[notes],
 vehicle:[f('name','نام خودرو'),f('plate','پلاک'),f('active','فعال',{type:'boolean'})],
 link_party:[f('partyId','گیرنده فروش',{type:'select',source:'parties'}),f('agentId','نمایندگی دارای پروفایل',{type:'select',source:'agents'}),notes]
};
export const transportHelp='ابتدا get_transport را بخوان. sourceKey از منابع واقعی انتخاب شود. درخواست حمل موجب تغییر موجودی نیست. راننده فقط مأموریت خودش را دریافت و تحویل می‌کند. بارنامه و دریافت نهایی دو مرحله جدا هستند. دریافت فیزیکی داغی مجوز بستانکاری نیست. یک نقش مشترک driver برای فروش، خدمات خانگی، خدمات بیمارستانی و دریافت خرید کافی است؛ دسترسی راننده فقط بر اساس مأموریت تخصیص‌یافته است. برای برگشتی و دریافت خرید مسئول دریافت تعیین شود. تحویل خرید فقط ورود فیزیکی است؛ رسید مقدار کالا، بچ و کنترل کیفیت از مسیر خرید/انبار ثبت می‌شود. نتیجه آسیب/کسری تحویل را نهایی نمی‌کند؛ پیگیری، رفع و تأیید تازه لازم است. هزینه فقط ثبت و بررسی می‌شود و پرداخت بانکی نیست. هیچ دریافت، مدرک یا تأییدی را حدس نزن. برای mutation شناسه UUID و نسخه دقیق مأموریت لازم است؛ تکرار همان درخواست همان نتیجه را می‌دهد.';
