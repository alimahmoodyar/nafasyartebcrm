// Browser-only adapter. Recognition is started synchronously from the user's click.
export type VoiceState='idle'|'starting'|'listening'|'stopping';
export function createVoiceRecognition(options:{create:()=>any;onState:(s:VoiceState)=>void;onNotice:(s:string)=>void;onText:(s:string)=>void}){
 let current:any=null,generation=0,heard=false,base='',state:VoiceState='idle';
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const later=(f:()=>void,ms:number)=>{const t=setTimeout(()=>{timers.delete(t);f()},ms);timers.add(t);return t};
 const clear=()=>{for(const t of timers)clearTimeout(t);timers.clear()};
 const change=(s:VoiceState)=>{state=s;options.onState(s)};
 function release(){generation++;clear();const r=current;current=null;if(r){r.onstart=r.onresult=r.onerror=r.onend=null;try{r.abort()}catch{}}change('idle')}
 function cancel(message=''){release();if(message)options.onNotice(message)}
 function stop(){if(!current)return;change('stopping');clear();later(()=>{release();options.onNotice(heard?'متن شنیده‌شده را بررسی و ارسال کنید.':'دریافت صدا پایان یافت ولی متنی دریافت نشد؛ دوباره تلاش کنید.')},2500);try{current.stop()}catch{release();options.onNotice('ضبط متوقف شد؛ دوباره میکروفن را بزنید.')}}
 function start(value:string){if(current){stop();return}base=value.trim();heard=false;const g=++generation;change('starting');options.onNotice('در حال راه‌اندازی میکروفن؛ اگر درخواست مجوز آمد، اجازه دهید.');
 try{const r=options.create();current=r;r.lang='fa-IR';r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
 const startup=later(()=>{if(g!==generation)return;release();options.onNotice('میکروفن شروع نشد. مجوز میکروفن این سایت را بررسی کنید و دوباره بزنید. در مرورگر داخلی، سایت را مستقیم در مرورگر گوشی باز کنید.')},15000);
 r.onstart=()=>{if(g!==generation||state==='stopping')return;clearTimeout(startup);timers.delete(startup);change('listening');options.onNotice('در حال شنیدن… فارسی صحبت کنید.');later(stop,60000)};
 r.onresult=(event:any)=>{if(g!==generation)return;let transcript='';for(let i=0;i<event.results.length;i++)transcript+=(event.results[i]?.[0]?.transcript||'')+' ';transcript=transcript.trim();if(transcript){heard=true;options.onText((base+(base?' ':'')+transcript).slice(0,4000))}};
 r.onerror=(event:any)=>{if(g!==generation)return;const messages:Record<string,string>={'not-allowed':'مجوز میکروفن رد شده است. در تنظیمات همین سایت اجازهٔ میکروفن را فعال کنید.','service-not-allowed':'مرورگر اجازهٔ سرویس تشخیص صدا را نمی‌دهد؛ سایت را مستقیم در مرورگر اصلی باز کنید.','audio-capture':'میکروفن در دسترس نیست؛ اتصال و مجوز آن را بررسی کنید.',network:'سرویس تشخیص صدای مرورگر در دسترس نیست. اتصال اینترنت را بررسی و دوباره تلاش کنید؛ چت متنی همچنان قابل استفاده است.','no-speech':'صدایی تشخیص داده نشد؛ دوباره میکروفن را بزنید.','language-not-supported':'تشخیص فارسی در این مرورگر پشتیبانی نمی‌شود. می‌توانید از میکروفن صفحه‌کلید برای نوشتن پیام استفاده کنید.',aborted:'دریافت صدا متوقف شد؛ برای تلاش مجدد میکروفن را بزنید.'};release();options.onNotice(messages[event.error]||'دریافت صدا با خطا متوقف شد؛ دوباره میکروفن را بزنید.')};
 r.onend=()=>{if(g!==generation)return;release();options.onNotice(heard?'متن شنیده‌شده آماده است؛ بررسی و ارسال کنید.':'صدایی به متن تبدیل نشد؛ دوباره میکروفن را بزنید.')};r.start();
 }catch{release();options.onNotice('میکروفن شروع نشد؛ مجوز مرورگر را بررسی کنید و دوباره تلاش کنید.')}}
 return {start,stop,cancel};
}
