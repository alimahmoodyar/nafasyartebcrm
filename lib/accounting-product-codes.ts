import {AccessError} from './authorization';
import {accountingAccessGuard} from './accounting-access';
import {accountingRoles} from './accounting-contract';
import type {Session} from './permissions';
import {storage} from './storage';
import {trainingContext} from './training-context';

const pageSize=50;
const exportLimit=10000;
const accountingCode="COALESCE(json_extract(payload,'$.accountingCode'),'')";
const selectRows=`SELECT id,json_extract(payload,'$.name') AS name,
 json_extract(payload,'$.code') AS internalCode,${accountingCode} AS accountingCode
 FROM records WHERE kind='product' ORDER BY id LIMIT ? OFFSET ?`;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
type ProductCodeRow={id:string;name:string;internalCode:string;accountingCode:string};

async function authorizedCatalog(user:Session){
 if(!accountingRoles(user).read||trainingContext.getStore())throw new AccessError('دسترسی خروجی کدهای حسابداری ندارید.',403);
 const db=storage();
 await accountingAccessGuard(db,user,'read');
 return db;
}

export async function accountingProductCodePreview(user:Session,query:URLSearchParams){
 const db=await authorizedCatalog(user),offset=Number(query.get('offset')||'0');
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw new AccessError('صفحه فهرست معتبر نیست.',400);
 const [page,counts]=await Promise.all([
  db.prepare(selectRows).bind(pageSize+1,offset).all<ProductCodeRow>(),
  db.prepare(`SELECT COUNT(*) AS total,COUNT(CASE WHEN trim(${accountingCode})='' THEN 1 END) AS missing
   FROM records WHERE kind='product'`).first<{total:number;missing:number}>()
 ]);
 return Response.json({rows:page.results.slice(0,pageSize),offset,nextOffset:page.results.length>pageSize?offset+pageSize:null,total:counts?.total??0,missing:counts?.missing??0},{headers});
}

export async function accountingProductCodeWorkbook(user:Session){
 const db=await authorizedCatalog(user);
 const {results}=await db.prepare(selectRows).bind(exportLimit+1,0).all<ProductCodeRow>();
 if(results.length>exportLimit)throw new AccessError('تعداد محصولات برای یک فایل بیش از سقف خروجی است.',400);
 const XLSX=await import('xlsx');
 const data=[['نام محصول','کد داخلی هم‌نفس','کد کالا'],...results.map(row=>[String(row.name||''),String(row.internalCode||''),String(row.accountingCode||'')])];
 const sheet=XLSX.utils.aoa_to_sheet(data);
 sheet['!cols']=[{wch:35},{wch:24},{wch:28}];
 const workbook=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook,sheet,'کدهای کالا');
 const bytes=XLSX.write(workbook,{type:'array',bookType:'xlsx'});
 return new Response(bytes,{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="product-accounting-codes.xlsx"'}});
}
