import {batchScanCode} from './batch-qr';
import {asciiDigits} from './batch-number';
export type TransportScanItem={deviceId?:string;serial?:string;partCode?:string;batchId?:string;batchCode?:string;model?:string;name?:string;quantity?:number;unit?:string};
export function normalizeTransportScan(value:string){
 if(typeof value!=='string'||value.length>3000)return '';
 let code=batchScanCode(value).trim();
 if(/^https?:\/\//i.test(code))try{const path=new URL(code).pathname.match(/^\/b\/([^/]+)\/?$/);if(!path)return '';code=decodeURIComponent(path[1])}catch{return ''}
 return asciiDigits(code).trim().toUpperCase();
}
export function transportScanMatches(items:TransportScanItem[],raw:string){
 const code=normalizeTransportScan(raw);if(!code)return [];
 // Prefer a unique serial or batch over a product code shared by several lots.
 const exact=items.flatMap((item,index)=>[item.serial,item.batchCode,item.batchId,item.deviceId].some(value=>value&&normalizeTransportScan(value)===code)?[index]:[]);
 return exact.length?exact:items.flatMap((item,index)=>item.partCode&&normalizeTransportScan(item.partCode)===code?[index]:[]);
}
