export const employeeAssetFields={name:'نام مال',brand:'سازنده',model:'مدل',serial:'سریال کارخانه‌ای',location:'محل استقرار'} as const;
export const employeeAssetKinds={repair:'تعمیر',edit:'اصلاح اطلاعات'} as const;
export const employeeAssetStates={
 submitted:'در انتظار بررسی اموال‌دار',returned:'برگشت برای تکمیل',editing:'آمادهٔ اصلاح اطلاعات',
 review:'اصلاحات در انتظار تأیید نهایی',repair_open:'ارجاع به تعمیر',repair_done:'تعمیر تکمیل شد',
 rejected:'رد شده',approved:'اصلاحات تأیید شد',
} as const;
export const employeeAssetModes=['employee_request','employee_request_resubmit','employee_request_review','employee_request_edit','employee_request_finalize','employee_request_seen'] as const;
export type EmployeeAssetKind=keyof typeof employeeAssetKinds;
export type EmployeeAssetField=keyof typeof employeeAssetFields;
export type EmployeeAssetRequest={
 id:string;kind:EmployeeAssetKind;requesterId:string;requesterName:string;custodyId:string;notes:string;state:keyof typeof employeeAssetStates;version:string;
 photoId?:string;editNote?:string;reviewNote?:string;fields?:EmployeeAssetField[];baseline?:Partial<Record<EmployeeAssetField,string>>;
 changes?:Partial<Record<EmployeeAssetField,string>>;seen?:boolean;
};
export function currentEmployeeAssetRequests(data:any):EmployeeAssetRequest[]{
 if(data.lifecycle==='disposed'||data.holderKind!=='employee'||!data.holderId)return [];
 return Object.values(data.employeeRequests||{}).filter((request:any)=>request.requesterId===data.holderId&&request.custodyId===(data.custodyId||'')) as EmployeeAssetRequest[];
}
export function employeeAssetTerminal(request:EmployeeAssetRequest){
 return ['approved','rejected','repair_done'].includes(request.state);
}
