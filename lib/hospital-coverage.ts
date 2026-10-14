import {addSolarMonths} from './sales-payment-terms';
import {isIsoDay,solarParts,solarToIso,solarMonthDays} from './persian-date';

export function warrantyEnd(d:any){
 const start=d.warrantyStart||d.installedOn,months=Number(d.warrantyMonths);
 return d.warrantyUntil||(isIsoDay(start)&&Number.isSafeInteger(months)&&months>0?addSolarMonths(start,months):'');
}
export function hospitalContractFollowup(asset:any,today:string){
 const d=asset.data,end=warrantyEnd(d);
 if(end&&Number(d.warrantyMonths)>0&&(!d.warrantyStart||d.warrantyStart<=today)&&today<=end)return null;
 const c=d.serviceContract||{};let reason='',title='';
 if(c.status==='yes'&&isIsoDay(c.until)){
  const p=solarParts(c.until),n=p.year*12+p.month-2,y=Math.floor(n/12),m=n%12+1;
  const reminder=solarToIso(y,m,Math.min(p.day,solarMonthDays(y,m)));
  if(c.from&&today<c.from){return {assetId:asset.id,revision:asset.revision,centerId:d.centerId,serial:d.serial,model:d.model,reason:'gap',title:'قرارداد خدمات هنوز شروع نشده است',from:c.from,until:c.until,cycle:[c.status,c.from,c.until,end||''].join(':')};}if(today<reminder)return null;
  reason=today>c.until?'expired':'renew';title=reason==='expired'?'قرارداد خدمات منقضی شده':'تمدید قرارداد؛ یک ماه تا پایان';
 }else{reason=c.status==='no'?'new':'unknown';title=reason==='new'?'پیگیری عقد قرارداد خدمات':'تعیین وضعیت قرارداد خدمات';}
 return {assetId:asset.id,revision:asset.revision,centerId:d.centerId,serial:d.serial,model:d.model,reason,title,from:c.from||'',until:c.until||'',cycle:[c.status||'unknown',c.from||'',c.until||'',end||''].join(':')};
}

/** New forms have explicit yes/no; legacy snapshots remain readable without inventing a start. */
export function installationCoverage(input:any,warrantyMonths:number,installedOn:string,today:string){
 const modern=Array.isArray(input.services);
 if(modern&&!['yes','no'].includes(input.warrantyStatus))throw Error('داشتن یا نداشتن گارانتی را مشخص کنید.');
 if(modern&&(input.warrantyStatus==='yes')!==(warrantyMonths>0))throw Error('وضعیت گارانتی با مدت توافق‌شده قرارداد یکسان باشد.');
 const warrantyStart=warrantyMonths>0?(input.warrantyStart||(!modern?installedOn:'')):'';
 if(warrantyMonths>0&&!isIsoDay(warrantyStart))throw Error('تاریخ شروع گارانتی لازم است.');
 const warrantyUntil=warrantyMonths>0?addSolarMonths(warrantyStart,warrantyMonths):'';
 const expired=warrantyMonths===0||warrantyStart>today||warrantyUntil<today,status=input.contractStatus||'';
 if(!['','yes','no'].includes(status)||expired&&!status)throw Error('داشتن یا نداشتن قرارداد خدمات را مشخص کنید.');
 const from=status==='yes'?input.contractFrom||'':'',until=status==='yes'?input.contractUntil||'':'';
 if(status==='yes'&&(!isIsoDay(until)||modern&&!isIsoDay(from)||from&&(!isIsoDay(from)||from>until)))throw Error('تاریخ شروع و پایان قرارداد خدمات معتبر باشد.');
 return {warrantyStatus:warrantyMonths>0?'yes':'no',warrantyStart,warrantyUntil,serviceContract:{status,from,until}};
}
