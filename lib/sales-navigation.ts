export type SalesMenuItem=[string,string];
type SalesNavigationContext={warehouseOnly?:boolean;roles:{agent?:boolean;staff?:boolean;finance?:boolean;manager?:boolean;leads?:boolean;viewer?:boolean;reportRead?:boolean;warehouse?:boolean}};

export function salesViewGroup(view:string,reportOnly=false){
 if(['reports','home','monitor','periodic'].includes(view)||reportOnly&&['orders','account','returns'].includes(view))return 'reports';
 if(['finance','new_payment','bank','account','opening'].includes(view))return 'finance';
 if(['settings','terms','targets','assignments','prices','resources','reward-quarter','reward-year','monitor_goals','monitor_settings'].includes(view))return 'settings';
 return '';
}

export function directSalesView(target:string,context:SalesNavigationContext){
 if(!target.startsWith('sales-view:'))return '';
 const view=target.slice('sales-view:'.length).split(':')[0];
 const navigation=salesNavigation(context);
 return [...navigation.main,...navigation.finance,...navigation.settings,...navigation.reports].some(([key])=>key===view)?view:'';
}

export function salesNavigation({warehouseOnly,roles}:SalesNavigationContext):{main:SalesMenuItem[];finance:SalesMenuItem[];settings:SalesMenuItem[];reports:SalesMenuItem[]}{
 if(warehouseOnly)return {main:[['returns','دریافت برگشتی']],finance:[],settings:[],reports:[]};
 const {agent:rep,staff,finance,manager,leads,viewer,reportRead}=roles;
 const reports:SalesMenuItem[]=[['home','عملکرد فروش'],...(!rep&&(staff||finance||viewer||reportRead)?[['monitor','هشدارها و پیگیری'] as SalesMenuItem]:[]),...(manager||reportRead?[['periodic','گزارش‌های دوره‌ای'] as SalesMenuItem]:[])];
 if(reportRead&&!rep&&!staff&&!finance&&!manager&&!roles.warehouse)return {main:[['reports','گزارش و پیگیری فروش']],finance:[],settings:[],reports};
 const financial:SalesMenuItem[]=[
  ...(!rep&&(manager||finance)?[['bank','پوز و تطبیق دریافت‌ها'] as SalesMenuItem]:[]),
  ...(rep||staff||finance?[['new_payment','اعلام پرداخت خریدار'] as SalesMenuItem]:[]),
  ['account','حساب و پرداخت'],
  ...(!rep&&(manager||finance)?[['opening','مانده‌های قبلی خریداران'] as SalesMenuItem]:[]),
 ];
 const settings:SalesMenuItem[]=[
  ...(!rep&&(manager||finance)?[['reward-quarter','هدف و پاداش فصلی'],['reward-year','هدف و پاداش سالانه']] as SalesMenuItem[]:[]),
  ...(staff||manager?[['resources','فایل‌های فروش و آموزش'] as SalesMenuItem]:[]),
  ...(manager?[['terms','الگوهای فروش'] as SalesMenuItem]:[]),
  ['targets','تارگت و تخفیف'],
  ...(manager?[['monitor_goals','اهداف مصوب فروش'],['monitor_settings','قواعد گزارش و هشدارها']] as SalesMenuItem[]:[]),
  ...(manager?[['assignments','تخصیص خریدار به کارشناس'] as SalesMenuItem]:[]),
  ...(!rep&&(manager||finance)?[['prices','قیمت فروش'] as SalesMenuItem]:[]),
 ];
 return {main:[
  ...(rep||staff?[['new_order','ثبت فروش جدید'] as SalesMenuItem]:[]),
  ...(leads?[['leads','سرنخ و فرصت فروش'] as SalesMenuItem]:[]),
  ['reports','گزارش و پیگیری فروش'],['orders','سفارش‌ها'],
  ['finance','مالی فروش'],['settings','تنظیمات فروش'],
  ['returns','برگشت کالا'],['profiles','خریداران و نمایندگان'],
 ],finance:financial,settings,reports};
}
