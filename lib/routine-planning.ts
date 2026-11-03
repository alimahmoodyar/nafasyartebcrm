import {productionEligible} from './production-people';
// Shared by the read-only capacity preview and the confirmed, atomic plan write.
export type PlannedWork={memberId:string;memberName:string;day:string;start:number;end:number;stage:number;count:number;crew?:{id:string;name:string}[]};
export const workMembers=(work:any)=>work.crew?.length?work.crew:[{id:work.memberId,name:work.memberName}];
// Normalize only the policy copied into NEW plans/jobs. Stored versions and
// policy snapshots on existing jobs retain their historical efficiency factor.
export function routinePolicy(entities:any[],day:string){const policy=entities.filter(e=>e.type==='routine_policy'&&e.data.effective<=day).sort((a,b)=>b.data.effective.localeCompare(a.data.effective)||b.data.version-a.data.version)[0];return policy?{...policy,data:{...policy.data,efficiencyPercent:100}}:undefined;}
export function planRoutine(input:any,source:{entities:any[];members:any[]}){
 const fail=(message:string):never=>{throw new Error(message)};
 const route=source.entities.find(e=>e.type==='routine_route'&&e.id===input.routeId);
 if(!route?.data.steps?.length)fail('ابتدا قطعه و مسیر ساخت معتبر را انتخاب کنید.');
 if(Number(String(input.day).slice(0,4))<1900||Number(String(input.day).slice(0,4))>2100||!/^\d{4}-\d{2}-\d{2}$/.test(input.day)||!Number.isFinite(Date.parse(input.day))||new Date(input.day).toISOString().slice(0,10)!==input.day)fail('روز شروع معتبر لازم است.');
 if(!Number.isSafeInteger(input.days)||input.days<1||input.days>31)fail('بازه برنامه باید بین یک تا ۳۱ روز تقویمی باشد.');
 const clock=(v:any)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?Number(v.slice(0,2))*60+Number(v.slice(3)):NaN;
 const start=clock(input.start),end=clock(input.end);if(!(end>start))fail('ساعت پایان باید بعد از شروع همان روز باشد.');
 if(!['quantity','people'].includes(input.method))fail('روش برنامه‌ریزی را انتخاب کنید.');
 if(input.method==='quantity'&&(!Number.isSafeInteger(input.count)||input.count<1||input.count>100000))fail('تعداد موردنیاز تولید را بین یک تا صد هزار وارد کنید.');
 const ids=input.memberIds;if(!Array.isArray(ids)||!ids.length||ids.length>50||new Set(ids).size!==ids.length)fail('حداقل یک نفر و حداکثر ۵۰ نفر را برای بررسی ظرفیت انتخاب کنید.');
 const members=ids.map((id:string)=>source.members.find(m=>m.id===id&&productionEligible(m,source.entities,input.day,new Date(Date.parse(input.day)+(input.days-1)*86400000).toISOString().slice(0,10))));if(members.some((m:any)=>!m))fail('افراد باید از فهرست کارکنان فعال و مجاز برای تولید در این بازه انتخاب شوند.');
 const dates=Array.from({length:input.days},(_,i)=>new Date(Date.parse(input.day)+i*86400000).toISOString().slice(0,10));
 const policies=dates.map(day=>routinePolicy(source.entities,day));
 if(policies.some(p=>!p||['setupMinutes','restMinutes','lowerPercent','upperPercent'].some(k=>p.data[k]==null))||route.data.steps.some((s:any)=>!(s.seconds>0)))fail('زمان استاندارد و تنظیمات زمان مفید برای تمام روزهای برنامه باید کامل باشد؛ از «تنظیمات و کارسنجی» تکمیل کنید.');
 const leaveBlocks:any[]=[];for(const e of source.entities.filter(e=>e.type==='hr_request'&&e.data.kind==='leave'&&e.data.state==='approved'&&ids.includes(e.data.memberId))){const d=e.data;for(const day of dates.filter(day=>d.start<=day&&d.end>=day)){const from=d.hourly?clock(d.startTime):0,to=d.hourly?clock(d.endTime):1440;if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)fail('بازه مرخصی مصوب یکی از افراد نامعتبر است؛ ابتدا در پرسنلی اصلاح شود.');leaveBlocks.push({memberId:d.memberId,day,start:from,end:to});}}
 const reserved=source.entities.flatMap(e=>e.type==='routine_job'&&e.data.state!=='cancelled'?[e.data]:e.type==='plan'?e.data.schedule||[]:[]);
 const existing=reserved.flatMap(j=>workMembers(j).map((m:any)=>({...j,memberId:m.id}))).concat(leaveBlocks);
 // Whole-stage precedence is deliberately conservative: the next operation starts
 // after the preceding stage's entire planned batch, not on imaginary future WIP.
 function schedule(count:number,pool:any[]){
  const work:PlannedWork[]=[],busy=existing.map(j=>({memberId:j.memberId,day:j.day,start:j.start,end:j.end})),restUsed=new Set<string>(reserved.flatMap(j=>workMembers(j).map((m:any)=>j.day+'|'+m.id)));let gateDay=dates[0],gateTime=start;
  for(let stage=0;stage<route.data.steps.length;stage++){
   const step=route.data.steps[stage],crewSize=step.crewSize??1;let remaining=count,lastDay=gateDay,lastTime=gateTime;
   if(!Number.isSafeInteger(crewSize)||crewSize<1||crewSize>10)fail('تعداد افراد هم‌زمان هر مرحله باید بین یک تا ۱۰ باشد.');
   if(crewSize>1){
    for(const day of dates){if(day<gateDay)continue;const policy=policies[dates.indexOf(day)]!.data,unitMinutes=step.seconds/60/(policy.efficiencyPercent/100);
     for(let cursor=Math.max(start,day===gateDay?gateTime:start);cursor<end&&remaining;cursor++){
      const slots=pool.map(member=>{const blocks=busy.filter(j=>j.memberId===member.id&&j.day===day&&j.end>cursor&&j.start<end);if(blocks.some(j=>j.start<=cursor))return null;return {member,end:Math.min(end,...blocks.map(j=>j.start))};}).filter(Boolean) as {member:any;end:number}[];
      const team=slots.sort((a,b)=>Number(restUsed.has(day+'|'+b.member.id))-Number(restUsed.has(day+'|'+a.member.id))||b.end-a.end).slice(0,crewSize);if(team.length<crewSize)continue;
      const rest=team.every(s=>restUsed.has(day+'|'+s.member.id))?0:policy.restMinutes,overhead=policy.setupMinutes+rest;if(team.some(s=>s.end-cursor<overhead+Math.ceil(unitMinutes)))continue;
      const until=Math.min(...team.map(s=>s.end)),quantity=Math.min(remaining,Math.floor((until-cursor-overhead)/unitMinutes+1e-7));if(!quantity)continue;
      const finish=cursor+overhead+Math.ceil(quantity*unitMinutes),crew=team.map(s=>({id:s.member.id,name:s.member.name}));
      work.push({memberId:crew[0].id,memberName:crew.map(m=>m.name).join('، '),crew,day,start:cursor,end:finish,stage,count:quantity});for(const m of crew){busy.push({memberId:m.id,day,start:cursor,end:finish});restUsed.add(day+'|'+m.id);}remaining-=quantity;lastDay=day;lastTime=finish;cursor=finish-1;
      if(work.length>500)fail('برنامه بیش از حد بزرگ است؛ بازه یا گروه کوچک‌تری انتخاب کنید.');
     }if(!remaining)break;
    }if(remaining)return null;gateDay=lastDay;gateTime=lastTime;continue;
   }
   for(let di=0;di<dates.length&&remaining;di++){
    const day=dates[di];if(day<gateDay)continue;const policy=policies[di]!.data;
    const slots=pool.map(member=>{
     let cursor=Math.max(start,day===gateDay?gateTime:start);const intervals=busy.filter(j=>j.memberId===member.id&&j.day===day&&j.end>cursor&&j.start<end).sort((a,b)=>a.start-b.start),gaps:{start:number;end:number;capacity:number;overhead:number}[]=[];
     let restPending=!restUsed.has(day+'|'+member.id);
     const add=(from:number,to:number)=>{const overhead=policy.setupMinutes+(restPending?policy.restMinutes:0),capacity=Math.floor((Math.max(0,to-from-overhead)*policy.efficiencyPercent/100*60+1e-7)/step.seconds);if(capacity){gaps.push({start:from,end:to,capacity,overhead});restPending=false;}};
     for(const interval of intervals){if(interval.start>cursor)add(cursor,Math.min(end,interval.start));cursor=Math.max(cursor,interval.end);}if(cursor<end)add(cursor,end);
     return {member,gaps,capacity:gaps.reduce((n,g)=>n+g.capacity,0)};
    });
    const total=slots.reduce((n,s)=>n+s.capacity,0),dailyCount=Math.min(remaining,total);if(!dailyCount)continue;
    // Fill the earliest common completion horizon. Capacity at minute t-1 is
    // allocated first, then units becoming available at t. This keeps targets
    // balanced for equal shifts and monotone for the capacity binary search.
    const capacityAt=(gap:any,t:number)=>Math.floor((Math.max(0,Math.min(gap.end,t)-gap.start-gap.overhead)*policy.efficiencyPercent/100*60+1e-7)/step.seconds);
    const until=(t:number)=>slots.reduce((n,slot)=>n+slot.gaps.reduce((q,g)=>q+capacityAt(g,t),0),0);
    let low=start,high=end;while(low<high){const mid=Math.floor((low+high)/2);if(until(mid)>=dailyCount)high=mid;else low=mid+1;}
    const horizon=low;let extra=dailyCount-until(horizon-1);
    for(const slot of slots)for(const gap of slot.gaps){
     const base=capacityAt(gap,horizon-1),increment=Math.min(extra,capacityAt(gap,horizon)-base),quantity=base+increment;extra-=increment;if(!quantity)continue;
     const finish=gap.start+gap.overhead+Math.ceil(quantity*step.seconds/60/(policy.efficiencyPercent/100));
     const job={memberId:slot.member.id,memberName:slot.member.name,day,start:gap.start,end:finish,stage,count:quantity};work.push(job);busy.push(job);remaining-=quantity;
     restUsed.add(day+'|'+slot.member.id);
     if(work.length>500)fail('برنامه بیش از حد بزرگ است؛ بازه یا گروه کوچک‌تری انتخاب کنید.');
     if(day>lastDay||day===lastDay&&finish>lastTime){lastDay=day;lastTime=finish;}
    }
   }
   if(remaining)return null;gateDay=lastDay;gateTime=lastTime;
  }
  return work;
 }
 let count=input.count,work:PlannedWork[]|null=null;
 if(input.method==='quantity'){
  // Deterministic prefix search finds a feasible team; preview names remain explicit.
  for(let size=1;size<=members.length;size++){work=schedule(count,members.slice(0,size));if(work)break;}
 }else{
  let low=0,high=Math.min(input.maxCount??100000,100000,Math.floor(input.days*(end-start)*60*members.length/route.data.steps.reduce((n:number,s:any)=>n+s.seconds*(s.crewSize??1),0)));
  while(low<high){const mid=Math.ceil((low+high)/2);if(schedule(mid,members))low=mid;else high=mid-1;}count=low;work=count?schedule(count,members):null;
 }
 if(!work)return {feasible:false,count:input.method==='quantity'?input.count:0,reason:'ظرفیت آزاد این افراد در بازه انتخاب‌شده برای تکمیل قطعه کافی نیست. تعداد، بازه یا افراد را تغییر دهید.',work:[],routeId:route.id};
 const used=[...new Set(work.flatMap(j=>workMembers(j).map((m:any)=>m.id)))];
 return {feasible:true,routeId:route.id,routeRevision:route.revision,count,personHours:count*route.data.steps.reduce((n:number,s:any)=>n+s.seconds*(s.crewSize??1),0)/3600,scheduledHours:work.reduce((n,j)=>n+(j.end-j.start)*workMembers(j).length,0)/60,people:used.length,work,policies:policies.map((p,i)=>({day:dates[i],id:p!.id,revision:p!.revision})),basis:'زمان استاندارد و ظرفیت ثبت‌شده؛ مراحل به‌ترتیب و پس از تکمیل مرحله قبل. روزها تقویمی‌اند؛ مرخصی مصوب و تخصیص‌های ثبت‌شده کسر شده‌اند؛ تعطیلی، شیفت یا عدم‌حضور ثبت‌نشده باید در انتخاب روز و ساعت لحاظ شود.'};
}
