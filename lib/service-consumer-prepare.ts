import type {Session} from './permissions';
import {consumerTariffValue,selectConsumerPartTariff} from './after-sales-pricing';
import {amount,array,entity,fail,need,req,txt,visible,list} from './after-sales';
import {dayAt} from './duties';

// Both pending assistant actions and final writes use the same price/source check.
// An omitted source supports old clients; a declared source is an approved snapshot.
export function consumerPriceSnapshot(row:any,tariff:any|null){
 if(!['warranty','part_warranty','paid'].includes(row.coverage))fail('پوشش قطعه معتبر نیست.');
 if(row.customerPriceSource!==undefined&&!['tariff','manual','warranty'].includes(row.customerPriceSource))fail('منبع قیمت مشتری معتبر نیست.');
 const supplied=row.customerUnitRial===undefined||row.customerUnitRial===null||txt(row.customerUnitRial,18)===''?null:amount(row.customerUnitRial);
 if(row.coverage!=='paid'){
  if(supplied!==null&&supplied!=='0')fail('قیمت مشتری برای قطعه گارانتی باید صفر باشد.');
  if(row.customerPriceSource!==undefined&&row.customerPriceSource!=='warranty')fail('پوشش یا منبع قیمت برآورد تغییر کرده؛ برآورد را تازه‌سازی کنید.',409);
  return {customerUnitRial:'0',customerPriceSource:'warranty',customerTariffId:'',customerTariffRevision:0};
 }
 if(tariff){
  const price=consumerTariffValue(tariff)!;
  if(row.customerPriceSource!==undefined&&row.customerPriceSource!=='tariff'||supplied!==null&&supplied!==price||row.customerTariffId!==undefined&&row.customerTariffId!==tariff.id||row.customerTariffRevision!==undefined&&row.customerTariffRevision!==tariff.revision)fail('تعرفه یا منبع قیمت مصرف‌کننده تغییر کرده؛ قیمت و برآورد را تازه‌سازی کنید.',409);
  return {customerUnitRial:price,customerPriceSource:'tariff',customerTariffId:tariff.id,customerTariffRevision:tariff.revision};
 }
 if(row.customerPriceSource!==undefined&&row.customerPriceSource!=='manual'||row.customerTariffId||row.customerTariffRevision)fail('تعرفه یا منبع قیمت مصرف‌کننده دیگر معتبر نیست؛ برآورد را تازه‌سازی کنید.',409);
 return {customerUnitRial:amount(row.customerUnitRial),customerPriceSource:'manual',customerTariffId:'',customerTariffRevision:0};
}

// Read-only authenticated preparation: store the exact price before asking for consent.
export async function prepareServiceDiagnosisArgs(user:Session,args:any){
 if(args.mode!=='diagnose')return args;
 const domain=req(args.domain);need(user,domain,'technician','agent');
 const data=args.data;if(!data||typeof data!=='object'||Array.isArray(data))fail('اطلاعات عیب‌یابی لازم است.');
 const serviceCase=await visible(user,await entity(req(data.caseId),'as_case'));
 if(serviceCase.data.domain!==domain)fail('حوزه پرونده متفاوت است.',403);
 if(args.revision!==serviceCase.revision)fail('اطلاعات تغییر کرده؛ تازه‌سازی کنید.',409);
 if(!['received','diagnosed','approved'].includes(serviceCase.data.state)||serviceCase.data.repairs?.length)fail('پرونده قابل عیب‌یابی مجدد نیست.');
 const tariffs=await list('as_tariff'),today=dayAt(),lines=[];
 for(const row of array(data.lines)){
  if(!row||typeof row!=='object'||Array.isArray(row))fail('ردیف قطعه معتبر نیست.');
  const material=await entity('material:'+req(row.partCode,12),'material');
  const tariff=row.coverage==='paid'?selectConsumerPartTariff(tariffs,material.data.code,today,domain):null;
  lines.push({...row,...consumerPriceSnapshot(row,tariff)});
 }
 return {...args,data:{...data,lines}};
}

// A lost preparation response can be retried using the original unpriced input.
// Compare against the saved immutable snapshot without looking up a changed catalogue.
export function comparableServiceDiagnosisRetry(saved:any,submitted:any){
 if(saved.mode!=='diagnose'||submitted.mode!=='diagnose'||!Array.isArray(saved.data?.lines)||!Array.isArray(submitted.data?.lines))return {saved,submitted};
 const left=JSON.parse(JSON.stringify(saved)),right=JSON.parse(JSON.stringify(submitted));
 for(let i=0;i<left.data.lines.length;i++){
  const row=left.data.lines[i],input=right.data.lines[i];if(!row||!input||typeof input!=='object')continue;
  for(const key of ['customerUnitRial','customerPriceSource','customerTariffId','customerTariffRevision']){
   if(input[key]===undefined||key==='customerUnitRial'&&(input[key]===null||txt(input[key],18)==='')){delete row[key];delete input[key];}
  }
  if(input.customerUnitRial!==undefined)input.customerUnitRial=amount(input.customerUnitRial);
 }
 return {saved:left,submitted:right};
}
