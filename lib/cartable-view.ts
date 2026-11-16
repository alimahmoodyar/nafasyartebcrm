export const roleTaskTools:Record<string,string>={review:'پیگیری و بررسی پاسخ‌ها','inbox-workflow':'درخواست‌های کاری و پیام‌های سازمانی','receipt-notes':'یادداشت‌های دریافت کالا','purchase-services':'تحویل خرید و خدمات',management:'نظارت مدیریتی',definitions:'سمت‌ها و برنامه وظایف',positions:'شرح مسئولیت‌های من',notifications:'اعلان‌های من',reminders:'به‌روزرسانی یادآوری‌های سامانه'};
export function cartableTarget(target:string){
 if(target==='inbox')return 'inbox';
 if(target.startsWith('reminder-task:'))return 'inbox-workflow';
 if(target.startsWith('receipt-note:'))return 'receipt-notes';
 const tool=target.startsWith('role-tools:')?target.slice(11):'';
 return Object.hasOwn(roleTaskTools,tool)?tool:'mine';
}
export const cartableSearch=(value:unknown)=>String(value??'').normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[\s\u200c]+/g,' ').trim().toLowerCase();
export type CartableRow={id:string;title:string;subtitle:string;context:string;instructions:string;due:string;review:boolean;kind:'position'|'task';source:any;canOpen?:boolean};
export function cartableRows(data:any):CartableRow[]{
 const positions=(data?.positionWork||[]).map((w:any)=>({id:'position:'+w.id,title:w.title||'کار فرایندی',subtitle:w.sourceId||'',context:'کار فرایندی',instructions:'',due:w.due||'',review:false,kind:'position',source:w}));
 const tasks=(data?.tasks||[]).filter((t:any)=>!!data.memberId&&!['completed','cancelled'].includes(t.state)&&((t.assignee===data.memberId&&(t.state!=='submitted'||t.supervisor===data.memberId))||t.supervisor===data.memberId&&t.state==='submitted')).map((t:any)=>({id:'task:'+t.id,title:t.data.title||'وظیفه',subtitle:t.data.sourceId||t.id,context:t.data.positionName||'وظیفه سازمانی',instructions:t.data.instructions||'',due:t.due||'',review:t.state==='submitted',kind:'task',source:t}));
 return [...positions,...tasks];
}
export function filterCartableRows(rows:CartableRow[],query:string){const words=cartableSearch(query).split(' ').filter(Boolean);return rows.filter(r=>words.every(word=>cartableSearch([r.title,r.subtitle,r.context,r.instructions].join(' ')).includes(word)));}
