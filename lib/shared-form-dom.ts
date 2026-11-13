import {sensitiveFieldLabel} from './device-pair-contract';
export type SharedControl=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
const compact=(s:string)=>s.replace(/\s+/g,' ').trim().slice(0,500);
export function sharedControlLabel(el:SharedControl){return compact(el.getAttribute('aria-label')||Array.from(el.labels||[]).map(l=>l.textContent||'').join(' ')||el.getAttribute('placeholder')||el.name||'');}
export function shareableControl(el:any):el is SharedControl{
 if(!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||el.closest('[data-no-pair],[hidden],[aria-hidden="true"],[inert]'))return false;
 const c=el as SharedControl,type=c.getAttribute('type')||'text';
 if(['password','hidden','file','submit','button','reset'].includes(type)||sensitiveFieldLabel([c.name,c.id,c.autocomplete,sharedControlLabel(c)].join(' ')))return false;
 return !!sharedControlLabel(c);
}
export function sharedControls(root:ParentNode=document){
 const dialogs=Array.from(root.querySelectorAll('[role="dialog"]')).filter(d=>!d.closest('[data-no-pair]'));
 const surface=dialogs.at(-1)||root;
 return Array.from(surface.querySelectorAll('input,textarea,select')).filter(shareableControl) as unknown as SharedControl[];
}
export function sharedControlValue(c:SharedControl):string|boolean|string[]{return c instanceof HTMLInputElement&&['checkbox','radio'].includes(c.type)?c.checked:c instanceof HTMLSelectElement&&c.multiple?Array.from(c.selectedOptions).map(o=>o.value):c.value;}
export async function controlKeys(controls:SharedControl[],work:string){
 // Full ordered schema prevents an edit being replayed into a different form
 // or dynamic row. Generated React ids and viewport positions are not identities.
 const labels=controls.map(c=>[c.tagName,c.getAttribute('type')||'text',sharedControlLabel(c),c.name]);
 const identities=Array.from(document.querySelectorAll('[data-pair-record]')).map(n=>n.getAttribute('data-pair-record'));
 const headings=Array.from(document.querySelectorAll('h1,h2,h3,h4,[role=dialog] [data-slot=dialog-title]')).filter(n=>!n.closest('[data-no-pair]')).map(n=>compact(n.textContent||''));
 const schema=JSON.stringify([identities,headings,labels]);const map=new Map<string,SharedControl>();
 await Promise.all(controls.map(async(c,i)=>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(work+'\n'+schema+'\n'+i));map.set(Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join(''),c)}));return map;
}
export function applySharedValue(c:SharedControl,value:string|boolean|string[]){
 if(c.disabled||('readOnly' in c&&c.readOnly)||JSON.stringify(sharedControlValue(c))===JSON.stringify(value))return;
 if(c instanceof HTMLInputElement&&['checkbox','radio'].includes(c.type)){if(typeof value==='boolean'&&c.checked!==value)c.click();return;}
 if(c instanceof HTMLSelectElement){if(c.multiple&&Array.isArray(value))for(const o of Array.from(c.options))o.selected=value.includes(o.value);else if(typeof value==='string')Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(c,value);else return;c.dispatchEvent(new Event('change',{bubbles:true}));return;}
 if(typeof value!=='string')return;
 const prototype=c instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
 Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(c,value);c.dispatchEvent(new Event('input',{bubbles:true}));c.dispatchEvent(new Event('change',{bubbles:true}));
}
