import {MobileAppProvider} from "@/components/trace/mobile-app";
import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"هم‌نفس | سامانه جامع نفس‌یار",description:"هم‌نفس، سامانه جامع نفس‌یار؛ مدیریت تولید، کیفیت، انبار، کنترل مالی و خدمات پس از فروش",icons:{icon:"/brand/nafasyar-icon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><head><link rel="manifest" href="/manifest.webmanifest"/><meta name="theme-color" content="#39429a"/><link rel="apple-touch-icon" href="/brand/hamnafas-192.png"/><link rel="preload" href="/fonts/Vazirmatn.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body><MobileAppProvider>{children}</MobileAppProvider></body></html>}
