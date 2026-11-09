import {estimateCylinderOxygen,estimateHospitalOxygen,oxygenSections,type OxygenSection,type OxygenRow} from './hospital-oxygen';
import {hospitalNetworkRules,type HospitalNetwork} from './hospital-air-vacuum';

export type HtmSurveyRow={kind:OxygenSection;count:number;department?:string;air?:number;vacuum?:number};
export type HtmSurvey={method:'htm';rows:HtmSurveyRow[];air:boolean;vacuum:boolean;specialUse:'none'|'unknown'|'assessed';extraPeakLpm?:number;surgicalRooms?:number;otherSurgical?:boolean;dentalSurgical?:number;dentalAir?:number};
export type CylinderSurvey={method:'cylinder';rows:{volume:number;count:number}[];pressure:number;peakHours:number};
export type SurveyAnswers=HtmSurvey|CylinderSurvey;

const finite=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const count=(value:unknown,max=10000):value is number=>finite(value,0,max)&&Number.isInteger(value);
function invalid():never{throw Error('پاسخ‌های پرسش‌نامه یا محدودهٔ اعداد معتبر نیست.');}

export function normalizeSurvey(input:unknown):SurveyAnswers{
 if(!input||typeof input!=='object')invalid();
 const b=input as SurveyAnswers;
 if(!Array.isArray(b.rows)||b.rows.length<1||b.rows.length>100)invalid();
 if(b.method==='cylinder'){
  const {pressure,peakHours}=b;
  if(!finite(pressure,1,400)||!finite(peakHours,.01,24))invalid();
  const rows=b.rows.map(row=>{
   if(!row||!finite(row.volume,.1,1000)||!finite(row.count,.001,100000))invalid();
   return {volume:row.volume,count:row.count};
  });
  estimateCylinderOxygen(rows,pressure,peakHours);
  return {method:b.method,rows,pressure,peakHours};
 }
 if(b.method!=='htm'||typeof b.air!=='boolean'||typeof b.vacuum!=='boolean')invalid();
 const rows=b.rows.map(row=>{
  if(!row||!Object.hasOwn(oxygenSections,row.kind)||!count(row.count)||!row.count)invalid();
  if(row.department!==undefined&&(typeof row.department!=='string'||row.department.length>80||!['ward','dayWard','maternityWard'].includes(row.kind)))invalid();
  const item:HtmSurveyRow={kind:row.kind,count:row.count,...(row.department?{department:row.department.trim()}:{})};
  for(const network of ['air','vacuum'] as const satisfies readonly HospitalNetwork[]){
   const value=row[network];
   if(value===undefined)continue;
   if(!b[network]||!hospitalNetworkRules[network][row.kind]?.[0]||!count(value,row.count))invalid();
   item[network]=value;
  }
  return item;
 });
 const oxygenRows:OxygenRow[]=rows.map(({kind,count,department})=>({kind,count,...(kind!=='maternityWard'&&department?{department}:{})}));
 estimateHospitalOxygen({rows:oxygenRows,specialUse:b.specialUse,extraPeakLpm:b.extraPeakLpm});
 if(b.surgicalRooms!==undefined&&!count(b.surgicalRooms)||b.otherSurgical!==undefined&&typeof b.otherSurgical!=='boolean'||b.dentalSurgical!==undefined&&!finite(b.dentalSurgical,0,100000)||b.dentalAir!==undefined&&!count(b.dentalAir))invalid();
 return {method:b.method,rows,air:b.air,vacuum:b.vacuum,specialUse:b.specialUse,
  ...(b.extraPeakLpm!==undefined?{extraPeakLpm:b.extraPeakLpm}:{}),
  ...(b.surgicalRooms!==undefined?{surgicalRooms:b.surgicalRooms,otherSurgical:!!b.otherSurgical,dentalSurgical:b.dentalSurgical??0}:{}),
  ...(b.air&&b.dentalAir!==undefined?{dentalAir:b.dentalAir}:{})};
}
