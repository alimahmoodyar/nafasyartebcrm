import {storage} from '@/lib/storage';

// Only a future successful server-side code issuance may append this event.
// No manual/distribution/import endpoint can create it. Record in the same
// transaction as the generated code, before returning that code to the user.
// The company algorithm has not been supplied; there is deliberately no issuer yet.
export const WARRANTY_CODE_ISSUED = 'issue_warranty_code';
export async function firstWarrantyCodeIssuedAt(deviceId:string):Promise<string|null> {
 const row=await storage().prepare('SELECT MIN(at) AS issuedAt FROM access_audit WHERE target=? AND action=?')
  .bind('warranty:'+deviceId,WARRANTY_CODE_ISSUED).first<{issuedAt:string|null}>();
 return row?.issuedAt||null;
}
