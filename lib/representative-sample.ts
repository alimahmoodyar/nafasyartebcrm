import {accessResponse,session} from './authorization';
import {mcpActor} from './mcp/context';
import {isUnscopedRepresentative,type Session} from './permissions';
import {profileSession,representativeSampleId} from './profile-review';
import {addDay,dayAt} from './duties';
import {storage} from './storage';
import {trainingContext} from './training-context';

export async function runRepresentativeSample<T>(position:Session,work:(actor:Session)=>Promise<T>):Promise<T>{
 if(!isUnscopedRepresentative(position))throw Error('Representative sample scope required');
 const buyerId=representativeSampleId(position.userId);
 const actor=profileSession({...position,isAdmin:true},'sales-representative',[],buyerId);
 return trainingContext.run({actor:position.userId,role:'sales-representative'},async()=>{
  const {seedTraining}=await import('./training-seed');
  await seedTraining(position.userId);
  const now=new Date().toISOString();
  const db=storage();
  if(!await db.prepare("SELECT id FROM flow_entities WHERE id=? AND type='sales_agent'").bind(buyerId).first()){
   await db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_agent',?,1,?,?) ON CONFLICT(id) DO NOTHING")
    .bind(buyerId,JSON.stringify({kind:'representative',name:'نمایندگی آزمایشی',active:true,creditLimit:'0',termDays:0,phone:'',city:'تهران',address:'نشانی آزمایشی'}),now,now).run();
  }
  await seedRepresentativeFinance(buyerId,position.userId);
  await seedRepresentativeShipment(buyerId);
  return mcpActor.run(actor,()=>work(actor));
 });
}

// Create isolated examples once per preview, using the training catalog and the
// same order, invoice, payment and allocation records that the dashboard reads.
async function seedRepresentativeFinance(agentId:string,actor:string){
 const db=storage(),prefix=agentId+':finance-demo',now=new Date().toISOString(),today=dayAt();
 if(await db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(prefix).first())return;
 const catalog=(await db.prepare("SELECT id,payload FROM records WHERE kind='product' AND id LIKE 'training-product-%' ORDER BY id LIMIT 3").all<{id:string;payload:string}>()).results;
 if(catalog.length<3)return;
 const writes:D1PreparedStatement[]=[];
 const insert=(id:string,type:string,data:object)=>writes.push(db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(data),now,now));
 insert(prefix,'training_workspace',{kind:'representative_finance',agentId});
 const statementId=prefix+':statement';
 insert(statementId,'sales_bank_statement',{sample:true,agentId,day:today});
 const terminalId=prefix+':terminal';
 insert(terminalId,'sales_bank_terminal',{agentId,terminalCode:'TEST-POS',active:true,validFrom:addDay(today,-30)});
 for(const [index,product] of catalog.entries()){
  const scenario=index+1,orderId=prefix+':order:'+scenario,invoiceId=prefix+':invoice:'+scenario,paymentId=prefix+':payment:'+scenario,bankRowId=prefix+':bank-row:'+scenario;
  const amount=scenario*10_000_000,paid=scenario===1?amount:scenario===2?amount/2:0;
  const day=addDay(today,-5+index),due=addDay(today,scenario===2?-2:scenario*7);
  const lines=[{productId:product.id,name:JSON.parse(product.payload).name,quantity:1,unitNet:String(amount),net:String(amount),discount:'0'}];
  insert(orderId,'sales_order',{agentId,code:'نمونه-'+scenario,day,amount:String(amount),discount:'0',termDays:14,lines,invoiceId,state:'approved',deliveryMode:'sale',milestone:'preparing',customerReference:'سفارش آزمایشی'});
  insert(invoiceId,'sales_invoice',{agentId,orderId,day,amount:String(amount),reference:'نمونه-'+scenario,lines,installments:[{id:'1',amount:String(amount),due}]});
  const portal=scenario!==2?{submission:{actor,agentId,channel:'portal',onBehalf:false,at:now}}:{};
  const bankEvidence=paid>0?{bankRowId,bankStatementId:statementId,bankSettlementDay:day,bankEvidence:{day,statementId,...(scenario===2?{terminalCode:'TEST-POS'}:{})}}:{};
  insert(paymentId,'sales_payment',{agentId,method:'bank',day,amount:String(paid||amount),state:paid>0?'cleared':'pending',reference:'نمونه-'+scenario,...portal,...bankEvidence});
  if(paid>0){
   insert(bankRowId,'sales_bank_row',{agentId,paymentId,statementId,day,amount:String(paid),status:'matched',kind:scenario===2?'pos':'transfer',...(scenario===2?{terminalId}:{})});
   insert(prefix+':allocation:'+scenario,'sales_allocation',{agentId,invoiceId,installmentId:'1',creditId:paymentId,amount:String(paid)});
  }
 }
 try{await db.batch(writes);}
 catch(error){if(!await db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(prefix).first())throw error;}
}

