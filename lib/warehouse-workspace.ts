export const warehouseLegacySections=['flow','inventory','batch','fulfillment'] as const;
export type WarehouseEntry={key:string;title:string;source:string;view:string};
export const warehouseGroupTitles:Record<string,string>={tasks:'کارتابل انبار',stock:'موجودی',operations:'ورود و انتقال',receive:'دریافت کالا',issue:'حواله و انتقال',dispatch:'سفارش‌های ارسال',returns:'برگشتی و نامنطبق',settings:'تنظیمات انبار'};
export function warehouseTarget(source:string,target='',view=''){
 return 'warehouse:'+JSON.stringify({source,target,view});
}
export function parseWarehouseTarget(value:string){
 try{const v=JSON.parse(value.slice('warehouse:'.length));if(value.startsWith('warehouse:')&&typeof v.source==='string'&&typeof v.target==='string'&&typeof v.view==='string')return v as {source:string;target:string;view:string};}catch{}
 return null;
}

export function stockHistoryTarget(item:{kind:string;itemCode?:string;entries?:any[]}){
 const filter=item.itemCode?.trim()?{kind:item.kind,code:item.itemCode}:{itemId:item.entries?.[0]?.item_id||''};
 return warehouseTarget('batch','history:'+JSON.stringify(filter),'batches');
}
export function parseStockHistory(value:string){
 if(!value.startsWith('history:'))return {};
 try{const v=JSON.parse(value.slice(8));if(!v||typeof v!=='object'||Array.isArray(v))return {};const out:Record<string,string>={};for(const key of ['kind','code','itemId'])if(typeof v[key]==='string'&&v[key].length<=200)out[key]=v[key];return out;}catch{return {};}
}
