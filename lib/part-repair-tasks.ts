import {addDay} from './duties';
import {partRepairActions} from './part-repair-contract';
const next:Record<string,{mode:string;role:string}>={received:{mode:'assign',role:'coordinator'},working:{mode:'work',role:'technician'},review:{mode:'review',role:'coordinator'},consent:{mode:'consent',role:'agent'},awaiting_stock:{mode:'issue',role:'inventory'},ready_send:{mode:'ship',role:'intake'},shipped:{mode:'receive',role:'agent'}};
export function partRepairSteps(r:any){const d=r.data,step=next[d.state];if(!step)return [];
 return [step.role,...(step.role==='agent'?['coordinator']:[])].map(role=>({key:'part-repair:'+d.state+':v'+r.revision+':'+role,role,title:partRepairActions[step.mode]+' — '+d.receiptCode+' — '+d.partName,due:addDay((d.stageSince||r.created).slice(0,10),2),domain:d.domain,agentId:d.agentId,ownerId:role==='technician'?d.technicianId:'',instructions:'از بخش خدمات پس از فروش، «قطعات و داغی» و سپس «قطعات تعمیری نمایندگان»، رسید '+d.receiptCode+' را باز و مرحلهٔ واقعی را ثبت کنید.'}));
}
