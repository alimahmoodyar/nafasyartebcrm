import {boundedBody} from './firmware-storage';
import {prepareTrainingExercises} from './training-exercises';
import {requireAccess,checkOrigin,accessResponse,AccessError} from './authorization';
import {trainingContext} from './training-context';
import {trainingRoles,trainingScenarios} from './training-contract';
import {trainingRoutes} from './training-routes';
import {mcpActor} from './mcp/context';
import {storage} from './storage';
import {seedTraining} from './training-seed';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
const failure=(e:unknown)=>{const known=accessResponse(e);if(known)return known;const reference=crypto.randomUUID().slice(0,8);console.error('training failure',reference,e);return json({error:'آماده‌سازی یا خواندن محیط آزمایش کامل نشد؛ دوباره تلاش کنید. اگر تکرار شد، کد '+reference+' را برای پشتیبانی بفرستید.',reference},503);};
export async function trainingStatus(){try{await requireAccess();const state=await trainingContext.run({actor:'status',role:'status'},()=>storage().prepare("SELECT data FROM flow_entities WHERE id='training-ready'").first<{data:string}>());const preparation=await trainingContext.run({actor:'status',role:'status'},async()=>{const r=await storage().prepare("SELECT id FROM flow_entities WHERE id IN ('training-hospital-ready','training-expense-policy','training-technician-ready')").all<{id:string}>();return {hospital:r.results.some(v=>v.id==='training-hospital-ready'),expenses:r.results.some(v=>v.id==='training-expense-policy'),technician:r.results.some(v=>v.id==='training-technician-ready')};});return json({ready:!!state,preparation,summary:state?JSON.parse(state.data):null,roles:trainingRoles.map(({id,name})=>({id,name})),scenarios:trainingScenarios});}catch(e){return failure(e)}}
export async function trainingInitialize(request:Request){try{checkOrigin(request);const real=await requireAccess();const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,1024)));if(b.confirmed!==true)throw new AccessError('تأیید ساخت داده فرضی لازم است.',400);
 const result=await trainingContext.run({actor:real.userId,role:'initialize'},async()=>{const result=await seedTraining(real.userId);await prepareTrainingExercises(new URL(request.url).origin);return result;});return json(result);
 }catch(e){console.error('training initialize',e);return failure(e)}}
export async function trainingDispatch(request:Request){try{
 if(trainingContext.getStore())throw new AccessError('درخواست تو‌در‌تو مجاز نیست.',400);
 const real=await requireAccess();if(request.method!=='GET')checkOrigin(request);
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/training\//,''),role=trainingRoles.find(r=>r.id===url.searchParams.get('_role'));
 if(!role)throw new AccessError('نقش آزمایشی معتبر انتخاب کنید.',400);
 const handler=trainingRoutes[path]?.[request.method];if(!handler)throw new AccessError('این بخش در محیط آزمایش مجاز نیست؛ تنظیمات اتصال و حساب واقعی از محیط شرکت مدیریت می‌شود.',403);
 url.pathname='/api/'+path;url.searchParams.delete('_role');const headers=new Headers(request.headers);headers.delete('authorization');headers.delete('cookie');headers.delete('x-task-scheduler-token');
 const forwarded=new Request(url,{method:request.method,headers,...(request.method==='GET'?{}:{body:await boundedBody(request,25*1024*1024)})});
 return await trainingContext.run({actor:real.userId,role:role.id},async()=>{
  if(!await storage().prepare("SELECT id FROM flow_entities WHERE id='training-ready'").first())throw new AccessError('ابتدا داده‌های نمونه را آماده کنید.',409);
  // Attribute persona operations to the real tester without exposing or persisting credentials.
  if(request.method!=='GET')await storage().prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),real.userId,role.memberId,'training_attempt',JSON.stringify({path,method:request.method}),new Date().toISOString()).run();
  const response=await mcpActor.run(role.session,()=>handler(forwarded));
  response.headers.set('Cache-Control','private, no-store');response.headers.set('X-Training-Workspace','isolated');return response;
 });
 }catch(e){if(!(e instanceof AccessError))console.error('training request',e);return failure(e)}}
