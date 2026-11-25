import {AccessError} from './authorization';
import {panelConfig,validLine} from './sms-panel';
import {sendNafasyarSms} from './asset-sms';
import {rate} from './sms-rate';
export async function sendPublicWarrantyTestSms(){
 const config=await panelConfig();
 const mobile=config.mobile;
 if(!config.apiKey||!validLine(config.line))throw new AccessError('کلید یا خط ارسال پیامک در تنظیمات سرور آماده نیست.',503);
 if(!mobile||!/^09\d{9}$/.test(mobile))throw new AccessError('شمارهٔ آزمون پیامک در میزبان تنظیم نشده است.',503);
 await rate('panel-test',mobile,1,300000);
 const messageId=await sendNafasyarSms(mobile,'نفس‌یار طب\nاین پیامک برای تست ارسال شده است.',config);
 return {accepted:true,messageId,mobileLast4:mobile.slice(-4)};
}
