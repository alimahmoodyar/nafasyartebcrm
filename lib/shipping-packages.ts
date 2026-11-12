export type ShippingPackage={id:string;number:number;productId:string;capacity:number;deviceIds:string[];serials:string[];model:string};
export const shippingQr=(saleId:string,packageId:string)=>'NAFASYAR-SHIP/1:'+encodeURIComponent(saleId)+':'+packageId;
export function parseShippingQr(raw:string){
 if(typeof raw!=='string'||raw.length>700)throw Error('کد بسته معتبر نیست.');
 const m=raw.trim().match(/^NAFASYAR-SHIP\/1:(.+):([a-f0-9-]{36})$/i);
 if(!m)throw Error('QR بستهٔ ارسال محصول را اسکن کنید.');
 const saleId=decodeURIComponent(m[1]);if(!saleId||saleId.length>200)throw Error('شناسه حواله معتبر نیست.');
 return {saleId,packageId:m[2]};
}
export function packageCapacity(value:unknown){
 const n=value===undefined||value===''?1:Number(value);
 if(!Number.isSafeInteger(n)||n<1||n>100)throw Error('ظرفیت هر بسته باید عدد صحیح بین ۱ و ۱۰۰ باشد.');
 return n;
}
export function splitShippingPackages(items:{deviceId:string;serial:string;productId:string;model:string;capacity:unknown}[],uuid:()=>string){
 if(!items.length||items.length>100||new Set(items.map(i=>i.deviceId)).size!==items.length)throw Error('بین ۱ تا ۱۰۰ دستگاه غیرتکراری انتخاب کنید.');
 const groups=new Map<string,typeof items>();for(const item of items)groups.set(item.productId,[...(groups.get(item.productId)||[]),item]);
 const out:ShippingPackage[]=[];
 for(const [productId,rows] of groups){const capacity=packageCapacity(rows[0].capacity);for(let i=0;i<rows.length;i+=capacity){const part=rows.slice(i,i+capacity);out.push({id:uuid(),number:out.length+1,productId,capacity,deviceIds:part.map(r=>r.deviceId),serials:part.map(r=>r.serial),model:part[0].model});}}
 return out;
}
export function packageReceiptSelection(all:string[],previous:string[],chosen:unknown,scope?:string[]){
 const remaining=all.filter(id=>!previous.includes(id)),allowed=scope?remaining.filter(id=>scope.includes(id)):remaining;
 if(!Array.isArray(chosen)||new Set(chosen).size!==chosen.length||chosen.some(id=>typeof id!=='string'||!allowed.includes(id)))throw Error('سریال‌های این نوبت باید از ماندهٔ همین بسته باشند.');
 return {chosen:chosen as string[],pending:remaining.filter(id=>!chosen.includes(id)),missing:allowed.filter(id=>!chosen.includes(id))};
}

// Authorization uses authenticated carrier identity, not possession of the QR.
export function assignedPackageDriver(u:{isAdmin:boolean;userId:string;permissions:any},sale:any,mission?:any){
 if(u.isAdmin)return true;
 if(!u.permissions.transportRoles?.includes('driver')&&!u.permissions.flowRoles?.includes('logistics'))return false;
 if(!['local:'+sale.carrierId,sale.carrierSubject].includes(u.userId))return false;
 return !mission?.driverId||mission.driverId===sale.carrierId;
}
