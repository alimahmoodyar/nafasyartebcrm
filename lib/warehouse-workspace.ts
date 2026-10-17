export const warehouseLegacySections=['flow','inventory','batch','fulfillment'] as const;
export type WarehouseEntry={key:string;title:string;source:string;view:string};
export const warehouseGroupTitles:Record<string,string>={tasks:'کارتابل انبار',stock:'موجودی و گردش کالا',operations:'ورود و انتقال',receive:'دریافت کالا',issue:'حواله و انتقال',dispatch:'آماده‌سازی سفارش',returns:'برگشتی و نامنطبق',settings:'تنظیمات انبار'};
export function warehouseTarget(source:string,target='',view=''){
 return 'warehouse:'+JSON.stringify({source,target,view});
}
export function parseWarehouseTarget(value:string){
 try{const v=JSON.parse(value.slice('warehouse:'.length));if(value.startsWith('warehouse:')&&typeof v.source==='string'&&typeof v.target==='string'&&typeof v.view==='string')return v as {source:string;target:string;view:string};}catch{}
 return null;
}
