'use client';
import {useId,useState,type InputHTMLAttributes} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export function PasswordField({label,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string}){
 const generatedId=useId(),id=props.id||generatedId,[visible,setVisible]=useState(false);
 return <div className="field"><label htmlFor={id}>{label}</label><div className="account-password-input"><input {...props} id={id} type={visible?'text':'password'} dir="ltr" spellCheck={false} autoCapitalize="none"/><button type="button" className="account-password-toggle" disabled={props.disabled} onClick={()=>setVisible(v=>!v)} aria-controls={id} aria-pressed={visible} aria-label={visible?'پنهان کردن رمز':'نمایش رمز'} title={visible?'پنهان کردن رمز':'نمایش رمز'}>{visible?<EyeOff size={20}/>:<Eye size={20}/>}</button></div></div>;
}
