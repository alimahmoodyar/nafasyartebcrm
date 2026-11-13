import {batchScanCode} from './batch-qr';
const batchPattern=/^\d{2,12}-\d{8}-\d{3,16}$/;
export function incomingQcCode(raw:string,origin:string):string{
 if(typeof raw!=='string'||raw.length>3000)return '';
 const value=raw.replace(/\r\n?/g,'\n').trim();
 if(/^https?:\/\//i.test(value)){try{const u=new URL(value),base=new URL(origin),code=decodeURIComponent(u.pathname.replace(/^\/b\//,''));return u.origin===base.origin&&u.pathname.startsWith('/b/')&&batchPattern.test(code)?code:''}catch{return ''}}
 const code=batchScanCode(value);if(!batchPattern.test(code))return '';
 // Rich legacy labels retain all agreed public fields. Their trailing link must
 // identify the same batch; QR text grants no authority and never navigates out.
 if(value.startsWith('NAFASYAR-BATCH/1\n')){const links=value.split(/\r?\n/).filter(s=>/^https?:\/\//i.test(s));if(links.length!==1||incomingQcCode(links[0],origin)!==code)return '';}
 return code;
}
