// Consumer estimates and representative invoices have independent approved prices.
// Pure helpers are shared with the forms; missing prices are never interpreted as zero.
export type ServicePartPriceKind='consumer'|'representative';
const priceField=(kind:ServicePartPriceKind)=>kind==='consumer'?'consumerPriceRial':'priceRial';
export function servicePriceValue(value:unknown):string|null {
 if(typeof value!=='string'||!/^\d{1,18}$/.test(value))return null;
 return BigInt(value).toString();
}
export const consumerTariffValue=(tariff:any)=>servicePriceValue((tariff?.data||tariff)?.consumerPriceRial);
export const representativeTariffValue=(tariff:any)=>servicePriceValue((tariff?.data||tariff)?.priceRial);
export const hasRepresentativePrice=(tariff:any)=>representativeTariffValue(tariff)!==null;
const compare=(a:string,b:string)=>a>b?1:a<b?-1:0;
export function selectServicePartTariff(tariffs:any[],partCode:string,day:string,domain:string|undefined,kind:ServicePartPriceKind):any|null {
 return tariffs.filter(t=>{const d=t.data||{};return (!domain||d.domain===domain)&&d.kind==='part'&&d.partCode===partCode&&d.active===true&&typeof d.validFrom==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.validFrom)&&d.validFrom<=day&&servicePriceValue(d[priceField(kind)])!==null;})
  .sort((a,b)=>compare(b.data.validFrom,a.data.validFrom)||compare(String(b.created||''),String(a.created||''))||compare(String(b.id),String(a.id)))[0]||null;
}
export const selectConsumerPartTariff=(tariffs:any[],partCode:string,day:string,domain?:string)=>selectServicePartTariff(tariffs,partCode,day,domain,'consumer');
export const selectRepresentativePartTariff=(tariffs:any[],partCode:string,day:string,domain?:string)=>selectServicePartTariff(tariffs,partCode,day,domain,'representative');
// Protect both the selected revision and a concurrent insertion of a newer price.
// The null case protects the legacy manual estimate from a concurrently published rate.
export function servicePartTariffGuard(tariff:any|null,partCode:string,day:string,domain:string,kind:ServicePartPriceKind):{sql:string;args:any[]} {
 const field="json_extract(data,'$."+priceField(kind)+"')";
 const eligible="type='as_tariff' AND json_extract(data,'$.domain')=? AND json_extract(data,'$.kind')='part' AND json_extract(data,'$.partCode')=? AND json_extract(data,'$.active')=1 AND json_extract(data,'$.validFrom')<=? AND "+field+" IS NOT NULL AND typeof("+field+")='text' AND length("+field+") BETWEEN 1 AND 18 AND "+field+" NOT GLOB '*[^0-9]*'";
 const args:any[]=[domain,partCode,day];
 if(!tariff)return {sql:'NOT EXISTS(SELECT 1 FROM flow_entities WHERE '+eligible+')',args};
 return {sql:"EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND NOT EXISTS(SELECT 1 FROM flow_entities WHERE "+eligible+" AND (json_extract(data,'$.validFrom')>? OR (json_extract(data,'$.validFrom')=? AND (created>? OR (created=? AND id>?)))))",args:[tariff.id,tariff.revision,...args,tariff.data.validFrom,tariff.data.validFrom,tariff.created,tariff.created,tariff.id]};
}
