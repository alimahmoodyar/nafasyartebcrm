import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"سامانه جامع نفس‌یار",description:"سامانه جامع نفس‌یار؛ مدیریت تولید، کیفیت، انبار، کنترل مالی و خدمات پس از فروش",icons:{icon:"/brand/nafasyar-icon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><head><link rel="preload" href="/fonts/Vazirmatn.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body>{children}</body></html>}
