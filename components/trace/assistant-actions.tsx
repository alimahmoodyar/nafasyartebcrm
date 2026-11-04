'use client';
import {NumberInput} from '@/components/trace/number-input';
import {formPresentation,fieldTitle,displayedValue} from '@/lib/assistant-form-presentation';
import {displayDateField} from '@/lib/persian-date';
import {useEffect,useState,type ReactNode} from 'react';
import {SalesOrderActionSummary} from './sales-order-workspace';
export type AssistantAction={id:string;turnId:string;tool:string;title:string;args:Record<string,any>;state:string;result:any;expires:string;section:string};
export {fieldTitles as labels} from '@/lib/form-vocabulary';
export function Details({value,field='',tool='',schema,path=[]}:{value:any;field?:string;tool?:string;schema?:any;path?:string[]}){
 if(field==='previous'&&typeof value==='string'){try{return <Details value={JSON.parse(value)} tool={tool}/>}catch{}}
 if(value===null||typeof value!=='object')return <span>{String(displayDateField(field,displayedValue(tool,path,value,schema))??'—')||'—'}</span>;
 if(Array.isArray(value))return <span>{value.length?value.map((v,i)=><span key={i}>{i>0?'، ':''}<Details value={v} field={field} tool={tool} schema={schema?.items} path={[...path,'*']}/></span>):'هیچ‌کدام'}</span>;
 return <dl className="assistant-arguments">{Object.entries(value).filter(([k])=>!['confirmed','requestId','revision','previousVersion','previousRevision','quoteHash','catalogSnapshot'].includes(k)&&!/password|token|secret|cipher|api.?key/i.test(k)).map(([k,v])=><div key={k}><dt>{fieldTitle(tool,k,schema?.properties?.[k])}</dt><dd><Details value={v} field={k} tool={tool} schema={schema?.properties?.[k]} path={[...path,k]}/></dd></div>)}</dl>;
}
function ActionDetails({action}:{action:AssistantAction}){
 const p=formPresentation(action.tool,action.args,{type:'object',properties:{}},action.title);
 const args={...action.args};if(!['update_record','delete_record','update_user','delete_user'].includes(action.tool))delete args.id;
 if(action.tool==='sales_apply'&&args.mode==='order')return <SalesOrderActionSummary args={args}/>;
 return <Details value={args} tool={action.tool} schema={p.schema}/>;
}
const states:Record<string,string>={pending:'در انتظار تأیید شما',running:'در حال اجرا؛ از تکرار فرمان خودداری کنید',review:'نیاز به بررسی نتیجه',succeeded:'اجرا شد',cancelled:'لغو شد',expired:'مهلت تأیید تمام شده'};
export function ActionCards({actions,busy,onDecide,onOpen,renderDetails,confirmDisabled,activeActionId,onDismiss}:{actions:AssistantAction[];busy:boolean;onDecide:(id:string,decision:'confirm'|'cancel',password?:string)=>Promise<boolean|undefined>;onOpen?:(section:string)=>void;renderDetails?:(action:AssistantAction)=>ReactNode;confirmDisabled?:boolean;activeActionId?:string|null;onDismiss?:(id:string)=>void}){
 const [passwords,setPasswords]=useState<Record<string,string>>({}),[visible,setVisible]=useState<Record<string,boolean>>({}),[dismissed,setDismissed]=useState<Record<string,boolean>>({});
 useEffect(()=>{setPasswords(p=>Object.fromEntries(Object.entries(p).filter(([id])=>actions.some(a=>a.id===id&&a.state==='pending'))));},[actions]);
 // A review is an execution result, not an operation waiting for user approval.
 // Old uncertain results stay inspectable in collapsed history, never pinned on refresh.
 const active=actions.filter(a=>!dismissed[a.id]&&(a.state==='pending'||['running','review'].includes(a.state)&&a.id===activeActionId));
 const history=actions.filter(a=>['running','review'].includes(a.state)&&!active.some(current=>current.id===a.id));
 const dismiss=(id:string)=>{setDismissed(p=>({...p,[id]:true}));onDismiss?.(id);};
 const details=(a:AssistantAction)=><details><summary>جزئیات فرمان و نتیجه</summary>{renderDetails?renderDetails(a):<ActionDetails action={a}/>}{a.result&&<Details value={a.result}/>}</details>;
 const result=(a:AssistantAction)=><>{details(a)}{a.result?.error&&<p role="alert">{a.result.error}</p>}{onOpen&&<button type="button" className="link" onClick={()=>onOpen(a.section)}>نمایش بخش مربوطه</button>}</>;
 return <div className="assistant-actions">{active.map(a=><article className="assistant-action-card" key={a.id}>
 <div style={{display:'flex',alignItems:'start',justifyContent:'space-between',gap:12}}><strong>{formPresentation(a.tool,a.args,{type:'object',properties:{}},a.title).title}</strong>{a.state!=='pending'&&<button type="button" className="btn" disabled={busy} aria-label="بستن کارت نتیجه" onClick={()=>dismiss(a.id)}>بستن ×</button>}</div>
 <p role="status">{states[a.state]||a.state}</p>
 {a.state==='pending'?<><p className="subtle">این تغییر روی اطلاعات واقعی شرکت ثبت می‌شود. جزئیات را بررسی کنید.</p>{renderDetails?renderDetails(a):<ActionDetails action={a}/>}
 {a.tool==='create_password_user'&&<label className="field">رمز عبور حساب جدید<NumberInput fieldKey={a.id} type={visible[a.id]?"text":"password"} dir="ltr" spellCheck={false} autoCapitalize="none" autoComplete="new-password" minLength={10} maxLength={128} value={passwords[a.id]||''} onChange={e=>setPasswords(p=>({...p,[a.id]:e.target.value}))}/><button type="button" className="link" aria-pressed={!!visible[a.id]} onClick={()=>setVisible(p=>({...p,[a.id]:!p[a.id]}))}>{visible[a.id]?"پنهان کردن رمز":"نمایش رمز"}</button><span className="subtle">۱۰ تا ۱۲۸ کاراکتر؛ حروف بزرگ و کوچک و فاصله‌ها دقیقاً حفظ می‌شوند. رمز فقط هنگام ثبت ارسال می‌شود؛ در گفتگو یا مدل ذخیره نمی‌شود.</span></label>}
 <div className="tools"><button type="button" className="btn primary" disabled={busy||confirmDisabled||(a.tool==='create_password_user'&&(passwords[a.id]||'').length<10)} onClick={async()=>{if(await onDecide(a.id,'confirm',passwords[a.id])){setPasswords(p=>({...p,[a.id]:''}));setVisible(p=>({...p,[a.id]:false}));}}}>تأیید و اجرا</button><button type="button" className="btn" disabled={busy} onClick={async()=>{if(await onDecide(a.id,'cancel')){setPasswords(p=>({...p,[a.id]:''}));setDismissed(p=>({...p,[a.id]:true}));}}}>لغو</button></div>
 <p className="subtle">{a.tool==='create_password_user'?'برای ایجاد حساب، رمز را وارد کنید و دکمهٔ تأیید و اجرا را بزنید.':'می‌توانید «تأیید اجرا» یا «لغو فرمان» را هم بگویید و ارسال کنید.'}</p>
 </>:result(a)}</article>)}
 {history.length>0&&<details className="assistant-action-history"><summary>سوابق فرمان‌ها ({history.length.toLocaleString('fa-IR')})</summary><p className="subtle">بستن نمایش کارت، نتیجهٔ اجرا را تغییر نمی‌دهد. فرمان‌های نیازمند بررسی را پیش از هر تلاش دوباره، در بخش مربوطه بررسی کنید.</p>{history.map(a=><article className="assistant-action-card" key={a.id}><strong>{formPresentation(a.tool,a.args,{type:'object',properties:{}},a.title).title}</strong><p>{states[a.state]||a.state}</p>{result(a)}</article>)}</details>}
 </div>;
}