// Separate from finance examples so existing previews get the shipment as well.
async function seedRepresentativeShipment(agentId:string){
 const db=storage(),missionId=agentId+':shipment-demo';
 const exists=()=>db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(missionId).first();
 if(await exists())return;
 const product=await db.prepare("SELECT id,payload FROM records WHERE kind='product' AND id='training-product-1'").first<{id:string;payload:string}>();
 if(!product)return;
 const today=dayAt(),now=new Date().toISOString(),orderId=agentId+':finance-demo:order:1',invoiceId=agentId+':finance-demo:invoice:1',saleId=missionId+':sale';
 const name=JSON.parse(product.payload).name;
 const items=[1,2].map(number=>({deviceId:missionId+':device:'+number,serial:'DEMO-SN-00'+number,quantity:1,part:name,productId:product.id}));
 const deviceIds=items.map(item=>item.deviceId);
 const lines=[{productId:product.id,name,quantity:2,unitNet:'5000000',net:'10000000',discount:'0'}];
 const entity=(id:string,type:string,data:object)=>db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)").bind(id,type,JSON.stringify(data),now,now);
 const writes=[
  ...[orderId,invoiceId].map(id=>db.prepare("UPDATE flow_entities SET data=json_set(data,'$.lines',json(?)),revision=revision+1,updated=? WHERE id=?").bind(JSON.stringify(lines),now,id)),
  entity(saleId,'sale',{salesAgentId:agentId,salesOrderId:orderId,productId:product.id,count:2,deviceIds,transportId:missionId,state:'in_transit',dispatchedAt:now}),
  entity(missionId,'transport',{kind:'sale',code:'حمل-آزمایشی',salesAgentId:agentId,sourceId:saleId,sourceIds:[saleId],state:'offered',route:'direct',due:today,offeredDay:today,packages:2,items,serialHandover:true,collectedDeviceIds:deviceIds,receivedDeviceIds:[],history:[],recipient:'نمایندگی آزمایشی',pickup:'انبار آزمایشی',destination:'نمایندگی آزمایشی',requestingUnit:'فروش'}),
  ...items.flatMap(item=>[
   db.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'device',?,?)").bind(item.deviceId,JSON.stringify({code:item.serial,product:product.id}),now),
   entity(item.deviceId,'build',{state:'in_transit',saleId}),
   db.prepare("INSERT INTO inventory_balances(id,item_id,warehouse,quantity) VALUES(?,?,'in_transit',1000)").bind(item.deviceId+'@in_transit',item.deviceId),
  ]),
 ];
 try{await db.batch(writes);}
 catch(error){if(!await exists())throw error;}
}

// The normal session still rejects access to operational data for this preview.
export function withRepresentativeSample<T extends Request|undefined>(handler:(request:T)=>Promise<Response>){
 return async (request:T)=>{
  if(trainingContext.getStore())return handler(request);
  try{
   const position=await session();
   if(!isUnscopedRepresentative(position))return handler(request);
   const response=await runRepresentativeSample(position,()=>handler(request));
   response.headers.set('Cache-Control','private, no-store');
   response.headers.set('X-Training-Workspace','isolated');
   return response;
  }catch(error){
   return accessResponse(error)||Response.json({error:'آماده‌سازی محیط آزمایشی نماینده فروش انجام نشد.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
 };
}
