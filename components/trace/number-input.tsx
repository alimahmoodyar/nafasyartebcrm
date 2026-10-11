'use client';
import {useLayoutEffect,useRef,useState,type ComponentProps,type ChangeEvent} from 'react';
import {formatNumberInput,normalizeNumberInput,numberCaret,numberValidation,quantitativeField} from '@/lib/number-input';
type Props=ComponentProps<'input'> & {fieldKey?:string|number;groupNumber?:boolean};
export function NumberInput({fieldKey,groupNumber,type,inputMode,...props}:Props){
 const numeric=groupNumber??(type==='number'||inputMode==='decimal'||quantitativeField(fieldKey));
 if(!numeric||type&& !['text','number'].includes(type))return <input aria-label={props['aria-label']} type={type} inputMode={inputMode} {...props}/>;
 return <GroupedInput {...props} type={type} inputMode={inputMode}/>;
}
function GroupedInput({value,defaultValue,onChange,onBlur,onKeyDown,maxLength,min,max,step,type,ref:outerRef,...props}:ComponentProps<'input'>){
 const ref=useRef<HTMLInputElement|null>(null),pending=useRef<number|null>(null),[editing,setEditing]=useState<string|null>(null),raw=String(value??defaultValue??''),shown=editing!==null&&(raw===editing||Number(raw)===Number(editing)||['-','.','-.'].includes(editing))?editing:raw,formatted=formatNumberInput(shown);
 useLayoutEffect(()=>{if(ref.current){ref.current.setCustomValidity(numberValidation(shown,{min,max,step,type,required:props.required}));if(pending.current!==null){const caret=numberCaret(formatted,pending.current);ref.current.setSelectionRange(caret,caret);pending.current=null;}}},[formatted,min,max,step,type,props.required]);
 const normalizedEvent=<E extends ChangeEvent<HTMLInputElement>,>(e:E,next:string)=>{const target=new Proxy(e.currentTarget,{get(target,key){if(key==='value')return next;if(key==='valueAsNumber')return next===''?NaN:Number(next);const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});return {...e,target,currentTarget:target};};
 return <input {...props} aria-label={props['aria-label']} ref={el=>{ref.current=el;if(typeof outerRef==='function')outerRef(el);else if(outerRef)outerRef.current=el;}} type="text" inputMode="decimal" dir="ltr" value={formatted} onBlur={e=>{setEditing(null);onBlur?.(normalizedEvent(e,raw));}} onKeyDown={e=>{
  onKeyDown?.(e);if(e.defaultPrevented||props.readOnly||props.disabled)return;const el=e.currentTarget,s=el.selectionStart,t=el.selectionEnd;if(s===null||s!==t)return;
  if(e.key==='Backspace'&&s>1&&el.value[s-1]===',')el.setSelectionRange(s-2,s);else if(e.key==='Delete'&&el.value[s]===',')el.setSelectionRange(s,Math.min(s+2,el.value.length));
 }} onChange={e=>{const el=e.currentTarget;let next=normalizeNumberInput(el.value);if(next===null||maxLength!==undefined&&next.length>maxLength){el.value=formatted;return;}let position=el.value.slice(0,el.selectionStart??el.value.length).replace(/[,٬]/g,'').length;const inputType=(e.nativeEvent as InputEvent).inputType;
  if(next===raw&&el.value.length===formatted.length-1&&inputType?.startsWith('delete')){const index=inputType==='deleteContentBackward'?position-1:position;if(index>=0&&index<next.length){next=next.slice(0,index)+next.slice(index+1);if(inputType==='deleteContentBackward')position--;}}
  pending.current=position;setEditing(next);if(typeof value==='number'&&['-','.','-.'].includes(next))return;onChange?.(normalizedEvent(e,next));
 }}/>;
}
