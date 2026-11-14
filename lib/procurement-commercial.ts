/** Agreed procurement policy; exact integer rials, never tax-credit assumptions. */
export function money(value:unknown){const s=String(value??'');if(!/^\d{1,18}$/.test(s))throw Error('مبلغ ریالی نامنفی لازم است.');return BigInt(s);}
export function percentage(value:unknown){const s=String(value??'');if(!/^\d{1,3}(\.\d{1,2})?$/.test(s)||Number(s)>100)throw Error('درصد از صفر تا صد با حداکثر دو اعشار لازم است.');return Math.round(Number(s)*100);}
export function commercialTerms(b:any,base:string){
 if(!['yes','no','unknown'].includes(b.officialInvoice))throw Error('تعهد صورتحساب رسمی را مشخص کنید.');
 if(!['known','exempt','unknown'].includes(b.taxStatus)||!['included','separate','unknown'].includes(b.extraStatus))throw Error('وضعیت مالیات و هزینه‌ها را مشخص کنید.');
 const rate=b.taxStatus==='known'?percentage(b.taxRate):0;
 const net=money(base),discount=money(b.discountRial||'0');if(discount>net)throw Error('تخفیف بیشتر از مبلغ کالا است.');
 const taxable=net-discount,tax=(taxable*BigInt(rate)+BigInt(9999))/BigInt(10000);
 const extra=b.extraStatus==='separate'?money(b.otherCostsRial):BigInt(0);
 return {commercialVersion:3,officialInvoice:b.officialInvoice,taxStatus:b.taxStatus,taxRate:String(rate/100),taxRial:tax.toString(),baseRial:net.toString(),discountRial:discount.toString(),extraStatus:b.extraStatus,otherCostsRial:extra.toString(),costsComplete:b.taxStatus!=='unknown'&&b.extraStatus!=='unknown',totalRial:(taxable+tax+extra).toString()};
}
export function deltaPercent(current:string,previous:string){const a=money(current),b=money(previous);if(!b)return null;const negative=a<b,n=(negative?b-a:a-b)*BigInt(10000)/b;return (negative?'-':'')+String(n/BigInt(100))+'.'+String(n%BigInt(100)).padStart(2,'0');}
export function rankCommercial(quotes:any[]){
 const sorted=[...quotes].sort((a,b)=>{const x=money(a.data.totalRial),y=money(b.data.totalRial);if(x!==y)return x<y?-1:1;for(const key of ['qualityRatio','deliveryRatio']){if(a.data[key]!=null&&b.data[key]!=null&&a.data[key]!==b.data[key])return b.data[key]-a.data[key];}return String(a.id).localeCompare(String(b.id));});
 const plain=sorted.find(q=>q.data.officialInvoice==='no'),official=sorted.find(q=>q.data.officialInvoice==='yes');
 if(plain&&official&&money(plain.data.totalRial)>BigInt(0)&&money(official.data.totalRial)*BigInt(100)<money(plain.data.totalRial)*BigInt(115)){sorted.splice(sorted.indexOf(official),1);sorted.unshift(official);}
 return sorted;
}
export const recommendationReason='انطباق نیاز و موعد؛ هزینه نهایی کف کارخانه، با اولویت صورتحساب رسمی در اختلاف کمتر از ۱۵٪ شامل مالیات و همه هزینه‌ها';
export function decimalUnits(value:unknown){const s=String(value??'');if(!/^\d{1,15}(\.\d{1,3})?$/.test(s))throw Error('عدد نامنفی با حداکثر سه اعشار لازم است.');const [i,d='']=s.split('.');return BigInt(i)*BigInt(1000)+BigInt(d.padEnd(3,'0'));}
export function decimalText(n:bigint){const sign=n<BigInt(0)?'-':'';if(n<BigInt(0))n=-n;return sign+String(n/BigInt(1000))+'.'+String(n%BigInt(1000)).padStart(3,'0');}
export function negotiationPreview(unitPrice:string,discount:string,quantity:number){const old=decimalUnits(unitPrice),rate=percentage(discount);const next=old*BigInt(10000-rate)/BigInt(10000);return {unitPrice:decimalText(next),saving:decimalText((old-next)*BigInt(quantity)/BigInt(1000))};}

export function paymentStages(input:any,total:string){if(input===undefined)return undefined;if(!Array.isArray(input)||input.length<1||input.length>12)throw Error('برنامه پرداخت باید ۱ تا ۱۲ مرحله داشته باشد.');let sum=0,allocated=BigInt(0);const rows=input.map((x:any,i:number)=>{const rate=percentage(x.percent),days=Number(x.days);if(!rate||!Number.isInteger(days)||days<0||days>3650||typeof x.condition!=='string'||!x.condition.trim())throw Error('درصد، روز و شرط هر مرحله پرداخت لازم است.');sum+=rate;const amount=i===input.length-1?money(total)-allocated:money(total)*BigInt(rate)/BigInt(10000);allocated+=amount;return {percent:String(rate/100),days,condition:x.condition.trim().slice(0,1000),amountRial:amount.toString()};});if(sum!==10000)throw Error('جمع درصد مراحل پرداخت باید ۱۰۰ باشد.');return rows;}
