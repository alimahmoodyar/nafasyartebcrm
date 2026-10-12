'use client';

export function SalesReferralFields({kind,value='',choices,disabled=false,onChange}:{kind?:string;value?:string;choices:{id:string;name:string}[];disabled?:boolean;onChange:(id:string)=>void}){
 const selected=choices.find(c=>c.id===value);
 const existing=<div className="notice wide"><p>این سفارش با معرف پورسانتی{selected?' «'+selected.name+'»':''} آماده شده است. پورسانت فقط طبق قرارداد مصوب و وصول وجه محاسبه می‌شود.</p><button type="button" className="btn" disabled={disabled} onClick={()=>onChange('')}>فروش مستقیم، بدون معرف</button></div>;
 // Ordinary representative, reseller and consignment orders do not ask for an intermediary.
 if(kind!=='end_customer')return value?existing:null;
 if(!choices.length||value&&!selected)return value?existing:null;
 return <details className="wide" open={value?true:undefined}><summary>معرف پورسانتی، فقط در فروش با واسطه</summary><p>اگر این مشتری مستقیماً خرید می‌کند، معرف انتخاب نکنید.</p><label className="field">معرف پورسانتی<select disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}><option value="">فروش مستقیم، بدون معرف</option>{choices.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></details>;
}
