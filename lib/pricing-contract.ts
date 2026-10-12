import {MICRO,moneyMicro} from './costing';
export const pricingKinds:Record<string,string>={representative:'نماینده',reseller:'عامل فروش',branch:'شعبه',end_customer:'مصرف‌کننده'};
const ceil=(n:bigint,d:bigint)=>(n+d-BigInt(1))/d;
export function suggestedPrice(cost:string,targetBps:number,minBps:number,discountBps:number,roundTo:number){
 if(!Number.isSafeInteger(targetBps)||targetBps<0||targetBps>100000||!Number.isSafeInteger(minBps)||minBps<0||minBps>targetBps||!Number.isSafeInteger(discountBps)||discountBps<0||discountBps>9000||!Number.isSafeInteger(roundTo)||roundTo<1||roundTo>1000000)throw Error('الگوی سود، تخفیف یا گردکردن معتبر نیست.');
 const c=moneyMicro(cost);if(c<=BigInt(0))throw Error('بهای مثبت لازم است.');
 const net=ceil(c*BigInt(10000+targetBps),BigInt(10000)*MICRO),step=BigInt(roundTo),price=ceil(net*BigInt(10000),BigInt(10000-discountBps)*step)*step;
 if(price>BigInt('999999999999999999'))throw Error('قیمت پیشنهادی از سقف ریالی مجاز بیشتر است.');
 const actualNet=price*BigInt(10000-discountBps)/BigInt(10000),minimumNet=ceil(c*BigInt(10000+minBps),BigInt(10000)*MICRO);
 return {unitPrice:String(price),unitNet:String(actualNet),minimumNet:String(minimumNet),profitBps:Number((actualNet*MICRO-c)*BigInt(10000)/c)};
}
export function approvedCostPrice(rows:any[],productId:string,kind:string,today:string){return rows.filter(r=>r.type==='sales_price'&&r.data.pricingApprovalId&&r.data.active&&r.data.productId===productId&&r.data.kind===kind&&r.data.effectiveFrom<=today).sort((a,b)=>b.data.effectiveFrom.localeCompare(a.data.effectiveFrom)||b.created.localeCompare(a.created)||b.id.localeCompare(a.id))[0];}
