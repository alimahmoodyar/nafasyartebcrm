import {addPaymentDays} from './sales-payment-terms';

export const dispatchBalanceId='awaiting-dispatch';

type Line={productId:string;quantity:number;net:string};
type ShipmentLine={productId:string;deviceIds:string[]};
type Installment={id:string;kind?:string;amount:string;due:string;dispatchDay?:string;shipments?:ShipmentLine[]};
type Invoice={amount:string;dispatchPaymentDays?:number;lines:Line[];installments:Installment[]};

export function deferDispatchBalance(plan:Installment[]){
 return plan.map(part=>part.kind==='balance'?{...part,id:dispatchBalanceId,due:''}:part);
}

// Round cumulatively so partial dispatches always reconcile to the original invoice.
export function dispatchInstallments(invoice:Invoice,batchId:string,day:string,shipments:ShipmentLine[]){
 const waiting=invoice.installments.find(part=>part.id===dispatchBalanceId);
 if(invoice.dispatchPaymentDays===undefined||!waiting||!shipments.length)return invoice.installments;
 const installmentId='dispatch:'+batchId;
 if(invoice.installments.some(part=>part.id===installmentId))return invoice.installments;
 const dispatched=invoice.installments.filter(part=>part.dispatchDay);
 const allShipments=[...dispatched.flatMap(part=>part.shipments||[]),...shipments];
 const serials=allShipments.flatMap(line=>line.deviceIds);
 if(new Set(serials).size!==serials.length||allShipments.some(shipment=>!invoice.lines.some(line=>line.productId===shipment.productId)))throw Error('سریال یا کالای خروج با فاکتور همخوان نیست.');
 let dispatchedValue=BigInt(0);
 for(const line of invoice.lines){
  const count=allShipments.filter(shipment=>shipment.productId===line.productId).reduce((sum,shipment)=>sum+shipment.deviceIds.length,0);
  if(count>line.quantity)throw Error('تعداد سریال‌های ارسال‌شده بیشتر از فاکتور است.');
  dispatchedValue+=BigInt(line.net)*BigInt(count)/BigInt(line.quantity);
 }
 const assigned=dispatched.reduce((sum,part)=>sum+BigInt(part.amount),BigInt(0));
 const balance=assigned+BigInt(waiting.amount),amount=balance*dispatchedValue/BigInt(invoice.amount)-assigned;
 if(amount<0||amount>BigInt(waiting.amount))throw Error('ماندهٔ محموله با فاکتور همخوان نیست.');
 const remaining=BigInt(waiting.amount)-amount;
 return [
  ...invoice.installments.filter(part=>part.id!==dispatchBalanceId),
  {id:installmentId,kind:'balance',amount:String(amount),due:addPaymentDays(day,invoice.dispatchPaymentDays),dispatchDay:day,shipments},
  ...(remaining>0?[{...waiting,amount:String(remaining)}]:[]),
 ];
}
