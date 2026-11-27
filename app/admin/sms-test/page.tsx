import {requireAdmin} from '@/lib/authorization';
import {redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {SmsTestButton} from './sms-test-button';
import {SmsReport} from './sms-report';
import './sms-report.css';
import '../../warranty/activate/warranty.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'پیامک | هم‌نفس'};
export default async function SmsTestPage(){
 const user=await requireAdmin().catch(()=>null);
 if(!user || user.rolePreview || user.profileReview) redirect('/');
 return <main className="public-warranty-page" dir="rtl"><section className="public-warranty-card">
  <div className="public-warranty-body">
   <a className="link" href="/">بازگشت به خانهٔ مدیر</a>
   <h1>پیامک</h1>
   <p>برای ارسال پیامک آزمایشی به شمارهٔ ذخیره‌شده، «تست پیامک» را بزنید.</p>
   <SmsTestButton/>
   <SmsReport/>
  </div>
 </section></main>;
}
