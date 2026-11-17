'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {iranIbanDigits,iranIbanError,normalizeIranIban,validIranIban} from '@/lib/iran-iban';

export function IranIbanInput({value,onChange,label='شماره شبا',required=false,disabled=false,name='bankAccount'}:{value:string;onChange:(value:string)=>void;label?:string;required?:boolean;disabled?:boolean;name?:string}){
 const id=useId(),input=useRef<HTMLInputElement>(null),[touched,setTouched]=useState(false),digits=iranIbanDigits(value),error=iranIbanError(value,required),showError=!!error&&(touched||digits.length>=24),valid=!!value&&validIranIban(value);
 useEffect(()=>{input.current?.setCustomValidity(error)},[error]);
 return <div className="field iran-iban-field"><label htmlFor={id}>{label}{required?' *':' (اختیاری)'}</label><div className="iran-iban-control" dir="ltr"><span className="iran-iban-prefix" aria-hidden="true">IR</span><input ref={input} id={id} name={name} aria-label={label+'؛ ۲۴ رقم پس از IR'} aria-describedby={id+'-hint'} aria-invalid={showError||undefined} required={required} disabled={disabled} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} dir="ltr" maxLength={80} pattern="[0-9]{24}" value={digits} onChange={e=>{const next=normalizeIranIban(e.target.value);e.currentTarget.setCustomValidity(iranIbanError(next,required));onChange(next)}} onBlur={()=>setTouched(true)} onInvalid={()=>setTouched(true)}/></div><small id={id+'-hint'} className={showError?'iran-iban-error':valid?'iran-iban-valid':'muted'} aria-live="polite">{showError?error:valid?'ساختار شبا صحیح است؛ مالکیت و وضعیت حساب استعلام نشده است.':'۲۴ رقم شبا را وارد کنید؛ چسباندن شبای کامل با IR هم پذیرفته می‌شود.'}</small></div>;
}
