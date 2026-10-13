export type SalesMenuItem=[string,string];
type SalesNavigationContext={warehouseOnly?:boolean;roles:{agent?:boolean;staff?:boolean;finance?:boolean;manager?:boolean;leads?:boolean}};

export function salesViewGroup(view:string){
 if(['finance','new_payment','bank','account'].includes(view))return 'finance';
 if(['settings','terms','targets'].includes(view))return 'settings';
 return '';
}

export function salesNavigation({warehouseOnly,roles}:SalesNavigationContext):{main:SalesMenuItem[];finance:SalesMenuItem[];settings:SalesMenuItem[]}{
 if(warehouseOnly)return {main:[['returns','دریافت برگشتی']],finance:[],settings:[]};
 const {agent:rep,staff,finance,manager,leads}=roles;
 const financial:SalesMenuItem[]=[
  ...(!rep&&(manager||finance)?[['bank','پوز و تطبیق دریافت‌ها'] as SalesMenuItem]:[]),
  ...(rep||staff||finance?[['new_payment','اعلام پرداخت خریدار'] as SalesMenuItem]:[]),
  ['account','حساب و پرداخت'],
 ];
 const settings:SalesMenuItem[]=[
  ...(manager?[['terms','الگوهای فروش'] as SalesMenuItem]:[]),
  ['targets','تارگت و تخفیف'],
 ];
 return {main:[
  ...(rep||staff?[['new_order','ثبت فروش جدید'] as SalesMenuItem]:[]),
  ...(leads?[['leads','سرنخ و فرصت فروش'] as SalesMenuItem]:[]),
  ...(!rep&&(staff||finance)?[['monitor','گزارش مدیر و هشدارها'] as SalesMenuItem]:[]),
  ...(manager?[['assignments','تخصیص خریدار به کارشناس'] as SalesMenuItem]:[]),
  ['home',rep?'نمای من':'گزارش فروش'],['orders','سفارش‌ها'],
  ['finance','مالی فروش'],['settings','تنظیمات فروش'],
  ['returns','برگشت کالا'],['profiles','خریداران و نمایندگان'],
  ...(!rep&&(manager||finance)?[['setup','قیمت و افتتاحیه'] as SalesMenuItem]:[]),
 ],finance:financial,settings};
}
