import {AccessError} from './authorization';

export const sourcingPageSize=30;

export function sourcingPage(query:URLSearchParams){
 const value=query.get('page')||'1';
 if(!/^\d{1,6}$/.test(value)||Number(value)<1)throw new AccessError('شمارهٔ صفحه معتبر نیست.',400);
 return Number(value);
}
