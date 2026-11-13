export type SourcingReviewWorkspace='engineering'|'finance';
export const sourcingReviewModes=['technical','financial_review','finance','issue_order'];
export function sourcingReviewDestination(role:string,planId:string){
 return {section:role==='engineering'?'qms':'finance-control',target:'sourcing:'+planId};
}
export function sourcingStepDestination(step:any,planId:string){
 if(step.key?.startsWith('technical:')||(step.role==='finance'&&!['urgent_finance:','delivery_alert:','supplier_credit:'].some(prefix=>step.key?.startsWith(prefix)))){
  const d=sourcingReviewDestination(step.role,planId);return {...step,sourceSection:d.section,sourceId:d.target};
 }
 if(['financial_return:','ceo_return:','order_terms:','delivery_extension:','delivery_reminder:','delivery_alert:','replacement:','purchase_receipt_notice:','purchase_quality_notice:'].some(prefix=>step.key?.startsWith(prefix)))return {...step,sourceSection:'sourcing',sourceId:planId};
 return step;
}
