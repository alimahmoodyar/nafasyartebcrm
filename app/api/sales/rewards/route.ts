import {accessResponse,checkOrigin,requireAccess} from '@/lib/authorization';
import {dayAt} from '@/lib/duties';
import {boundedBody} from '@/lib/firmware-storage';
import {solarParts} from '@/lib/persian-date';
import {representativeSampleId} from '@/lib/profile-review';
import {trainingContext} from '@/lib/training-context';
import {withRepresentativeSample} from '@/lib/representative-sample';
import {liveSalesUser,salesManager,salesFinance,salesRep,salesScope,salesRows,salesFail as fail,salesLock,salesEntity,integer,money,sreq} from '@/lib/sales';
import {allocationPlan} from '@/lib/sales-network-contract';
import {rewardPeriods,salesRewardDates,salesRewardProgress} from '@/lib/sales-rewards';
import {syncSalesTasks} from '@/lib/sales-tasks';
import {storage} from '@/lib/storage';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const eligible=(agent:any)=>agent.data.active&&['representative','reseller'].includes(agent.data.kind);
async function seedRewardPreview(agentId:string,today:string){
 const {year,month}=solarParts(today),quarter=Math.ceil(month/3),now=new Date().toISOString(),db=storage();
 const plans=[
  {period:'quarter',quarter,target:'10',kind:'cash',rate:200,unitValue:'0',productId:''},
  {period:'year',quarter:0,target:'30',kind:'equivalent',rate:300,unitValue:'10000000',productId:'training-product-1'},
 ];
 const missing=[];
 for(const plan of plans){
  const id=agentId+':reward-demo:'+year+':'+plan.quarter;
  const existing=await db.prepare('SELECT data FROM flow_entities WHERE id=?').bind(id).first<{data:string}>();
  if(existing&&JSON.parse(existing.data).basis==='units')continue;
  const data={...plan,...salesRewardDates(year,plan.quarter),year,agentId,basis:'units',productIds:['training-product-1'],quantity:0,state:'active'};
  missing.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_reward',?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated WHERE json_extract(flow_entities.data,'$.basis')='net'").bind(id,JSON.stringify(data),now,now));
 }
 if(missing.length)await db.batch(missing);
}

