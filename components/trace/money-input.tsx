'use client';
import {useLayoutEffect,useRef,type InputHTMLAttributes} from 'react';
import {formatMoneyInput,normalizeMoneyInput,moneyCaret,moneyDigitsBefore} from '@/lib/money-input';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'|'maxLength'> & {value:string|number|null|undefined;onChange:(raw:string)=>void;maxDigits?:number};
export function MoneyInput({value,onChange,maxDigits=18,onKeyDown,...props}:Props){
 const ref=useRef<HTMLInputElement>(null),pending=useRef<number|null>(null),formatted=formatMoneyInput(value);
 useLayoutEffect(()=>{if(pending.current!==null&&ref.current){const caret=moneyCaret(formatted,pending.current);ref.current.setSelectionRange(caret,caret);pending.current=null;}},[formatted]);
 return <input {...props} aria-label={props['aria-label']||'مبلغ'} ref={ref} type="text" inputMode="numeric" dir="ltr" value={formatted} onKeyDown={e=>{
  onKeyDown?.(e);if(e.defaultPrevented||props.readOnly||props.disabled)return;
  const el=e.currentTarget,start=el.selectionStart,end=el.selectionEnd;if(start===null||start!==end)return;
  // Make a grouping comma transparent to Backspace/Delete.
  if(e.key==='Backspace'&&start>1&&el.value[start-1]===',')el.setSelectionRange(start-2,start);
  else if(e.key==='Delete'&&el.value[start]===',')el.setSelectionRange(start,Math.min(start+2,el.value.length));
 }} onChange={e=>{
  const el=e.currentTarget;let raw=normalizeMoneyInput(el.value,maxDigits);if(raw===null)return;
  let digits=moneyDigitsBefore(el.value,el.selectionStart??el.value.length);
  const inputType=(e.nativeEvent as InputEvent).inputType;
  // Mobile keyboards may delete the separator without emitting a keydown.
  if(raw===String(value??'')&&el.value.length===formatted.length-1&&inputType?.startsWith('delete')){
   const index=inputType==='deleteContentBackward'?digits-1:digits;
   if(index>=0&&index<raw.length){raw=raw.slice(0,index)+raw.slice(index+1);if(inputType==='deleteContentBackward')digits--;}
  }
  pending.current=digits;onChange(raw);
 }}/>;
}
