import {requireAdmin} from '@/lib/authorization';
import {redirect} from 'next/navigation';
import {SmsTestButton} from './sms-test-button';
import '../../warranty/activate/warranty.css';

export const dynamic='force-dynamic';
export default async function SmsTestPage(){
 const user=await requireAdmin().catch(()=>null);
 if(!user || user.rolePreview || user.profileReview) redirect('/');
 return <main className="public-warranty-page" dir="rtl"><section className="public-warranty-card">
  <div className="public-warranty-body"><h1>تست پنل پیامک</h1>
   <p>یک پیامک آزمایشی به شمارهٔ تست تنظیم‌شده روی سرور ارسال می‌شود.</p>
   <SmsTestButton/>
  </div>
 </section></main>;
}
