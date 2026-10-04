export const serviceProvinces=['آذربایجان شرقی','آذربایجان غربی','اردبیل','اصفهان','البرز','ایلام','بوشهر','تهران','چهارمحال و بختیاری','خراسان جنوبی','خراسان رضوی','خراسان شمالی','خوزستان','زنجان','سمنان','سیستان و بلوچستان','فارس','قزوین','قم','کردستان','کرمان','کرمانشاه','کهگیلویه و بویراحمد','گلستان','گیلان','لرستان','مازندران','مرکزی','هرمزگان','همدان','یزد'];
export const geoText=(v:unknown)=>typeof v==='string'?v.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\s]+/g,' ').trim():'';
export function serviceProvince(v:unknown){if(v===undefined||v==='')return '';if(typeof v!=='string'||!serviceProvinces.includes(geoText(v)))throw Error('استان را از فهرست انتخاب کنید.');return geoText(v);}
export type Coverage={province:string;allCities:boolean;cities:string};
export function coverageRows(v:unknown):Coverage[]{
 if(v===undefined)return [];if(!Array.isArray(v)||v.length>31)throw Error('حداکثر ۳۱ محدوده استانی مجاز است.');
 const seen=new Set<string>();return v.map(r=>{const province=serviceProvince(r?.province);if(!province||seen.has(province))throw Error('استان هر محدوده باید مشخص و غیرتکراری باشد.');seen.add(province);
 if(typeof r.allCities!=='boolean'||typeof r.cities!=='string'||r.cities.length>2000)throw Error('شهرهای محدوده معتبر نیستند.');
 const cities=[...new Set(r.cities.split(/[,،;؛\n]/).map(geoText).filter(Boolean))];if(!r.allCities&&!cities.length)throw Error('شهرها را بنویسید یا تمام شهرهای استان را انتخاب کنید.');
 return {province,allCities:r.allCities,cities:r.allCities?'':cities.join('، ')};});
}
export function suggestedServiceAgents(agents:any[],domain:string,province:string,city:string){
 if(!province)return [];return agents.filter(a=>a.data.active&&a.data.domain===domain&&(a.data.coverage||[]).some((c:Coverage)=>c.province===province&&(c.allCities||!!geoText(city)&&c.cities.split(/[,،;؛\n]/).some(x=>geoText(x)===geoText(city))))).map(a=>({id:a.id,name:a.data.name,province:a.data.province||'',city:a.data.city}));
}
