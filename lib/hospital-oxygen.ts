export const oxygenSources={
 htm:'https://www.england.nhs.uk/rightcare/wp-content/uploads/2021/05/HTM_02-01_Part_A.pdf',
 unicef:'https://www.unicef.org/innovation/media/13711/file/UNICEF%20Oxygen%20Planning%20Tool.pdf',
 who:'https://www.who.int/publications/i/item/9789240101616',
};
export const oxygenSections={
 ward:{label:'واحد بستری عادی',first:10,next:1.5,unit:'تخت'},
 critical:{label:'مراقبت ویژه (ICU، CCU یا HDU)',first:10,next:4.5,unit:'تخت'},
 theatre:{label:'مجموعه اتاق‌های عمل',first:100,next:10,unit:'اتاق'},
 recovery:{label:'ریکاوری بعد از عمل',first:10,next:6,unit:'جایگاه'},
 resuscitation:{label:'احیای اورژانس',first:100,next:1.5,unit:'جایگاه'},
 neonatal:{label:'مراقبت ویژه نوزادان (SCBU)',first:10,next:6,unit:'تخت'},
} as const;
export const oxygenDemandFields={
 annualTurnover:{label:'تعداد پذیرش سالانه به ازای هر تخت یا جایگاه',min:0,max:100000},
 oxygenPercent:{label:'درصد موارد نیازمند اکسیژن',min:0,max:100},
 flowLpm:{label:'دبی معمول اکسیژن هر مورد، لیتر بر دقیقه',min:0.01,max:1000},
 treatmentDays:{label:'میانگین روزهای دریافت اکسیژن در هر مورد',min:0.001,max:365},
} as const;
export type OxygenSection=keyof typeof oxygenSections;
export type OxygenDemand=Record<keyof typeof oxygenDemandFields,number>;
export type OxygenRow={kind:OxygenSection;count:number;department?:string;demand?:OxygenDemand};

export function estimateHospitalOxygen(input:{rows:OxygenRow[];specialUse:'none'|'unknown'|'assessed';extraPeakLpm?:number}){
 if(!input||!Array.isArray(input.rows)||!input.rows.length||input.rows.length>100)throw Error('۱ تا ۱۰۰ ردیف برای بخش‌های بیمارستان وارد کنید.');
 if(!['none','unknown','assessed'].includes(input.specialUse))throw Error('وضعیت مصرف‌های ویژه را مشخص کنید.');
 const valid=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 if(input.specialUse==='assessed'?!valid(input.extraPeakLpm,0,100000):input.extraPeakLpm!==undefined)
  throw Error('دبی افزوده فقط برای مصرف ویژهٔ بررسی‌شده وارد می‌شود.');
 const departments=new Map<string,number[]>();
 const rows=input.rows.map((row,index)=>{
  const at='ردیف '+(index+1);
  if(!row||typeof row.kind!=='string'||!Object.hasOwn(oxygenSections,row.kind)||!Number.isSafeInteger(row.count)||!valid(row.count,0,10000))
   throw Error(at+' باید نوع بخش معتبر و تعداد صحیح بین صفر و ده‌هزار داشته باشد.');
  if(row.department!==undefined&&(row.kind!=='ward'||typeof row.department!=='string'||row.department.length>80))
   throw Error(at+' فقط برای بستری عادی می‌تواند نام گروه داشته باشد.');
  const section=oxygenSections[row.kind],designLpm=row.count?section.first+section.next*(row.count-1):0;
  const group=row.department?.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(group&&row.count)departments.set(group,[...(departments.get(group)||[]),designLpm]);
  if(!row.count||row.demand===undefined)return {designLpm,group,demandLpm:row.count?null:0};
  for(const [key,field] of Object.entries(oxygenDemandFields))
   if(!valid(row.demand?.[key as keyof OxygenDemand],field.min,field.max))throw Error(at+'، مقدار «'+field.label+'» را بررسی کنید.');
  const d=row.demand;
  // Convert annual cases and treatment duration to mean simultaneous occupancy.
  const concurrent=row.count*d.annualTurnover*d.oxygenPercent/100*d.treatmentDays/365;
  if(concurrent-row.count>1e-8)throw Error(at+'، ورودی‌ها تعداد هم‌زمان بیماران اکسیژن‌گیر را بیشتر از ظرفیت بخش برآورد می‌کنند.');
  return {designLpm,group,demandLpm:concurrent*d.flowLpm};
 });
 if(!input.rows.some(row=>row.count>0))throw Error('برای حداقل یک بخش، تعداد مثبت وارد کنید.');
 const grouped=Array.from(departments,([department,flows])=>{
  const largest=Math.max(...flows),total=flows.reduce((a,b)=>a+b,0);
  return {department,wardCount:flows.length,designLpm:largest+(total-largest)/2};
 });
 const subtotalLpm=rows.reduce((sum,row)=>sum+(row.group?0:row.designLpm),0)+grouped.reduce((sum,row)=>sum+row.designLpm,0);
 const designLpm=input.specialUse==='unknown'?null:subtotalLpm+(input.extraPeakLpm??0);
 const demandLpm=rows.every(row=>row.demandLpm!==null)?rows.reduce((sum,row)=>sum+(row.demandLpm??0),0):null;
 return {
  methodVersion:'htm-02-01-table13-2006__oxygen-demand-v1',rows,grouped,subtotalLpm,designLpm,designM3h:designLpm===null?null:designLpm*0.06,
  demandLpm,demandM3day:demandLpm===null?null:demandLpm*1.44,
  specialUse:input.specialUse,
 };
}
export type OxygenEstimate=ReturnType<typeof estimateHospitalOxygen>;