async function get(){
 try{
  const user=await liveSalesUser(await requireAccess());
  const manager=salesManager(user),finance=salesFinance(user),rep=salesRep(user);
  if(!manager&&!finance&&!rep)fail('دسترسی به پاداش فروش ندارید.',403);
  const today=dayAt();
  const sampleId=representativeSampleId(user.userId);
  const sample=!!trainingContext.getStore()&&user.permissions.salesAgentId===sampleId;
  if(sample)await seedRewardPreview(sampleId,today);
  const rows=await salesRows();
  const agents=rep?[await salesScope(user,user.permissions.salesAgentId!,'read')]:rows.filter(row=>row.type==='sales_agent');
  const ids=new Set(agents.filter(agent=>!rep||eligible(agent)).map(agent=>agent.id));
  const rewards=rows.filter(row=>row.type==='sales_reward'&&ids.has(row.data.agentId)).map(row=>({...row,progress:salesRewardProgress(row,rows,today)}));
  const products=(await storage().prepare("SELECT id,payload FROM records WHERE kind='product' ORDER BY id").all<{id:string;payload:string}>()).results.map(({id,payload})=>({id,name:JSON.parse(payload).name||id}));
  return json({manager,finance,today,rewards,sample,agents:agents.map(agent=>({id:agent.id,name:agent.data.name,eligible:eligible(agent)})),products});
 }catch(error){return accessResponse(error)||json({error:'دریافت پاداش‌های فروش انجام نشد.'},503);}
}
export const GET=withRepresentativeSample(get);

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await liveSalesUser(await requireAccess());
  const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,16000)));
  const mode=body.mode;
  if(!['save','approve'].includes(mode))fail('عملیات معتبر انتخاب کنید.');
  if(!(mode==='save'?salesManager(user):salesFinance(user)))fail('دسترسی ثبت این مرحله را ندارید.',403);
  const operation=sreq(body.operation,36);
  if(!/^[0-9a-f-]{36}$/i.test(operation))fail('شناسهٔ عملیات معتبر نیست.');
  const db=storage(),signature=JSON.stringify(body),now=new Date().toISOString(),today=dayAt();
  const prior=await db.prepare('SELECT payload,actor FROM inventory_operations WHERE id=?').bind(operation).first<{payload:string;actor:string}>();
  if(prior){
   if(prior.payload!==signature||prior.actor!==user.userId)fail('شناسهٔ عملیات قبلاً استفاده شده است.',409);
   return json({saved:true});
  }
  const checks=await salesLock(db,operation),rows=await salesRows();
  const previous=body.id?rows.find(row=>row.id===body.id&&row.type==='sales_reward'):undefined;
  if(body.id&&!previous||mode==='approve'&&!previous)fail('پاداش یافت نشد.',404);
  if(previous&&(previous.revision!==body.revision||previous.data.state==='approved'))fail('پاداش تغییر کرده یا ثبت نهایی شده است.',409);
  const id=previous?.id||operation;
  const writes:D1PreparedStatement[]=[];
  let data:any;
  if(mode==='save'){
   const agent=await salesEntity(sreq(body.agentId),'sales_agent');
   if(!eligible(agent))fail('نماینده یا عامل فروش فعال انتخاب کنید.');
   const period=sreq(body.period);
   if(!Object.hasOwn(rewardPeriods,period))fail('دوره معتبر نیست.');
   const year=integer(body.year,1300,1600),quarter=period==='quarter'?integer(body.quarter,1,4):0;
   const {start,end}=salesRewardDates(year,quarter);
   if(!['cash','fixed','equivalent'].includes(body.kind))fail('نوع پاداش معتبر نیست.');
   const productIds=[sreq(body.targetProductId)];
   const productId=body.kind==='cash'?'':sreq(body.productId);
   for(const product of new Set([...productIds,...(productId?[productId]:[])])){
    if(!await db.prepare("SELECT id FROM records WHERE kind='product' AND id=?").bind(sreq(product)).first())fail('کالا یافت نشد.');
   }
   if(rows.some(row=>row.type==='sales_reward'&&row.id!==id&&row.data.agentId===agent.id&&row.data.period===period&&row.data.year===year&&row.data.quarter===quarter))fail('برای همین نماینده و دوره قبلاً هدف ثبت شده است.',409);
   data={agentId:agent.id,period,year,quarter,start,end,basis:'units',target:String(integer(Number(money(body.target,true)),1,1000000000)),productIds,kind:body.kind,productId,
    rate:body.kind==='fixed'?0:integer(body.rate,1,10000),quantity:body.kind==='fixed'?integer(body.quantity,1,100000):0,
    unitValue:body.kind==='equivalent'?money(body.unitValue,true):'0',state:'active'};
  }else{
   const reward=previous!;
   const progress=salesRewardProgress(reward,rows,today);
   if(!progress.ready)fail('دوره باید تمام شده و پاداش قابل ثبت باشد.',409);
   if(JSON.stringify(body.result)!==JSON.stringify(progress.result))fail('محاسبه تغییر کرده است. ابتدا مبلغ جدید را بررسی کنید.',409);
   data={...reward.data,state:'approved',result:progress.result,approvedAt:now,approvedBy:user.userId,reference:rewardPeriods[reward.data.period as keyof typeof rewardPeriods],amount:reward.data.kind==='cash'?progress.result.value:'0'};
   if(data.kind==='cash'){
    const plan=allocationPlan([...rows.filter(row=>row.id!==id),{id,type:'sales_reward',data,created:reward.created}],data.agentId,id,today);
    for(const [index,allocation] of plan.allocations.entries()){
     writes.push(db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_allocation',?,1,?,?)").bind(id+':reward:'+index,JSON.stringify({...allocation,agentId:data.agentId,creditId:id,by:user.userId,policy:plan.policy}),now,now));
    }
   }
  }
  writes.unshift(previous
   ?db.prepare("UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?").bind(JSON.stringify(data),now,id,previous.revision)
   :db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_reward',?,1,?,?)").bind(id,JSON.stringify(data),now,now));
  await db.batch([
   db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(operation,'sales_reward_'+mode,signature,user.userId,now),
   ...checks,...writes,
   db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,id,'sales_reward_'+mode,JSON.stringify(data),now),
  ]);
  await syncSalesTasks().catch(()=>{});
  return json({saved:true,id});
 }catch(error){return accessResponse(error)||json({error:'ثبت پاداش انجام نشد. فهرست را تازه کنید.'},409);}
}
