import {storage} from './storage';
import {AccessError} from './authorization';
/** Append-only service journal, in the same transaction as the bank/payment change. */
export function serviceBankLedgerStatements(writes:{id:string;type:string;data:any;old?:any}[],actor:string,now:string){
 const statements:D1PreparedStatement[]=[];
 for(const w of writes){if(w.type!=='sales_payment'||w.data.serviceDomain!=='home')continue;
  const d=w.data,old=w.old?.data;if(d.serviceAgentId!==d.agentId||!/^\d{1,18}$/.test(d.amount)||BigInt(d.amount)<=BigInt(0))throw new AccessError('هویت یا مبلغ پرداخت خدمات معتبر نیست.',409);
  const cleared=d.state==='cleared'&&old?.state!=='cleared',reversed=d.state==='reversed'&&old?.state==='cleared';
  if(!cleared&&!reversed)continue;if(cleared&&old&&old.state!=='pending'||reversed&&old.amount!==d.amount)throw new AccessError('گردش پرداخت خدمات معتبر نیست.',409);
  const kind=cleared?'payment_received':'payment_reversed',data=JSON.stringify({day:d.bankSettlementDay||d.day,reference:d.reference,bankRowId:d.bankRowId,notes:d.reviewNotes||'',paymentId:w.id});
  statements.push(storage().prepare('INSERT INTO service_ledger(id,agent_id,domain,kind,source_id,debit,credit,due,data,created,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('service-bank:'+kind+':'+w.id,d.agentId,'home',kind,w.id,reversed?d.amount:'0',cleared?d.amount:'0',null,data,now,actor));
 }
 return statements;
}
