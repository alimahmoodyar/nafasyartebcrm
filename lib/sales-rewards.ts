import {goalProgress} from './sales-monitor-contract';
import {solarToIso} from './persian-date';
import {addDay} from './duties';

export const rewardPeriods={quarter:'هدف و پاداش فصلی',year:'هدف و پاداش سالانه'} as const;
export type RewardPeriod=keyof typeof rewardPeriods;

export function salesRewardDates(year:number,quarter:number){
 const month=quarter?1+(quarter-1)*3:1;
 const next=quarter&&quarter<4?solarToIso(year,month+3,1):solarToIso(year+1,1,1);
 return {start:solarToIso(year,month,1),end:addDay(next,-1)};
}

export function salesRewardProgress(reward:any,rows:any[],today:string){
 const data=reward.data;
 const goal={data:{...data,amount:data.target}};
 const progress=goalProgress(goal,rows,today);
 const net=goalProgress({data:{...goal.data,basis:'net'}},rows,today).actual;
 const reached=BigInt(progress.actual)>=BigInt(data.target);
 const value=reached&&data.kind!=='fixed'?(BigInt(net)>BigInt(0)?BigInt(net):BigInt(0))*BigInt(data.rate)/BigInt(10000):BigInt(0);
 const quantity=!reached?BigInt(0):data.kind==='fixed'?BigInt(data.quantity):data.kind==='equivalent'?value/BigInt(data.unitValue):BigInt(0);
 const remainder=data.kind==='equivalent'?value%BigInt(data.unitValue):BigInt(0);
 const result={actual:progress.actual,net,value:String(value),quantity:String(quantity),remainder:String(remainder)};
 const ready=progress.ended&&reached&&(data.kind==='cash'?value>BigInt(0):quantity>BigInt(0));
 return {...progress,result,ready};
}
