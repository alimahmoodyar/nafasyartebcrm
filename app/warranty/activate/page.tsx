import type {Metadata} from 'next';
import {PublicWarrantyForm} from './warranty-form';
import './warranty.css';

export const metadata:Metadata={title:'فعال‌سازی گارانتی | نفس‌یار طب'};
export default function WarrantyActivationPage(){
 return <main className="public-warranty-page">
  <section className="public-warranty-card" aria-labelledby="public-warranty-title">
   <header><img src="/brand/nafasyar-logo.png" alt="نفس‌یار طب" width="142" height="48"/><span>خدمات پس از فروش</span></header>
   <div className="public-warranty-body">
    <h1 id="public-warranty-title">فعال‌سازی گارانتی دستگاه</h1>
    <PublicWarrantyForm/>
   </div>
  </section>
 </main>;
}
