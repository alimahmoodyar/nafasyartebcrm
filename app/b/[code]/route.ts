import {GET as receiptReport} from '@/app/api/receipt-report/route';
import {printableForm,escapeForm} from '@/lib/form-control-print';
export async function GET(request:Request,context:{params:Promise<{code:string}>}){
 const {code}=await context.params;if(!code||code.length>100)return new Response('شناسه بچ معتبر نیست.',{status:400});
 const target=new URL('/api/receipt-report',request.url);target.searchParams.set('id','batch:'+code);
 const result=await receiptReport(new Request(target));
 if(result.status!==401)return result;
 // No lookup/public details when signed out. Login resumes this same, validated local link.
 return printableForm('ورود برای مشاهده بچ',`<h1>جزئیات بچ</h1><p>اطلاعات ثابت روی QR قابل خواندن است. جزئیات تکمیلی فقط پس از ورود و بررسی دسترسی نمایش داده می‌شود.</p><a href="/?batch=${encodeURIComponent(code)}">ورود به سامانه و ادامه مشاهده بچ ${escapeForm(code)}</a>`);
}
