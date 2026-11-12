// Match server quantities (thousandths) and integer-rial ceiling; never use floating money.
export function partQuantity(value:unknown):bigint|null {
 const s=String(value??'');if(!/^\d{1,9}(\.\d{1,3})?$/.test(s))return null;
 const [whole,fraction='']=s.split('.'),q=BigInt(whole)*BigInt(1000)+BigInt(fraction.padEnd(3,'0'));
 return q>BigInt(0)?q:null;
}
export function partLineTotal(price:unknown,quantity:unknown):string|null {
 const q=partQuantity(quantity),p=String(price??'');
 return q&&/^\d{1,18}$/.test(p)?((BigInt(p)*q+BigInt(999))/BigInt(1000)).toString():null;
}
export function stepPartQuantity(value:unknown,delta:1|-1):string {
 const n=(partQuantity(value)||BigInt(0))+BigInt(delta)*BigInt(1000);
 if(n<=BigInt(0))return '0';if(n>BigInt('999999999999'))return String(value);
 return (n/BigInt(1000)).toString()+(n%BigInt(1000)?'.'+(n%BigInt(1000)).toString().padStart(3,'0').replace(/0+$/,''):'');
}
