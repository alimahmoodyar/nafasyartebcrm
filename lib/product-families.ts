// Keep the existing group value so pricing policies and history stay linked.
export const defaultProductFamilies=['اکسیژن‌ساز','کمپرسور','تخت بیمارستانی','سایر تجهیزات پزشکی'];
export function productFamilyValues(existing:unknown[]=[]){
 const legacy=existing.filter((v):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=4000);
 return [...new Set([...defaultProductFamilies,...legacy])];
}
