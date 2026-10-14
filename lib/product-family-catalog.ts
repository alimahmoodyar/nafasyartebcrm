import {storage} from './storage';
import {AccessError} from './authorization';
import {productFamilyValues} from './product-families';
export async function productFamilyCatalog(){
 const rows=await storage().prepare("SELECT DISTINCT json_extract(payload,'$.group') AS family FROM records WHERE kind='product' ORDER BY family").all();
 return productFamilyValues(rows.results.map((row:any)=>row.family));
}
export async function validateProductFamily(value:unknown){
 if(typeof value!=='string'||!(await productFamilyCatalog()).includes(value))throw new AccessError('خانواده محصول را از فهرست انتخاب کنید؛ در صورت تغییر فهرست، صفحه را تازه کنید.',400);
}
