import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {treasuryRows,scopedTreasuryRows,treasuryRoles,treasuryView,treasuryHelp,applyTreasury,treasuryProfileTest} from '@/lib/treasury';
import {syncTreasuryTasks} from '@/lib/treasury-tasks';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
export async function GET(request?:Request){try{
 const u=await requireAccess(),query=request?new URL(request.url).searchParams:null,test=query?.get('roleTest')==='true';
 const read=async()=>{
  const rows=await treasuryRows(),r=await treasuryRoles(u,rows),scoped=scopedTreasuryRows(rows,r,u.userId,u.isAdmin);
  if(test||query?.get('destinations')==='true')return json({accounts:r.treasury||r.manager?rows.filter(row=>row.type==='sales_receiving_account'):[],roles:{treasury:r.treasury,manager:r.manager},roleTest:test});
  return json({...treasuryView(scoped),sources:r.write?treasuryView(rows).sources:[],roles:{read:r.read,write:r.write,treasury:r.treasury,manager:r.manager,accountant:r.accountant,ceo:r.ceo},files:scoped.filter(r=>r.type==='treasury_file').map(r=>({id:r.id,caseId:r.data.caseId,filename:r.data.filename})),help:treasuryHelp,...(test?{roleTest:true}:{})});
 };
 return await (test?treasuryProfileTest(u,read):read());
}catch(e){return accessResponse(e)||Response.json({error:'دریافت خزانه ممکن نشد.'},{status:503});}}
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,800000)));
 if(b.roleTest===true)return json(await treasuryProfileTest(u,()=>applyTreasury(u,b)));
 const result=await applyTreasury(u,b);let tasksPending=false;
 try{await syncTreasuryTasks();}catch{tasksPending=true;}
 return json({...result,tasksPending});
}catch(e){return accessResponse(e)||Response.json({error:'ثبت تأیید نشد؛ اطلاعات و نسخه را تازه کنید.'},{status:409});}}
