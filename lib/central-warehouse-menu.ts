import {canAccessSection,warehouseNavigation} from './navigation-access';
import type {Session} from './permissions';
import {warehouseTarget} from './warehouse-workspace';

export type WarehouseMenuLink={title:string;section:string;target:string};
export type WarehouseMenu={id:string;title:string;links:WarehouseMenuLink[]};

export function centralWarehouseMenus(user:Session):WarehouseMenu[]{
 const entries=Object.values(warehouseNavigation(user)).flat();
 const byKey=new Map(entries.map(entry=>[entry.key,entry]));
 const entry=(key:string,title?:string,target=''):WarehouseMenuLink|undefined=>{
  const route=byKey.get(key);
  return route&&{title:title||route.title,section:'warehouse',target:warehouseTarget(route.source,target,route.view)};
 };
 const routine=canAccessSection(user,'routine-production')&&byKey.has('material-stock');
 const count=(title:string,target:string)=>routine?{title,section:'routine-production',target}:undefined;
 const group=(id:string,title:string,links:(WarehouseMenuLink|undefined)[]):WarehouseMenu=>({
  id,title,links:links.filter((link):link is WarehouseMenuLink=>!!link),
 });
 return [
  group('stock','موجودی و گردش کالا',[
   entry('material-stock','موجودی کالا'),entry('batches'),entry('finished-stock','موجودی محصول نهایی'),
  ]),
  group('operations','ورود و انتقال',[
   entry('receipts','دریافت کالا و ثبت رسید'),entry('finished-receive'),
   entry('receipts','جانمایی محموله','warehouse-menu:shelving'),entry('requests'),entry('move'),
  ]),
  group('supply','تأمین مواد',[
   entry('warehouse-supply','درخواست مستقیم تأمین','warehouse-menu:direct'),
   entry('warehouse-supply','نیازهای باز'),
   entry('warehouse-supply','سوابق و پیگیری تأمین','warehouse-menu:history'),
  ]),
  group('dispatch','سفارش‌های باز و ارسال',[
   entry('dispatch'),
   byKey.has('service-return-home')?{title:'آماده‌سازی قطعات خدمات خانگی',section:'after-sales',target:'service-orders:'}:undefined,
  ]),
  group('returns','برگشتی و نامنطبق',[
   count('برگشت مواد از خط','worker-custody:line-return'),
   entry('sales-returns'),entry('service-return-home','داغی و برگشتی خدمات'),
   count('درخواست فروش ضایعات','worker-custody:request-scrap-sale'),
  ]),
  group('counts','انبارگردانی و مغایرت‌ها',[
   count('دوره‌های باز شمارش','inventory-counts:open'),count('مغایرت‌ها و سوابق','inventory-counts:history'),
  ]),
  group('locations','شناسنامه و محل کالا',[
   entry('materials','شناسنامهٔ کالاها'),entry('materials','محل نگهداری کالا','warehouse-menu:locations'),
  ]),
 ].filter(menu=>menu.links.length);
}
