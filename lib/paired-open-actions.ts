export type PairedOpenAction={id:string;key:string;item:string;label:string;by:string;beforeFields?:Record<string,{value:string|boolean|string[];version:number;by:string}>};
export function openActionIdentity(button:Element){return {key:button.getAttribute('data-pair-open')||'',item:button.getAttribute('data-pair-item')||button.closest('[data-pair-row]')?.getAttribute('data-pair-row')||button.closest('[data-pair-record]')?.getAttribute('data-pair-record')||'',label:(button.getAttribute('aria-label')||(button.tagName==='FORM'?'':button.textContent)||'').replace(/\s+/g,' ').trim().slice(0,200)}}
/** Only explicit local UI controls are addressable: never arbitrary CSS,
 * positional fallbacks, JavaScript, links or submit controls. */
export function findPairedOpenAction(action:Pick<PairedOpenAction,'key'|'item'|'label'>,root:ParentNode=document):HTMLButtonElement|HTMLFormElement|null{
 const matches=Array.from(root.querySelectorAll('button[data-pair-open],form[data-pair-open]')).filter(el=>{
  const b=el as HTMLButtonElement;if(b.disabled||b.getAttribute('aria-disabled')==='true'||b.closest('[data-no-pair],[hidden],[aria-hidden="true"],[inert]')||b.type==='submit'&&b.closest('form'))return false;
  const v=openActionIdentity(b);return v.key===action.key&&v.item===action.item&&v.label===action.label;
 });return matches.length===1?matches[0] as HTMLButtonElement|HTMLFormElement:null;
}
