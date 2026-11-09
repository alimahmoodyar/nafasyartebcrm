import {groupedOxygenSections, type OxygenSection} from './hospital-oxygen';

type Rule=readonly [first:number, next:number];
export type HospitalNetwork='air'|'vacuum';
type Section=OxygenSection|'airDental';
type NetworkRow={kind:Section;count:number|null;department?:string};

// HTM 02-01 Part A (2006), Tables 18 and 21, diversified flow in L/min.
// A zero rule is a listed terminal whose flow is already covered elsewhere.
export const hospitalNetworkRules:Record<HospitalNetwork,Partial<Record<Section,Rule>>>={
 air:{
  ward:[20,2.5],dayWard:[20,2.5],resuscitation:[40,5],emergencyMajor:[40,5],emergencyRecovery:[40,10],
  anaesthesia:[0,0],theatre:[40,10],recovery:[40,2.5],maternityBaby:[40,10],
  maternityTheatre:[40,2.5],maternityRecovery:[40,10],neonatal:[40,40],radiology:[40,10],
  critical:[80,40],highDependency:[80,40],renal:[20,2.5],airDental:[40,20],equipment:[0,0],
 },
 vacuum:{
  ward:[40,0],dayWard:[40,0],resuscitation:[40,10],emergencyMajor:[40,10],
  emergencyRecovery:[40,10],emergencyTreatment:[40,5],anaesthesia:[0,0],theatre:[80,40],recovery:[40,10],
  maternityMother:[40,10],maternityBaby:[0,0],maternityTheatre:[80,40],maternityRecovery:[40,10],
  maternityWard:[40,0],nursery:[0,0],neonatal:[40,10],radiology:[40,5],critical:[40,10],
  highDependency:[40,10],renal:[40,10],ect:[40,10],ectRecovery:[40,10],acuteTreatment:[40,10],
  acuteRecovery:[40,5],dentalRecovery:[40,5],outpatient:[40,5],equipment:[0,0],
 },
};

export function estimateHospitalNetwork(network:HospitalNetwork,rows:readonly NetworkRow[]){
 const groups=new Map<string,number[]>();
 let subtotal=0;
 for(const row of rows){
  const rule=hospitalNetworkRules[network][row.kind];
  if(!rule)continue;
  if(row.count===null||!Number.isSafeInteger(row.count)||row.count<0)return null;
  if(!row.count)continue;
  const flow=rule[0]+(row.count-1)*rule[1];
  const grouped=groupedOxygenSections.some(kind=>kind===row.kind)||(network==='vacuum'&&row.kind==='maternityWard');
  const name=row.department?.normalize('NFKC').trim().replace(/\s+/g,' ');
  if(!grouped||!name){subtotal+=flow;continue;}
  const key=row.kind+':'+name;
  const existing=groups.get(key)||[];
  existing.push(flow);
  groups.set(key,existing);
 }
 for(const [key,flows] of groups){
  const largest=Math.max(...flows);
  if(network==='vacuum'){
   subtotal+=40+(flows.length-1)*(key.startsWith('maternityWard:')?20:10);
  }else{
   // For unequal ward sizes, use the largest ward as the reference unit.
   subtotal+=largest*(1+(flows.length-1)/2);
  }
 }
 return subtotal;
}

/** Table 20 leaves exactly four operating rooms unclassified. */
export function estimateSurgicalAir(rooms:number,other:boolean,dentalLpm:number){
 if(!Number.isSafeInteger(rooms)||rooms<0||rooms===4||!Number.isFinite(dentalLpm)||dentalLpm<0)return null;
 return (rooms?350+(rooms-1)*350/(rooms<4?2:4):0)+(other?350:0)+dentalLpm;
}
