export const oxygenSources={
 htm:'https://www.england.nhs.uk/rightcare/wp-content/uploads/2021/05/HTM_02-01_Part_A.pdf',
 unicef:'https://www.unicef.org/innovation/media/13711/file/UNICEF%20Oxygen%20Planning%20Tool.pdf',
 who:'https://www.who.int/publications/i/item/9789240101616',
};
export const oxygenSections={
 ward:{label:'بستری عادی',group:'بستری',unit:'تخت',first:10,next:1.5},
 resuscitation:{label:'احیای اورژانس',group:'اورژانس',unit:'جایگاه برانکارد',first:100,next:1.5},
 emergencyMajor:{label:'درمان عمده یا گچ‌گیری',group:'اورژانس',unit:'جایگاه برانکارد',first:10,next:1.5},
 emergencyRecovery:{label:'ریکاوری پس از بیهوشی',group:'اورژانس',unit:'جایگاه برانکارد',first:10,next:0.75},
 emergencyTreatment:{label:'اتاقک یا اتاق درمان',group:'اورژانس',unit:'اتاق یا جایگاه',first:10,next:0.6},
 anaesthesia:{label:'اتاق بیهوشی، در مجموعهٔ عمل',group:'جراحی',unit:'اتاق',first:0,next:0},
 theatre:{label:'اتاق عمل',group:'جراحی',unit:'اتاق',first:100,next:10},
 recovery:{label:'ریکاوری پس از عمل',group:'جراحی',unit:'جایگاه',first:10,next:6},
 maternityMother:{label:'اتاق زایمان و ریکاوری، مادر',group:'زایمان و نوزادان',unit:'جایگاه',first:10,next:1.5},
 maternityBaby:{label:'اتاق زایمان و ریکاوری، نوزاد',group:'زایمان و نوزادان',unit:'جایگاه',first:10,next:1.5},
 maternityTheatre:{label:'مجموعهٔ عمل زایمان، بیهوشی',group:'زایمان و نوزادان',unit:'مجموعه',first:100,next:6},
 maternityPaediatric:{label:'مجموعهٔ عمل زایمان، پزشک نوزاد',group:'زایمان و نوزادان',unit:'جایگاه',first:10,next:3},
 maternityRecovery:{label:'ریکاوری پس از بیهوشی زایمان',group:'زایمان و نوزادان',unit:'جایگاه',first:10,next:0.75},
 maternityWard:{label:'بستری تک‌تخته یا چندتختهٔ زایمان',group:'زایمان و نوزادان',unit:'تخت',first:10,next:1},
 nursery:{label:'اتاق نوزادان',group:'زایمان و نوزادان',unit:'جایگاه نوزاد',first:10,next:1.5},
 neonatal:{label:'مراقبت ویژهٔ نوزادان (SCBU)',group:'زایمان و نوزادان',unit:'تخت',first:10,next:6},
 radiology:{label:'اتاق بیهوشی و اقدام تصویربرداری',group:'تصویربرداری',unit:'اتاق',first:10,next:2},
 critical:{label:'مراقبت ویژه (ICU)',group:'مراقبت ویژه',unit:'تخت',first:10,next:4.5},
 coronary:{label:'مراقبت قلبی (CCU)',group:'مراقبت ویژه',unit:'تخت',first:10,next:4.5},
 highDependency:{label:'مراقبت با وابستگی بالا (HDU)',group:'مراقبت ویژه',unit:'تخت',first:10,next:4.5},
 renal:{label:'کلیه و دیالیز',group:'سایر بخش‌ها',unit:'جایگاه',first:10,next:1.5},
 cpap:{label:'تهویهٔ CPAP',group:'سایر بخش‌ها',unit:'دستگاه',first:56.25,next:56.25},
 ect:{label:'اتاق درمان با تشنج الکتریکی',group:'روان‌پزشکی بزرگسالان',unit:'اتاق',first:10,next:1.5},
 ectRecovery:{label:'ریکاوری پس از بیهوشی',group:'روان‌پزشکی بزرگسالان',unit:'تخت',first:10,next:1.5},
 acuteTreatment:{label:'اتاق درمان',group:'مراقبت حاد روزانهٔ بزرگسالان',unit:'اتاق',first:10,next:1.5},
 acuteRecovery:{label:'ریکاوری پس از بیهوشی',group:'مراقبت حاد روزانهٔ بزرگسالان',unit:'تخت',first:10,next:1.5},
 dayWard:{label:'بستری روزانه',group:'بستری',unit:'تخت',first:10,next:1.5},
 dentalOne:{label:'اتاق نوع ۱',group:'جراحی دهان و ارتودنسی',unit:'اتاق',first:10,next:3},
 dentalTwoThree:{label:'اتاق نوع ۲ و ۳',group:'جراحی دهان و ارتودنسی',unit:'اتاق',first:10,next:2},
 dentalRecovery:{label:'ریکاوری',group:'جراحی دهان و ارتودنسی',unit:'تخت',first:10,next:1},
 outpatient:{label:'اتاق درمان سرپایی',group:'سایر بخش‌ها',unit:'اتاق',first:10,next:1.5},
 equipment:{label:'اتاق سرویس تجهیزات و استریل',group:'سایر بخش‌ها',unit:'اتاق',first:0,next:0},
} as const;
export const groupedOxygenSections=['ward','dayWard'] as const;
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
  if(row.department!==undefined&&(!groupedOxygenSections.some(kind=>kind===row.kind)||typeof row.department!=='string'||row.department.length>80))
   throw Error(at+' فقط برای بستری عادی می‌تواند نام گروه داشته باشد.');
  const section=oxygenSections[row.kind],designLpm=row.count?section.first+section.next*(row.count-1):0;
  const group=row.department?.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(group&&row.count)departments.set(row.kind+':'+group,[...(departments.get(row.kind+':'+group)||[]),designLpm]);
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
  return {department:department.slice(department.indexOf(':')+1),wardCount:flows.length,designLpm:largest+(total-largest)/2};
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

export function estimateCylinderOxygen(rows:readonly {volume:number;count:number}[],pressure:number,peakHours:number){
 const positive=(value:number)=>Number.isFinite(value)&&value>0;
 if(!rows.length||!positive(pressure)||pressure>400||!positive(peakHours)||peakHours>24||rows.some(row=>!positive(row.volume)||!positive(row.count)))
  throw Error('حجم، تعداد، فشار و ساعت اوج مصرف را بررسی کنید.');
 const volume=rows.reduce((sum,row)=>sum+row.volume*row.count*pressure,0);
 const average=volume/(24*60),peak=volume/(peakHours*60);
 return {volume,average,peak};
}
