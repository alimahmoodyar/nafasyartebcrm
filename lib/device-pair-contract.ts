export type SharedWork={kind:'scan'|'navigate';code?:string;section?:string;target?:string};
export type SharedField={value:string|boolean|string[];version:number;by:string};
export type SharedPair={actions?:import('./paired-open-actions').PairedOpenAction[];id:string;revision:number;side:'a'|'b';paired:boolean;connected:boolean;expires:number;inviteUntil:number;invite?:string;work:SharedWork|null;epoch:number;fields:Record<string,SharedField>;commit:{id:string;by:string;state:'sending'|'done'|'uncertain';status?:number}|null};
export function pairInviteFromCode(code:string,origin:string){try{const u=new URL(code,origin);if(u.origin!==origin)return null;const match=/^#device-pair=([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(u.hash);return match?{id:match[1],invite:match[2]}:null}catch{return null}}
export const unsharedSections=new Set(['users','role-testing','account','settings','mcp','system-reset']);
export function sensitiveFieldLabel(value:string){return /password|passkey|secret|token|api.?key|رمز|گذرواژه|کلید.*(?:دسترسی|سرویس)|کد.*(?:یک.?بار|تأیید ورود)|تایید.*تحویل|تأیید.*تحویل|رویت|رؤیت|تأیید.*فیزیکی/i.test(value)}

export function pairInviteUrl(origin:string,id:string,invite:string){return new URL('/#device-pair='+id+'.'+invite,origin).href;}
export function isPairInviteCode(code:string,origin:string){try{const u=new URL(code,origin);return u.origin===origin&&u.hash.startsWith('#device-pair')}catch{return false}}
