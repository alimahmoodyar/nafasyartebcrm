// Costing is a read model over posted stock movements. All money uses micro-rials.
export const MICRO=BigInt(1000000);
export function moneyMicro(v:unknown){if(typeof v!=='string'||!/^\d{1,15}(\.\d{1,6})?$/.test(v))throw Error('مبلغ ریالی معتبر با حداکثر شش رقم اعشار لازم است.');const [a,b='']=v.split('.');return BigInt(a)*MICRO+BigInt(b.padEnd(6,'0'));}
export const moneyText=(n:bigint)=>{const sign=n<BigInt(0)?'-':'';n=n<BigInt(0)?-n:n;return sign+(n/MICRO).toString()+((n%MICRO)?'.'+(n%MICRO).toString().padStart(6,'0').replace(/0+$/,''):'');};
export const rounded=(n:bigint)=>((n+MICRO/BigInt(2))/MICRO).toString();
export const costRead=(u:any)=>!u.permissions.salesAgentId&&!u.permissions.serviceAgentId&&!u.permissions.hospitalCenterId&&(u.isAdmin||['read','write'].includes(u.permissions.finance));
export const costWrite=(u:any)=>costRead(u)&&(u.isAdmin||u.permissions.finance==='write');
export const costingHelp=[
 'همه مبالغ ریال و قیمت واحد بر حسب واحد اصلی شناسنامه قطعه است. هزینه‌های مستقیم خرید را در قیمت تمام‌شده واحد لحاظ کنید؛ سند و توضیح الزامی است.',
 'بهای مواد با میانگین موزون متحرکِ موجودی قابل مصرف (مواد اولیه و خط) بر اساس ترتیب ثبت گردش محاسبه می‌شود. تأیید تطبیق این روش با سپیدار برای نهایی‌سازی لازم است؛ این سامانه به سپیدار متصل نشده است.',
 'قرنطینه و رد خرید وارد میانگین مواد قابل مصرف نمی‌شوند. رزرو و جابه‌جایی بین مواد اولیه و خط، مصرف نیست. قیمت نامشخص موجب ناقص‌شدن محاسبه است، نه قیمت صفر.',
 'بهای استاندارد از BOM نسخه‌دار و نرخ‌های مصوب محاسبه می‌شود. برای مجموعه ساخت داخل، اتصال صریح کد ماده به BOM زیرمجموعه لازم است؛ زیرمجموعه و قطعات آن هم‌زمان شمرده نمی‌شوند.',
 'بهای واقعی موقت از خروج ثبت‌شده برای دستگاه، شامل قطعه جایگزین و زمان واقعی ثبت‌شده آن دستگاه محاسبه می‌شود. قطعه نامنطبق خارج‌شده بدون اعتبار برگشت، از هزینه دستگاه کم نمی‌شود.',
 'دوره ماهانه بر اساس زمان ثبت مصرف است. سربار ثابت بر بزرگ‌ترِ ظرفیت عادی و زمان واقعی تخصیص می‌یابد؛ بخش جذب‌نشده جداست. دستمزد و سربار متغیر بر زمان واقعی ثبت‌شده تخصیص می‌یابند.',
 'بستن دوره یک گزارش مدیریتی ثابت ایجاد می‌کند و سند حسابداری یا قفل تولید نیست. تغییر دیرهنگام منابع، گزارش را نیازمند بازبینی نشان می‌دهد؛ تاریخچه نسخه‌ها باقی می‌ماند. بدون قیمت، زمان واقعی و تأیید مالی بهای نهایی ساخته نمی‌شود.',
 'تولید در جریان ساخت شامل هزینه‌های ثبت‌شده دستگاه‌های تحویل‌نشده است؛ مواد آماده‌سازی‌شده ولی مصرف‌نشده همچنان موجودی خط محسوب می‌شوند. هزینه اداری و فروش جداست.'
];
const parse=(v:any)=>typeof v==='string'?JSON.parse(v):v;
export function calculateCosts(src:any){
 const entities=src.entities.map((r:any)=>({...r,data:parse(r.data)})),records=src.records.map((r:any)=>({...r,data:parse(r.payload)}));
 const batches=new Map<string,any>(records.filter((r:any)=>r.kind==='batch').map((r:any)=>[r.id,r]));
 const products=records.filter((r:any)=>r.kind==='product');const devices=records.filter((r:any)=>r.kind==='device');
 const prices=new Map<string,any>(entities.filter((r:any)=>r.type==='cost_price').map((r:any)=>[r.data.batchId,r]));
 const materials=entities.filter((r:any)=>r.type==='material');
 const standards=new Map<string,any>(entities.filter((r:any)=>r.type==='cost_standard').map((r:any)=>[r.data.bomId,r]));
 const rates=new Map<string,any>(entities.filter((r:any)=>r.type==='cost_material').map((r:any)=>[r.data.partCode,r]));
 const pool=new Map<string,{q:number;v:bigint|null}>();const byDevice=new Map<string,any>();const unassigned:any[]=[];const warnings=new Set<string>();
 const entriesByOp=new Map<string,any[]>();for(const e of src.entries){const list=entriesByOp.get(e.operation_id)||[];list.push(e);entriesByOp.set(e.operation_id,list);}
 const ordered=[...src.operations].sort((a:any,b:any)=>a.created.localeCompare(b.created)||Number(a.sequence)-Number(b.sequence));
 for(const op of ordered){
  const entries=entriesByOp.get(op.id)||[],body=parse(op.payload);const groups=new Map<string,{delta:number;entries:any[]}>();
  for(const e of entries){const b=batches.get(e.item_id);if(!b||!['raw','line'].includes(e.warehouse))continue;const key=b.data.partCode+'|'+b.data.unit;const g=groups.get(key)||{delta:0,entries:[]};g.delta+=e.delta;g.entries.push(e);groups.set(key,g);}
  for(const [key,g] of groups){if(!g.delta)continue;const p=pool.get(key)||{q:0,v:BigInt(0)};const before=p.q>0&&p.v!==null?p.v*BigInt(1000)/BigInt(p.q):null;
   if(g.delta>0){let value:bigint|null=BigInt(0);for(const e of g.entries){if(e.delta<=0)continue;const price=prices.get(e.item_id);if(!price){value=null;warnings.add('قیمت بچ ثبت نشده: '+e.item_id);break;}value+=moneyMicro(price.data.unitCost)*BigInt(e.delta)/BigInt(1000);}
    p.v=p.v===null||value===null?null:p.v+value;p.q+=g.delta;
   }else{const q=-g.delta;let cost=before===null||p.q<q?null:before*BigInt(q)/BigInt(1000);if(p.q<q)warnings.add('توالی موجودی ناقص برای '+key);p.q-=q;p.v=p.v===null||cost===null?null:p.v-cost;if(p.q===0)p.v=BigInt(0);
    let did=body.deviceId||'';if(!did&&body.orderId)did=src.orders.find((o:any)=>o.id===body.orderId)?.device_id||'';
    const isProduction=['flow_build','flow_repair','finish'].includes(op.kind)&&!!did;
    const detail={operationId:op.id,at:op.created,partCode:key.split('|')[0],unit:key.split('|')[1],quantity:q/1000,cost:cost===null?null:moneyText(cost),unitCost:before===null?null:moneyText(before),kind:op.kind,batches:g.entries.filter(e=>e.delta<0).map(e=>e.item_id)};
    if(isProduction){const d=byDevice.get(did)||{id:did,lines:[],material:BigInt(0),complete:true};d.lines.push(detail);d.complete=d.complete&&cost!==null;if(cost!==null)d.material+=cost;byDevice.set(did,d);}else unassigned.push(detail);
   }pool.set(key,p);
  }
 }
 const bomRows=src.boms.map((b:any)=>({...b,lines:parse(b.lines)}));
 const standard=(bomId:string,path:string[]=[]):any=>{
  const bom=bomRows.find((b:any)=>b.id===bomId);if(!bom||path.includes(bomId))return {bomId,complete:false,missing:[path.includes(bomId)?'چرخه در BOM زیرمجموعه':'BOM یافت نشد'],total:null};
  let mat=BigInt(0);const missing:string[]=[],lines:any[]=[];const profile=standards.get(bomId)?.data;
  for(const l of bom.lines){const rate=rates.get(l.partCode)?.data;let unit:bigint|null=null;let child:any=null;
   if(rate?.childBomId){child=standard(rate.childBomId,[...path,bomId]);if(child.complete)unit=moneyMicro(child.total);else missing.push(...child.missing.map((s:string)=>l.name+': '+s));}
   else if(rate&&rate.unit===l.unit)unit=moneyMicro(rate.unitCost);
   if(unit===null)missing.push('نرخ استاندارد '+l.name);const cost=unit===null?null:unit*BigInt(Math.round(Number(l.quantity)*1000))/BigInt(1000);if(cost!==null)mat+=cost;lines.push({...l,unitCost:unit===null?null:moneyText(unit),cost:cost===null?null:moneyText(cost),childBomId:rate?.childBomId||''});
  }
  if(!profile)missing.push('زمان و نرخ استاندارد دستمزد/سربار');const labor=profile?moneyMicro(profile.laborHourly)*BigInt(profile.minutes)/BigInt(60):BigInt(0),overhead=profile?moneyMicro(profile.overheadHourly)*BigInt(profile.minutes)/BigInt(60):BigInt(0);
  return {bomId,productId:bom.product_id,version:bom.version,complete:!missing.length,missing,lines,materials:moneyText(mat),labor:profile?moneyText(labor):null,overhead:profile?moneyText(overhead):null,total:missing.length?null:moneyText(mat+labor+overhead),profile:profile||null};
 };
 const calculated=Array.from(byDevice.values()).map((d:any)=>{const rec=devices.find((r:any)=>r.id===d.id),build=entities.find((e:any)=>e.type==='build'&&e.id===d.id),order=src.orders.find((o:any)=>o.device_id===d.id),bomId=build?.data.bomId||order?.bom_id;const s=bomId?standard(bomId):null;
  const delivered=src.entries.some((e:any)=>e.item_id===d.id&&e.warehouse==='finished'&&e.delta>0);
  return {id:d.id,serial:rec?.data.code||d.id,productId:rec?.data.product||'',bomId,state:delivered?'finished':'wip',complete:d.complete,material:d.complete?moneyText(d.material):null,knownMaterial:moneyText(d.material),lines:d.lines,standard:s,materialVariance:d.complete&&s?.complete?moneyText(d.material-moneyMicro(s.materials)):null};});
 return {devices:calculated,standards:bomRows.map((b:any)=>standard(b.id)),pools:Array.from(pool.entries()).map(([k,p])=>({partCode:k.split('|')[0],unit:k.split('|')[1],quantity:p.q/1000,value:p.v===null?null:moneyText(p.v),unitCost:p.q>0&&p.v!==null?moneyText(p.v*BigInt(1000)/BigInt(p.q)):null})),warnings:[...warnings],unassigned,products:products.map((p:any)=>({id:p.id,...p.data})),batches:Array.from(batches.values()).map((b:any)=>({id:b.id,...b.data,price:prices.get(b.id)||null})),materials:materials.map((m:any)=>({id:m.id,...m.data,rate:rates.get(m.data.code)||null}))};
}
export function periodCosts(result:any,entities:any[],period:any){
 const {start,end}=period;const inPeriod=(at:string)=>{const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));return day>=start&&day<=end;};
 const labor=entities.filter((e:any)=>e.type==='cost_time'&&e.data.day>=start&&e.data.day<=end);
 const selected=result.devices.filter((d:any)=>d.lines.some((l:any)=>inPeriod(l.at))||labor.some((l:any)=>l.data.deviceId===d.id));
 const blockers:string[]=[];if(!period.methodConfirmed)blockers.push('تطبیق روش میانگین موزون متحرک با حسابداری تأیید نشده است.');
 for(const l of labor)if(!result.devices.some((d:any)=>d.id===l.data.deviceId))blockers.push('زمان دستگاه بدون مصرف ثبت‌شده: '+l.data.deviceId);
 const minutes=labor.reduce((n:number,l:any)=>n+l.data.minutes,0);if(!minutes)blockers.push('زمان واقعی تولید دوره ثبت نشده است.');
 const wage=moneyMicro(period.laborTotal),fixed=moneyMicro(period.fixedOverhead),variable=moneyMicro(period.variableOverhead),normal=Math.max(period.normalMinutes,minutes);
 const devices=selected.map((d:any)=>{const lines=d.lines.filter((l:any)=>inPeriod(l.at)),time=labor.filter((l:any)=>l.data.deviceId===d.id).reduce((n:number,l:any)=>n+l.data.minutes,0);if(!time)blockers.push('زمان واقعی ثبت نشده: '+d.serial);if(lines.some((l:any)=>l.cost===null))blockers.push('قیمت مواد ناقص: '+d.serial);const material=lines.reduce((n:bigint,l:any)=>n+moneyMicro(l.cost||'0'),BigInt(0)),w=minutes?wage*BigInt(time)/BigInt(minutes):BigInt(0),v=minutes?variable*BigInt(time)/BigInt(minutes):BigInt(0),f=normal?fixed*BigInt(time)/BigInt(normal):BigInt(0);
  return {id:d.id,serial:d.serial,state:d.state,minutes:time,material:lines.some((l:any)=>l.cost===null)?null:moneyText(material),labor:moneyText(w),overhead:moneyText(v+f),total:lines.some((l:any)=>l.cost===null)?null:moneyText(material+w+v+f),lines};});
 const absorbed=normal?fixed*BigInt(minutes)/BigInt(normal):BigInt(0);
 return {start,end,devices,minutes,blockers:[...new Set(blockers)],complete:!blockers.length&&!!devices.length,unabsorbedFixed:moneyText(fixed-absorbed),nonproduction:period.nonproduction||'0',unassigned:result.unassigned.filter((l:any)=>inPeriod(l.at)),note:'هزینه‌های ثبت‌شده در بازه؛ بهای تجمعی دستگاه در جزئیات مواد قابل مشاهده است.'};
}
