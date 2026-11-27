import './vosk.js';

const modelURL = new URL('./fa-0.42.tar.gz', import.meta.url).href;
const wakeVariants = ['منو ببین', 'من رو ببین', 'من را ببین'];
const grammar = JSON.stringify([...wakeVariants, '[unk]']);

function normalize(text) {
  return String(text).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c]+/g, '').trim();
}

export async function startWake(onWake, onError = () => {}) {
  if (typeof onWake !== 'function') throw new TypeError('تابع فراخوان دوربین لازم است.');
  if (!navigator.serviceWorker?.controller) throw new Error('ابتدا نصب آفلاین ایستگاه را کامل کنید و ایستگاه را باز کنید.');
  const context = new AudioContext({sampleRate: 16000});
  let model, recognizer, stream, source, processor, stopped = false, processing = false;
  let lastWake = -Infinity;
  async function stop() {
    if (stopped) return;
    stopped = true;
    window.removeEventListener('pagehide', stop);
    stream?.getTracks().forEach(track => track.stop());
    if (processor) processor.onaudioprocess = null;
    source?.disconnect();
    processor?.disconnect();
    recognizer?.remove();
    model?.terminate();
    if (context.state !== 'closed') await context.close();
  }
  try {
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, noiseSuppression: true, echoCancellation: true}, video: false});
    model = new globalThis.Vosk.Model(modelURL, -1);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('آماده‌سازی تشخیص گفتار بیش از حد طول کشید.')), 120000);
      model.on('load', message => {
        clearTimeout(timeout);
        if (message.result) resolve();
        else reject(new Error('مدل گفتار فارسی روی ایستگاه آماده نیست.'));
      });
      model.on('error', () => {clearTimeout(timeout);reject(new Error('مدل گفتار فارسی بارگذاری نشد.'));});
    });
    recognizer = new model.KaldiRecognizer(context.sampleRate, grammar);
    recognizer.on('result', async ({result}) => {
      if (stopped || processing || performance.now() - lastWake < 2500) return;
      if (!wakeVariants.some(variant => normalize(result?.text) === normalize(variant))) return;
      processing = true;
      lastWake = performance.now();
      try {await onWake();} catch (error) {onError(error);}
      finally {processing = false;}
    });
    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = event => {
      if (stopped || processing) return;
      try {recognizer.acceptWaveform(event.inputBuffer);}
      catch (error) {void stop();onError(error);}
    };
    source.connect(processor);
    processor.connect(context.destination);
    stream.getAudioTracks()[0].addEventListener('ended', () => {if (!stopped) {void stop();onError(new Error('اتصال میکروفن قطع شد.'));}}, {once:true});
    window.addEventListener('pagehide', stop, {once:true});
    return stop;
  } catch (error) {await stop();throw error;}
}
