(() => {
  const panel = document.querySelector('.direct-label');
  if (!panel) return;
  const get = name => panel.querySelector('[data-' + name + ']');
  const status = get('status'), printer = get('printer');
  const width = Math.round(Number(panel.dataset.width) * 8);
  const height = Math.round(Number(panel.dataset.height) * 8);
  const form = document.querySelector('#label-options');
  const fields = () => form ? new URLSearchParams(new FormData(form)).toString() : '';
  const initial = fields();
  const key = 'hamnafas.label.printer';
  const offsetsKey = () => JSON.stringify([key, printer.value, width, height]);
  function loadOffsets() {
    const [x,y] = JSON.parse(localStorage.getItem(offsetsKey()) || '[0,0]');
    get('x').value = x; get('y').value = y;
  }
  printer.onchange = loadOffsets;
  let port=18743;
  async function call(path, body) {
    const result = await fetch('http://127.0.0.1:'+port+'/' + path, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit',
      body:JSON.stringify(body), signal:AbortSignal.timeout(60000)
    });
    if (!result.ok) throw Error('رابط چاپ درخواست را نپذیرفت.');
    return result.json();
  }
  get('connect').onclick = async () => {
    get('connect').disabled = true;
    try {
      port=18743;
      let directory;
      try{directory=await call('printers',{});}catch{port=18742;directory=await call('printers',{});}
      const {printers,version}=directory;
      if(!['1.0.0','1.1.0'].includes(version)){
        get('controls').hidden = true; get('install').open = true;
        status.textContent='برای این صفحه، نسخهٔ ۱٫۱٫۰ رابط چاپ را نصب کنید.';
        return;
      }
      printer.replaceChildren(...printers.map(name => new Option(name,name)));
      if (printers.includes(localStorage.getItem(key))) printer.value = localStorage.getItem(key);
      get('controls').hidden = !printers.length;
      get('install').open = false;
      get('connect').hidden = printers.length > 0;
      status.textContent = printers.length ? ('رابط چاپ متصل است'+(version?' · نسخهٔ '+version:'')) : 'چاپگر GoDEX G500 در ویندوز پیدا نشد.';
      loadOffsets();
    } catch {
      get('controls').hidden = true; get('install').open = true;
      status.textContent = 'ارتباط برقرار نشد. رابط ویندوز را نصب کنید و اجازهٔ دسترسی مرورگر به دستگاه محلی را بدهید.';
    } finally { get('connect').disabled = false; }
  };
  let renderer;
  function loadRenderer() {
    if (!renderer) renderer = new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = '/label-printer/html2canvas.min.js';
      script.onload = resolve;
      script.onerror = () => { renderer = null; reject(Error('ابزار آماده‌سازی لیبل بارگذاری نشد.')); };
      document.head.append(script);
    });
    return renderer;
  }
  async function bitmap(label, dx, dy) {
    const scale = 25.4 * 8 / 96;
    const approved = label.matches('.approved-asset');
    if (approved) await prepareApprovedAssets();
    const image = approved ? label.querySelector('canvas') : typeof buildBatchLabelPdf === 'function' ? await buildBatchLabelPdf(label) : await window.html2canvas(label, {
      scale, backgroundColor:'#fff', logging:false, onclone(doc,copy) {
        copy.style.borderColor = 'transparent';
        const style = doc.createElement('style');
        style.textContent = '*{animation:none!important;transition:none!important}';
        doc.head.append(style);
      }
    });
    const row = label.closest('.roll-row');
    const box = label.getBoundingClientRect();
    const origin = row ? row.getBoundingClientRect() : box;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height);
    const left = Math.round((box.left-origin.left)*scale+dx);
    const top = Math.round((box.top-origin.top)*scale+dy);
    if(left<0 || top<0 || left+image.width>width || top+image.height>height){
      const src=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
      for(let sy=0;sy<image.height;sy++)for(let sx=0;sx<image.width;sx++){
        if(sx+left>=0 && sx+left<width && sy+top>=0 && sy+top<height)continue;
        const i=(sy*image.width+sx)*4;
        if(src[i+3]>127 && (src[i]*3+src[i+1]*6+src[i+2])/10<155)
          throw Error('بخشی از محتوای لیبل بیرون محدوده است. اندازه یا نقطهٔ شروع چاپ را اصلاح کنید.');
      }
    }
    ctx.drawImage(image,left,top);
    const pixels = ctx.getImageData(0,0,width,height).data;
    const stride = Math.ceil(width/8), packed = new Uint8Array(stride*height);
    for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
      const i = (y*width+x)*4;
      if ((pixels[i]*3+pixels[i+1]*6+pixels[i+2])/10 < 155) packed[y*stride+(x>>3)] |= 128 >> (x%8);
    }
    if (!packed.some(byte=>byte)) throw Error('تصویر لیبل خالی است.');
    return packed;
  }
  let busy = false;
  async function send(test) {
    if (busy) return;
    if (fields() !== initial) { status.textContent='تنظیمات تغییر کرده است. ابتدا پیش‌نمایش را بزنید.'; return; }
    const x=get('x'), y=get('y');
    if (!x.reportValidity() || !y.reportValidity()) return;
    const labels = Array.from(document.querySelectorAll(panel.dataset.selector));
    const groups=new Map();
    for(const label of labels){
      const key=label.closest('.roll-row')||label;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(label);
    }
    const allRows=[...groups.values()];
    const rows=test?allRows.slice(0,1):allRows;
    if (!rows.length || width<1 || width>864 || height<32 || height>4000 || rows.length>500 || rows.length*Math.ceil(width/8)*height*2>11500000) {
      status.textContent='اندازه یا تعداد از ظرفیت چاپ مستقیم بیشتر است. اندازه یا تعداد را کم کنید.'; return;
    }
    busy=true;
    panel.querySelectorAll('button,select,input').forEach(e => e.disabled=true);
    let submitted=false;
    try {
      localStorage.setItem(key, printer.value);
      localStorage.setItem(offsetsKey(),JSON.stringify([Number(x.value),Number(y.value)]));
      await document.fonts.ready;
      if (typeof buildBatchLabelPdf !== 'function' && !rows[0][0].matches('.approved-asset')) await loadRenderer();
      const pages=[];
      for (const row of rows) {
        status.textContent='آماده‌سازی لیبل '+(pages.length+1)+' از '+rows.length;
        const merged=new Uint8Array(Math.ceil(width/8)*height);
        for(const label of row){
          const image=await bitmap(label,Number(x.value)*8,Number(y.value)*8);
          for(let i=0;i<merged.length;i++)merged[i]|=image[i];
        }
        pages.push(Array.from(merged,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase());
      }
      submitted=true;
      const reply=await call('jobs',{id:crypto.randomUUID(),printer:printer.value,width,height,pages});
      if (!reply.queued) throw Error();
      status.textContent=rows.reduce((sum,row)=>sum+row.length,0)+' لیبل به صف '+printer.value+' ارسال شد.';
    } catch(error) {
      status.textContent=submitted?'نتیجهٔ ارسال قطعی نیست. پیش از ارسال مجدد، صف چاپگر را بررسی کنید.':(error.message || 'آماده‌سازی چاپ انجام نشد.');
    } finally {
      busy=false; panel.querySelectorAll('button,select,input').forEach(e=>e.disabled=false);
    }
  }
  get('test').onclick=()=>send(true);
  get('send').onclick=()=>send(false);
  if (localStorage.getItem(key)) void get('connect').onclick();
})();
