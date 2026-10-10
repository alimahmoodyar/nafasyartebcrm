import {storage} from './storage';
// Only completed, serial-linked company sales are evidence; reservations and
// service-agent assignments do not identify the selling representative.
export async function serviceSalesDealer(deviceId:string,at:string){
 if(!deviceId)return {state:'missing',name:''};
 const rows=(await storage().prepare("SELECT data FROM flow_entities WHERE type='sale' AND json_extract(data,'$.state')='delivered' AND substr(json_extract(data,'$.deliveredAt'),1,10)<=? AND EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.deviceIds')) WHERE value=?)").bind(at,deviceId).all()).results as any[];
 const found=new Map<string,string>();
 for(const row of rows){const d=JSON.parse(row.data);if(!d.salesAgentId&&!['agent','representative','branch'].includes(d.recipient?.kind))continue;
 let name=d.recipient?.name||'';if(!name&&d.salesAgentId){const agent:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='sales_agent'").bind(d.salesAgentId).first();name=agent?JSON.parse(agent.data).name||'':'';}
 if(name)found.set(d.salesAgentId||d.partyId,name);
 }
 return found.size===1?{state:'recorded',name:[...found.values()][0]}:found.size>1?{state:'conflict',name:''}:{state:'missing',name:''};
}
