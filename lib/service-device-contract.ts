// Permanent device identity, independent of a repair visit. Never contains customer data.
export function serviceDeviceSerial(raw:string){return raw.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim().toUpperCase();}
export const serviceDeviceQr=(serial:string)=>'NAFASYAR-DEVICE/1:'+encodeURIComponent(serviceDeviceSerial(serial));
export function parseServiceDeviceQr(raw:string){try{if(!raw.trim().startsWith('NAFASYAR-DEVICE/1:'))return null;const serial=serviceDeviceSerial(decodeURIComponent(raw.trim().slice('NAFASYAR-DEVICE/1:'.length)));return serial&&serial.length<=160&&!/[\x00-\x1f]/.test(serial)?serial:null}catch{return null}}
