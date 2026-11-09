import {accessResponse,session} from './authorization';
import {mcpActor} from './mcp/context';
import {isUnscopedRepresentative,type Session} from './permissions';
import {profileSession,representativeSampleId} from './profile-review';
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
  return mcpActor.run(actor,()=>work(actor));
 });
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
