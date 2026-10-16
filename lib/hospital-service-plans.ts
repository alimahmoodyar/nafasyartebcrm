export type HospitalServicePlan={id:string;intervalHours:number;lines:{partCode:string;technicalCode:string;quantity:number}[]};
export const hospitalPlanTitle=(p:any)=>'سرویس '+Number(p.intervalHours).toLocaleString('fa-IR')+' ساعته';
export function hospitalPlanList(data:any):HospitalServicePlan[]{return Array.isArray(data?.servicePlans)?data.servicePlans:[];}
export function hospitalCoveredPlans(plans:HospitalServicePlan[],selected:HospitalServicePlan){
 // A larger service has its complete parts list; the complete smaller services are included.
 return plans.filter(p=>p.intervalHours<=selected.intervalHours).map(p=>p.id);
}
export function hospitalServicePlanSnapshot(plans:HospitalServicePlan[],id:string){
 const plan=plans.find(p=>p.id===id);if(!plan)throw Error('بازه سرویس همین دستگاه را انتخاب کنید.');
 return {planId:plan.id,intervalHours:plan.intervalHours,coveredPlanIds:hospitalCoveredPlans(plans,plan),lines:structuredClone(plan.lines),quantityBasis:'device_total'};
}
