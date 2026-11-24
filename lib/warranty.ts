import {storage} from '@/lib/storage';

// First activation of a traced device appends this event in the same
// transaction that issues its phone code and starts the warranty.
export const WARRANTY_CODE_ISSUED = 'issue_warranty_code';
export async function firstWarrantyCodeIssuedAt(deviceId:string):Promise<string|null> {
 const row=await storage().prepare('SELECT MIN(at) AS issuedAt FROM access_audit WHERE target=? AND action=?')
  .bind('warranty:'+deviceId,WARRANTY_CODE_ISSUED).first<{issuedAt:string|null}>();
 return row?.issuedAt||null;
}
