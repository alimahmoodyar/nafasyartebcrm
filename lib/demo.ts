import type {Row,Kind} from "./model";
const r=(id:string,kind:Kind,data:Record<string,string>):Row=>({id,kind,data,created:"2026-09-10T08:00:00Z"});
export const demo:Row[]=[
r("p-nf5","product",{code:"NF5",name:"اکسیژن‌ساز ۵ لیتری نمونه",group:"اکسیژن‌ساز",model:"NF5",warrantyMonths:"24",status:"فعال",notes:"فقط داده آموزشی"}),
r("sale0","distribution",{serial:"NF5-2609-001",device:"d0",dealerName:"نماینده نمونه تهران",dealerCode:"001",dealerDate:"2026-09-08",customerName:"مصرف‌کننده نمونه",customerCity:"تهران",source:"داده آموزشی"}),
r("b1","batch",{code:"CMP-2608-01",part:"کمپرسور ۵ لیتری",supplier:"تأمین‌کننده نمونه A",maker:"سازنده نمونه",date:"2026-08-01",quantity:"100",unit:"عدد",status:"تأیید",test:"فشار و دبی: مطابق معیار داخلی نمونه"}),
r("b2","batch",{code:"ZEO-2608-02",part:"زئولیت LiLSX",supplier:"تأمین‌کننده نمونه B",date:"2026-08-02",quantity:"200",unit:"کیلوگرم",status:"تأیید"}),
r("b3","batch",{code:"PCB-2609-01",part:"برد کنترل V2.1",supplier:"تأمین‌کننده نمونه C",date:"2026-09-01",quantity:"80",unit:"عدد",status:"قرنطینه",test:"نیاز به بررسی مجدد پایداری تغذیه"}),
...Array.from({length:6},(_,i)=>r("d"+i,"device",{product:"p-nf5",productName:"اکسیژن‌ساز ۵ لیتری نمونه",productCode:"NF5",warrantyMonths:"24",code:"NF5-2609-00"+(i+1),model:"اکسیژن‌ساز ۵ لیتری",design:i<3?"R2.0":"R2.1",firmware:"1.4.2",date:"2026-09-03"})),
...Array.from({length:6},(_,i)=>r("c"+i,"event",{device:"d"+i,stage:"مصرف قطعه",batch:"b1",quantity:"1",partSerial:"CP-880"+i,operator:"اپراتور نمونه",date:"2026-09-04"})),
r("z0","event",{device:"d0",stage:"مصرف قطعه",batch:"b2",quantity:"1.2",operator:"اپراتور نمونه",date:"2026-09-04"}),
...Array.from({length:4},(_,i)=>r("m"+i,"event",{device:"d"+i,stage:"مونتاژ",operator:"گروه مونتاژ نمونه",station:"ایستگاه ۲ / WI-03",date:"2026-09-05",notes:"مونتاژ و بررسی اتصالات انجام شد."})),
...Array.from({length:3},(_,i)=>r("t"+i,"event",{device:"d"+i,stage:"آزمون نهایی",operator:"کارشناس کیفیت نمونه",date:"2026-09-06",result:"تأیید",purity:"94.2",flow:"5",instrument:"O2-REF-01",notes:"داده آموزشی؛ آزمون خروج مطابق دستورالعمل نمونه"})),
...Array.from({length:3},(_,i)=>r("p"+i,"event",{device:"d"+i,stage:"بسته‌بندی",operator:"اپراتور نمونه",date:"2026-09-07",notes:"بازرسی ظاهری و اقلام همراه"})),
...Array.from({length:3},(_,i)=>r("h"+i,"event",{device:"d"+i,stage:"تحویل",operator:"مسئول ارسال نمونه",date:"2026-09-08",customer:["نماینده نمونه تهران","نماینده نمونه شیراز","نماینده نمونه اصفهان"][i]})),
r("s1","service",{device:"d0",date:"2026-09-10",hours:"48",complaint:"صدای غیرعادی و لرزش",diagnosis:"لرزش مجموعه کمپرسور",operator:"کارشناس خدمات نمونه",status:"در حال بررسی",notes:"علت ریشه‌ای هنوز تأیید نشده است."}),
r("a1","action",{title:"بررسی لرزش مجموعه کمپرسور",batch:"b1",device:"d0",owner:"مسئول کیفیت نمونه",due:"2026-09-20",status:"در حال اجرا",plan:"بررسی گشتاور اتصالات و پایه‌های کمپرسور؛ مقایسه با دستگاه شاهد"})];
