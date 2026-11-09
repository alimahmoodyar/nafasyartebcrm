const encoder=new TextEncoder();
const decoder=new TextDecoder();
export const surveyUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function decode(value:string){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
async function key(secret:string){
 return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function signSurveyTicket(secret:string,purpose:string,value:unknown){
 const payload=encode(encoder.encode(JSON.stringify(value)));
 const signature=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(purpose+'.'+payload));
 return payload+'.'+encode(new Uint8Array(signature));
}
export async function verifySurveyTicket<T>(secret:string,purpose:string,ticket:unknown):Promise<T|null>{
 if(typeof ticket!=='string'||ticket.length>55000||!(/^[\w-]+\.[\w-]{43}$/).test(ticket))return null;
 const [payload,signature]=ticket.split('.');
 try{
  const valid=await crypto.subtle.verify('HMAC',await key(secret),decode(signature),encoder.encode(purpose+'.'+payload));
  return valid?JSON.parse(decoder.decode(decode(payload))) as T:null;
 }catch{return null;}
}
export type SurveyInvite={id:string;center:string;expires:string};
export type SurveyStaffTicket={id:string;until:number};
export type SurveyReceipt={id:string;status:'submitted'|'revoked';at:string;answers?:unknown};
