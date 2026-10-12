import {consumerTariffValue,selectConsumerPartTariff} from './after-sales-pricing';

// Display the same approved price the server will snapshot at confirmation.
export function consumerDraftLine(next:any,previous:any,tariffs:any[],day:string,domain:string){
 const row={...next};
 delete row.customerTariffId;delete row.customerTariffRevision;delete row.customerPriceSource;
 if(['warranty','part_warranty'].includes(row.coverage))return {...row,customerUnitRial:'0',customerPriceSource:'warranty'};
 const tariff=row.coverage==='paid'?selectConsumerPartTariff(tariffs,row.partCode,day,domain):null;
 if(tariff)return {...row,customerUnitRial:consumerTariffValue(tariff),customerTariffId:tariff.id,customerTariffRevision:tariff.revision,customerPriceSource:'tariff'};
 if(previous?.partCode!==row.partCode||previous?.customerPriceSource==='tariff'||previous?.customerPriceSource==='warranty')row.customerUnitRial='';
 return row.coverage==='paid'?{...row,customerPriceSource:'manual'}:row;
}

export function consumerRowTotal(row:any):string|null {
 if(!/^\d{1,18}$/.test(String(row.customerUnitRial??''))||!/^\d{1,9}(?:\.\d{1,3})?$/.test(String(row.quantity??'')))return null;
 const [whole,fraction='']=String(row.quantity).split('.'),quantity=BigInt(whole)*BigInt(1000)+BigInt(fraction.padEnd(3,'0'));
 if(quantity<=BigInt(0))return null;
 return ((BigInt(row.customerUnitRial)*quantity+BigInt(999))/BigInt(1000)).toString();
}
