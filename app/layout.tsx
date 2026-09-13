import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"نفس‌یار | رهگیری تولید و کیفیت",description:"شناسنامه دستگاه، رهگیری قطعات و پیگیری کیفیت نفس‌یار",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>}
