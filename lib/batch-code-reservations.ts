import {storage} from './storage';
/** Retired human codes remain reserved so an old label can never identify another receipt. */
export async function reservedBatchCodes(){
 const rows=(await storage().prepare("SELECT json_extract(payload,'$.code') code FROM records WHERE kind='batch' UNION SELECT json_extract(h.value,'$.from.code') code FROM flow_entities r,json_each(r.data,'$.identityHistory') h WHERE r.type='receipt'").all()).results;
 return rows.map((r:any)=>r.code).filter((code:any)=>typeof code==='string'&&code);
}
