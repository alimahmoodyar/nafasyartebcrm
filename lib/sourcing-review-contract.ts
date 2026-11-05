export type SourcingReviewWorkspace='engineering'|'finance';
export const sourcingReviewModes=['technical','financial_review','finance','issue_order'];
export function sourcingReviewDestination(role:string,planId:string){
 return {section:role==='engineering'?'qms':'finance-control',target:'sourcing:'+planId};
}
export function sourcingStepDestination(step:any,planId:string){
 if(step.key?.startsWith('technical:')||step.role==='finance'){
  const d=sourcingReviewDestination(step.role,planId);return {...step,sourceSection:d.section,sourceId:d.target};
 }
 return step;
}
