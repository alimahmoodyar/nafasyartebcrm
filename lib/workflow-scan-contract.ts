import {incomingQcCode} from './incoming-qc-contract';
import {assetLabelId} from './asset-label';
import {parseShippingQr} from './shipping-packages';
import {parseReturnCarton} from './service-return-parcel-contract';
import {driverReceiptId} from './driver-receipt-contract';
import {parseServiceDeviceQr,serviceDeviceSerial} from './service-device-contract';
/** Labels identify objects, never a role, mutable action, permission or approval. */
export const workflowLabelFamilies=['batch','device','shipping','return','receipt','asset'] as const;
export type ScanAction={id:string;title:string;kind:'navigate'|'shipping'|'return'|'receipt'|'transfer'|'asset';section?:string;target?:string;code?:string;driver?:boolean;expert?:boolean;intake?:boolean;startOfficeIntake?:boolean;domain?:string};
export type ScanResult={kind:string;message:string;actions:ScanAction[]};
export const agencyScanWorkspace='home-service';
export const customerScanWorkspace='home-service-customer-support';
export const lineManagerScanWorkspace='line-manager';
export const centralStoreScanWorkspace='central-store';
export const agencyCaseForms=['authorize','report_submit','labor','followup'] as const;
export type AgencyCaseForm=typeof agencyCaseForms[number];
export type CustomerCaseForm='contact'|'consent'|'deliver'|'confirm'|'return_unrepaired';
export const customerCaseForms:readonly CustomerCaseForm[]=['contact','consent','deliver','confirm','return_unrepaired'];
export function customerCaseForm(d:{agentId?:string;domain:string;state:string;customerTotal?:string;consent?:{approved?:boolean};confirmation?:{result?:string}},access:{support:boolean;intake:boolean}):CustomerCaseForm|undefined{
 if(d.domain!=='home'||d.agentId)return;
 if(access.support){
  if(['contact','followup','referred'].includes(d.state))return 'contact';
  if(['diagnosed','approved'].includes(d.state)&&d.customerTotal&&/^[0-9]+$/.test(d.customerTotal)&& /[1-9]/.test(d.customerTotal)&&!d.consent?.approved)return 'consent';
  if(d.state==='delivered'&&d.confirmation?.result!=='confirmed')return 'confirm';
 }
 if(access.intake){
  if(d.state==='tested')return 'deliver';
  if(d.state==='declined')return 'return_unrepaired';
 }
}
export function agencyCaseFormAvailable(mode:AgencyCaseForm,d:{agentId?:string;domain:string;state:string;repairedAt?:string;reportSubmittedAt?:string;authorization?:unknown;laborApproved?:unknown},allClaimsCredited=false){
 if(d.domain!=='home'||!d.agentId)return false;
 if(mode==='authorize')return d.state==='diagnosed'&&!d.authorization;
 if(mode==='report_submit')return !!d.repairedAt&&!d.reportSubmittedAt;
 if(mode==='labor')return !!d.reportSubmittedAt&&!d.laborApproved&&allClaimsCredited;
 return !['closed','resolved','returned','declined'].includes(d.state);
}
export function parseWorkflowLabel(value:string,origin:string){
 const raw=typeof value==='string'?value.replace(/\r\n?/g,'\n').trim():'';
 if(!raw||raw.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(raw))throw Error('کد خوانده‌شده معتبر نیست.');
 const batch=incomingQcCode(raw,origin);if(batch)return {kind:'batch' as const,code:batch,raw};
 if(assetLabelId(raw))return {kind:'asset' as const,code:assetLabelId(raw),raw};
 if(raw.startsWith('NAFASYAR-SHIP/1:')){parseShippingQr(raw);return {kind:'shipping' as const,code:raw,raw};}
 if(raw.startsWith('NAFASYAR-RETURN/1:')&&parseReturnCarton(raw))return {kind:'return' as const,code:raw,raw};
 if(raw.startsWith('NAFASYAR-RECEIPT/1:')&&driverReceiptId(raw))return {kind:'receipt' as const,code:driverReceiptId(raw),raw};
 if(raw.startsWith('NAFASYAR-DEVICE/1:')&&parseServiceDeviceQr(raw))return {kind:'device' as const,code:parseServiceDeviceQr(raw)!,raw};
 if(/^NAFASYAR-|^xn--.*\/1/i.test(raw)||/^https?:\/\//i.test(raw)&&new URL(raw).origin===new URL(origin).origin)throw Error('لیبل داخلی معتبر نیست یا نسخهٔ آن پشتیبانی نمی‌شود.');
 // External text/URLs stay inert references. They are never followed or executed.
 return {kind:'unknown' as const,code:serviceDeviceSerial(raw),raw};
}
