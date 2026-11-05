import {AccessError} from './authorization';
import {transportMethods,freightStatuses} from './domestic-freight-contract';
export function domesticFreight(b:any){
 if(b.transportMethod===undefined&&b.freightStatus===undefined)return null; // Existing quote clients keep their declared legacy costs.
 if(!Object.hasOwn(transportMethods,b.transportMethod)||!Object.hasOwn(freightStatuses,b.freightStatus))throw new AccessError('روش حمل و وضعیت هزینه حمل را انتخاب کنید.',400);
 const amount=b.freightStatus==='known'?String(b.freightAmount||''):null;
 if(amount!==null&&(!/^\d{1,18}$/.test(amount)||BigInt(amount)<=BigInt(0)))throw new AccessError('مبلغ مشخص حمل باید ریالی و مثبت باشد.',400);
 return {method:b.transportMethod,status:b.freightStatus,amountRial:b.freightStatus==='no_charge'?'0':amount};
}
