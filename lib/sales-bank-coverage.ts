import {addDay} from './duties';
import {isIsoDay} from './persian-date';

export type BankPeriod={from:string;to:string};
export type BankStatementSource='bank'|'pos';
const period=(from:string,to=from):BankPeriod=>({from,to});

function mergePeriods(periods:BankPeriod[]){
 const result:BankPeriod[]=[];
 for(const current of [...periods].sort((a,b)=>a.from.localeCompare(b.from))){
  const last=result.at(-1);
  if(last&&current.from<=addDay(last.to,1)){if(current.to>last.to)last.to=current.to;}
  else result.push({...current});
 }
 return result;
}

export function coveredBankPeriods(rows:any[],source:BankStatementSource='bank'){
 const byAccount=new Map<string,BankPeriod[]>();
 for(const row of rows){
  const {accountId,day,coverageFrom,coverageTo}=row.data;
  const value=row.type==='sales_bank_statement'&&(row.data.source||'bank')===source&&isIsoDay(coverageFrom)&&isIsoDay(coverageTo)&&coverageFrom<=coverageTo
   ? period(coverageFrom,coverageTo)
   : row.type===(source==='bank'?'sales_bank_row':'sales_bank_pos_row')&&isIsoDay(day)?period(day):null;
  if(value&&accountId){
   const ranges=byAccount.get(accountId)||[];
   ranges.push(value);byAccount.set(accountId,ranges);
  }
 }
 return new Map([...byAccount].map(([id,ranges])=>[id,mergePeriods(ranges)]));
}

export function uncoveredBankPeriods(from:string,to:string,covered:BankPeriod[]){
 if(from>to)return [];
 const result:BankPeriod[]=[];
 let next=from;
 for(const range of covered){
  if(range.to<next)continue;
  if(range.from>to)break;
  if(range.from>next)result.push(period(next,addDay(range.from,-1)));
  next=addDay(range.to,1);
  if(next>to)break;
 }
 if(next<=to)result.push(period(next,to));
 return result;
}

export function bankCoverage(rows:any[],today:string){
 const covered=coveredBankPeriods(rows),posCovered=coveredBankPeriods(rows,'pos'),through=addDay(today,-1);
 const terminals=rows.filter(row=>row.type==='sales_bank_terminal');
 return rows.filter(account=>['treasury_account','sales_receiving_account'].includes(account.type)&&account.data.state==='active'&&account.data.kind==='bank'&&account.data.currency==='IRR').map(account=>{
  const periods=covered.get(account.id)||[],pos=posCovered.get(account.id)||[];
  const from=[periods[0]?.from,pos[0]?.from].filter(Boolean).sort()[0]||'';
  const linked=terminals.filter(row=>row.data.accountId===account.id&&(row.data.active||row.data.validTo));
  const posExpected=from?mergePeriods(linked.flatMap(({data})=>{
   const start=data.validFrom>from?data.validFrom:from,end=data.validTo&&data.validTo<through?data.validTo:through;
   return start<=end?[period(start,end)]:[];
  })):[];
  return {accountId:account.id,title:account.data.title,from,through,lastCovered:periods.at(-1)?.to||'',missing:from?uncoveredBankPeriods(from,through,periods):[],
   pos:{linked:linked.some(({data})=>data.active&&data.validFrom<=today&&(!data.validTo||data.validTo>=today)),lastCovered:pos.at(-1)?.to||'',missing:posExpected.flatMap(range=>uncoveredBankPeriods(range.from,range.to,pos))}};
 });
}

export function* missingBankDays(coverage:ReturnType<typeof bankCoverage>){
 for(const account of coverage)for(const [source,periods] of [['bank',account.missing],['pos',account.pos.missing]] as const)for(const range of periods)for(let day=range.from;day<=range.to;day=addDay(day,1))yield {accountId:account.accountId,title:account.title,day,source};
}
