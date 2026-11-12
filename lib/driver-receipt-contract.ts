export const driverReceiptStates:Record<string,string>={with_driver:'نزد راننده',received_office:'تحویل پذیرش؛ منتظر تکمیل پرونده',linked:'تحویل پذیرش و متصل به پرونده'};
export const driverReceiptQr=(id:string)=>'NAFASYAR-RECEIPT/1:'+id;
export function driverReceiptId(value:string){const id=String(value||'').trim().replace(/^NAFASYAR-RECEIPT\/1:/,'');return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)?id:''}
