import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"نفس‌یار | رهگیری تولید و کیفیت",description:"نفس‌یار — با من نفس بکش؛ شناسنامه دستگاه، رهگیری قطعات و پیگیری کیفیت",icons:{icon:"/brand/nafasyar-icon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>}
