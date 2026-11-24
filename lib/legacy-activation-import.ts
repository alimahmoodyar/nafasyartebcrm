import {asciiDigits} from './batch-number';

export const legacyActivationChunkSize=400;
export const legacyActivationType='legacy_activation_event';
export const legacyAgencyType='legacy_activation_agency';
export type LegacyActivation={
 activeId:string;activeDate:string;status:string;channel:string;
 serial:string;deviceSetSerial:string;setId:string;setSerial:string;
 agencyId:string;agencyCode:string;agencyName:string;
};
export type LegacyPreview={activeId:string;status:'same'|'conflict';existing?:LegacyActivation};
export type LegacyAgency={id:string;salesId:string;revision:number};
export type LegacySalesAgent={id:string;name:string;code:string;city:string};

const text=(value:unknown,max:number)=>asciiDigits(typeof value==='string'||typeof value==='number'?String(value).trim():'').slice(0,max);
const digits=(value:unknown)=>{const id=text(value,40);return /^[0-9]{1,20}$/.test(id)&&/[1-9]/.test(id)?id.replace(/^0+/,''):'';};
const serial=(value:unknown)=>text(value,160).toUpperCase();
const activationDate=(value:unknown)=>{
 const raw=value instanceof Date&&Number.isFinite(+value)?value.toISOString():text(value,25);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw))return '';
 const date=new Date(raw);
 return Number.isFinite(+date)&&date.toISOString()===raw?raw:'';
};
export function cleanLegacyActivation(value:unknown):LegacyActivation|null{
 if(!value||typeof value!=='object')return null;
 const r=value as Record<string,unknown>;
 const activeId=digits(r.activeId),activeDate=activationDate(r.activeDate),status=text(r.status,10),channel=text(r.channel,20),agencyId=digits(r.agencyId);
 if(!activeId||!activeDate||!['0','1'].includes(status)||text(r.agencyId,40)&&!agencyId)return null;
 return {activeId,activeDate,status,channel,serial:serial(r.serial),deviceSetSerial:serial(r.deviceSetSerial),
  setId:digits(r.setId),setSerial:serial(r.setSerial),agencyId,agencyCode:text(r.agencyCode,80),agencyName:text(r.agencyName,200)};
}
export function legacyActivationKey(row:LegacyActivation){
 return JSON.stringify([row.activeDate,row.status,row.channel,row.serial,row.deviceSetSerial,row.setId,row.setSerial,row.agencyId]);
}
export function legacyActivationWarnings(row:LegacyActivation){
 return [...(row.activeDate.startsWith('1900-')?['تاریخ پایهٔ سیستم قبلی']:[]),...(!row.serial?['سریال کامل ندارد']:[])];
}
export function parseLegacyWorkbook(rows:unknown[][]){
 const headers=rows[0]?.map(value=>String(value??'').trim().toLowerCase())||[];
 const positions=['activeId','activeDate','activeStatus','activeChannel','DeviceFullSerial','DeviceSetSerial','SetId','SetSerial','AgencyId','AgencyCode','AgencyName'].map(key=>headers.indexOf(key.toLowerCase()));
 if(positions.some(i=>i<0))throw Error('ستون‌های خروجی ActivationFull پیدا نشد. خروجی اصلی سیستم قبلی را انتخاب کنید.');
 const unique=new Map<string,LegacyActivation>(),conflicts=new Map<string,LegacyActivation[]>();
 const invalid:number[]=[];
 let repeated=0,total=0;
 for(const [index,line] of rows.slice(1).entries()){
  const cells=positions.map(pos=>line[pos]);
  if(cells.every(value=>value===undefined||value===null||value===''))continue;
  total++;
  const [activeId,activeDate,status,channel,serial,deviceSetSerial,setId,setSerial,agencyId,agencyCode,agencyName]=cells;
  const row=cleanLegacyActivation({activeId,activeDate,status,channel,serial,deviceSetSerial,setId,setSerial,agencyId,agencyCode,agencyName});
  if(!row){invalid.push(index+2);continue;}
  const previous=unique.get(row.activeId);
  if(!previous){unique.set(row.activeId,row);continue;}
  const others=conflicts.get(row.activeId)||[previous];
  if(others.some(other=>legacyActivationKey(other)===legacyActivationKey(row))){repeated++;continue;}
  others.push(row);
  conflicts.set(row.activeId,others);
 }
 return {total,repeated,invalid,conflicts,events:[...unique.values()].filter(row=>!conflicts.has(row.activeId))};
}
