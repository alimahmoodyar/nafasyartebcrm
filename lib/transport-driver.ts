import {fail} from './after-sales';
import {transportBlockerReasons,transportChecklistLabels} from './transport-contract';
export function checkTransportChecklist(value:Record<string,unknown>){
 for(const key of Object.keys(transportChecklistLabels))if(value[key]!==true)fail('تمام موارد چک‌لیست را پس از بررسی واقعی تأیید کنید.');
 return Object.fromEntries(Object.keys(transportChecklistLabels).map(key=>[key,true]));
}
export function checkTransportBlocker(reason:unknown){if(typeof reason!=='string'||!Object.hasOwn(transportBlockerReasons,reason))fail('دلیل مانع معتبر انتخاب کنید.');return reason as string;}
export function checkVehicleReading(kind:unknown,odometer:unknown,fuel:unknown){
 if(!['reading','fuel','fault'].includes(String(kind)))fail('نوع گزارش خودرو معتبر نیست.');
 let reading:number|undefined,litres:number|undefined;
 if(odometer!==undefined&&odometer!==null&&odometer!==''){if(typeof odometer!=='number'&&typeof odometer!=='string'||typeof odometer==='string'&&!/^\d+$/.test(odometer))fail('کیلومتر خودرو باید عدد صحیح باشد.');reading=Number(odometer);if(!Number.isSafeInteger(reading)||reading<0||reading>10000000)fail('کیلومتر خودرو باید عدد صحیح بین صفر و ده میلیون باشد.');}
 if(kind==='reading'&&reading===undefined)fail('کیلومتر مشاهده‌شده لازم است.');
 if(kind==='fuel'){if(typeof fuel!=='string'||!/^\d{1,3}(\.\d{1,3})?$/.test(fuel)||Number(fuel)<=0||Number(fuel)>500)fail('مقدار سوخت بین صفر و ۵۰۰ لیتر و حداکثر سه رقم اعشار باشد.');litres=Number(fuel);}
 return {odometer:reading,fuelLitres:litres};
}
