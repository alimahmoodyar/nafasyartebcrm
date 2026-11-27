import {AccessError} from './authorization';
import {panelConfig,validLine} from './sms-panel';
import {sendNafasyarSms} from './asset-sms';
import {withSmsReport} from './sms-report';
export async function sendPublicWarrantyTestSms(){
 return withSmsReport('admin_test',async report=>{
  report('config_unavailable');
  const config=await panelConfig();
  const mobile=config.mobile;
  report('config_unavailable',{mobile});
  if(!config.apiKey||!validLine(config.line))throw new AccessError('کلید یا خط ارسال پیامک در تنظیمات سرور آماده نیست.',503);
  if(!mobile||!/^09\d{9}$/.test(mobile))throw new AccessError('شمارهٔ آزمون پیامک در میزبان تنظیم نشده است.',503);
  const messageId=await sendNafasyarSms(mobile,'نفس‌یار طب\nاین پیامک برای تست ارسال شده است.',config,undefined,report);
  return {accepted:true,messageId,mobileLast4:mobile.slice(-4)};
 });
}
