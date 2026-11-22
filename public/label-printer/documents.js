(() => {
  if(window.hamnafasDocuments)return;
  const base='http://127.0.0.1:18743/';
  async function call(path,body){
    const response=await fetch(base+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(100000)});
    if(response.status===422){const error=Error('این چاپگر اندازهٔ کاغذ انتخاب‌شده را پشتیبانی نمی‌کند.');error.paper=true;throw error;}
    if(!response.ok)throw Error('رابط چاپ درخواست را تکمیل نکرد.');
    return response.json();
  }
  function dataUrl(blob){
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  }
  async function materialize(url){
    if(url.startsWith('data:'))return url;
    const target=new URL(url,document.baseURI);
    if(target.origin!==location.origin)throw Error('منبع خارج از هم‌نفس در سند وجود دارد.');
    const r=await fetch(target.href);if(!r.ok)throw Error('تصویر یا قلم سند آماده نشد.');
    return dataUrl(await r.blob());
  }
  async function snapshot(options){
    const source=options.source||document.body;
    const copy=source.cloneNode(true);
    const canvases=copy.querySelectorAll('canvas');
    source.querySelectorAll('canvas').forEach((canvas,i)=>{
      const img=document.createElement('img');img.src=canvas.toDataURL();
      img.style.cssText=canvas.style.cssText;
      const box=canvas.getBoundingClientRect();
      img.style.width=box.width+'px';img.style.height=box.height+'px';canvases[i].replaceWith(img);
    });
    copy.querySelectorAll('script,style,link,button,input,select,textarea,iframe,object,embed,dialog,.no-print,.direct-label,[data-office-print],[data-print-ui],[hidden]').forEach(n=>n.remove());
    for(const image of copy.querySelectorAll('img')){
      image.removeAttribute('srcset');
      image.src=await materialize(image.src);
    }
    for(const node of copy.querySelectorAll('*'))for(const attr of [...node.attributes]){
      if(attr.name.startsWith('on'))node.removeAttribute(attr.name);
    }
    const css=[];
    for(const sheet of document.styleSheets){
      if(sheet.disabled)continue;
      let rules;try{rules=[...sheet.cssRules].map(r=>r.cssText).join('\n');}catch{continue;}
      // Bundle our document font. Unused app-wide image URLs are blocked by the offline renderer.
      if(rules.includes('Vazirmatn.woff2'))rules=rules.replace(/url\(["']?(?:[^)"']*\/)?Vazirmatn\.woff2["']?\)/g,'url('+await materialize('/fonts/Vazirmatn.woff2')+')');
      css.push(sheet.media.mediaText?'@media '+sheet.media.mediaText+'{'+rules+'}':rules);
    }
    // Word previews keep generated styles among the preview's descendants (included above).
    css.push(options.extraCss||'');
    const body=copy.tagName==='BODY'?copy.outerHTML:'<body>'+copy.outerHTML+'</body>';
    return '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><style>'+css.join('\n').replace(/<\/style/gi,'<\\/style')+'</style>'+body+'</html>';
  }
  async function open(options={}){
    if(document.querySelector('[data-print-ui]'))return;
    const dialog=document.createElement('dialog');dialog.dir='rtl';dialog.dataset.printUi='';
    dialog.style.cssText='font:16px Tahoma,sans-serif;border:1px solid #b8c5d5;border-radius:14px;padding:20px;max-width:min(420px,90vw);color:#192833';
    dialog.innerHTML='<strong>چاپ از هم‌نفس</strong><p><label>چاپگر این کامپیوتر <select></select></label></p><p role="status"></p><button data-send disabled>ارسال به چاپگر</button> <button data-pdf disabled>دریافت PDF</button> <button data-close>بستن</button><p data-help hidden>بسته را از حالت فشرده خارج کنید و HamnafasPrintSetup.exe را اجرا کنید. <a href="/label-printer/HamnafasPrint-1.1.0.zip" download>دریافت رابط ویندوز ۱٫۱</a></p>';
    document.body.append(dialog);dialog.showModal();
    const select=dialog.querySelector('select'),status=dialog.querySelector('[role=status]'),send=dialog.querySelector('[data-send]'),pdf=dialog.querySelector('[data-pdf]'),close=dialog.querySelector('[data-close]');
    close.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
    if(options.pdfOnly){select.closest('p').hidden=true;send.hidden=true;}
    const key='hamnafas.office.printer';
    try{
      const {office}=await call('printers',{});
      select.replaceChildren(...office.map(name=>new Option(name,name)));
      if(office.includes(localStorage.getItem(key)))select.value=localStorage.getItem(key);
      send.disabled=!office.length;pdf.disabled=false;
      status.textContent=office.length||options.pdfOnly?'':'چاپگر اداری در ویندوز پیدا نشد.';
    }catch{
      status.textContent='رابط چاپ اسناد در دسترس نیست. پس از نصب، دسترسی مرورگر به دستگاه محلی را مجاز کنید.';
      dialog.querySelector('[data-help]').hidden=false;return;
    }
    async function submit(mode){
      let sent=false;send.disabled=pdf.disabled=close.disabled=select.disabled=true;
      dialog.oncancel=e=>e.preventDefault();
      try{
        status.textContent='در حال آماده‌سازی سند…';
        const html=await snapshot(options);
        if(new Blob([html]).size>11*1024*1024)throw Error('اندازهٔ سند از ظرفیت ارسال بیشتر است.');
        if(mode==='print')localStorage.setItem(key,select.value);
        sent=true;
        const result=await call('documents',{id:crypto.randomUUID(),printer:select.value,html,mode,width:options.width||210,height:options.height||297});
        if(mode==='pdf'){
          const bytes=Uint8Array.from(atob(result.pdf),c=>c.charCodeAt(0));
          const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));link.download='hamnafas.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),60000);
        }else if(!result.queued)throw Error();
        status.textContent=mode==='pdf'?'فایل PDF آماده شد.':'سند به صف '+select.value+' ارسال شد.';
      }catch(e){status.textContent=sent&&mode==='print'&&!e.paper?'نتیجهٔ ارسال قطعی نیست. پیش از تکرار، صف چاپگر را بررسی کنید.':e.message||'آماده‌سازی سند انجام نشد.';}
      finally{send.disabled=!select.options.length;pdf.disabled=close.disabled=select.disabled=false;dialog.oncancel=null;}
    }
    send.onclick=()=>submit('print');pdf.onclick=()=>submit('pdf');
  }
  window.hamnafasDocuments={open};
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-office-print]');if(btn)open({width:Number(btn.dataset.width),height:Number(btn.dataset.height),pdfOnly:btn.hasAttribute('data-pdf-only')});
  });
})();
