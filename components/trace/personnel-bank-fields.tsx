'use client';
import {IranIbanInput} from './iran-iban-input';

type BankFields={bankAccount?:string;bankName?:string;accountNumber?:string};
export function PersonnelBankFields({value,onChange}:{value:BankFields;onChange:(key:keyof BankFields,value:string)=>void}){
 const number=value.accountNumber||'';
 return <fieldset className="wide" style={{minWidth:0}}>
  <legend>اطلاعات بانکی</legend>
  <p className="subtle">شماره شبا یا نام بانک و شماره حساب را وارد کنید. وارد کردن هر دو هم ممکن است.</p>
  <div className="formgrid">
   <IranIbanInput showRequirement={false} required={!number.trim()} value={value.bankAccount||''} onChange={iban=>onChange('bankAccount',iban)}/>
   <label className="field">نام بانک
    <input required={!!number.trim()} maxLength={100} value={value.bankName||''} onChange={e=>onChange('bankName',e.target.value)}/>
   </label>
   <label className="field">شماره حساب
    <input dir="ltr" type="text" inputMode="text" maxLength={64} value={number} onChange={e=>onChange('accountNumber',e.target.value)}/>
   </label>
  </div>
 </fieldset>;
}
