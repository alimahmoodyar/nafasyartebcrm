import {financePeriod} from './finance-control';
import {AccessError} from './authorization';
export function financeScope(q:URLSearchParams){const cadence=q.get('cadence')||'',day=q.get('period')||'';try{return {cadence,period:financePeriod(cadence,day)}}catch(e){throw new AccessError((e as Error).message,400)}}
