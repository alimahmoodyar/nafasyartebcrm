/** Contract facts only: the payroll engine retains its independently approved rulings/policies. */
export const contractSalaryBases:Record<string,string>={monthly:'ماهانه',daily:'روزانه',hourly:'ساعتی'};
export function normalizeContractSalary(value:unknown){
 if(typeof value!=='string')return '';
 return value.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[\s,٬]/g,'');
}
export function validContractSalary(value:string){return /^\d{1,18}$/.test(value)&&BigInt(value)>BigInt(0);}
export function contractSalaryLabel(data:any){
 const value=normalizeContractSalary(data.baseSalary);
 return validContractSalary(value)&&Object.hasOwn(contractSalaryBases,data.salaryBasis||'')?BigInt(value).toLocaleString('fa-IR')+' ریال · '+contractSalaryBases[data.salaryBasis]:'حقوق پایه ثبت نشده است';
}
