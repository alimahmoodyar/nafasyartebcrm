import {getDocument,GlobalWorkerOptions} from './pdfjs-6.5.438/pdf.min.mjs';

GlobalWorkerOptions.workerSrc = new URL('./pdfjs-6.5.438/pdf.worker.min.mjs',import.meta.url).href;

export async function openBatchPdf(file,filename,printDpi){
 const task = getDocument({data:new Uint8Array(await file.arrayBuffer()),useWasm:false,isEvalSupported:false});
 const pdf = await task.promise;
 const viewer = document.getElementById('batch-pdf-viewer');
 const canvas = viewer.querySelector('canvas');
 const number = viewer.querySelector('[data-page-number]');
 const previous = viewer.querySelector('[data-previous]');
 const next = viewer.querySelector('[data-next]');
 const print = viewer.querySelector('[data-print]');
 const download = viewer.querySelector('[data-download]');
 const close = viewer.querySelector('[data-close]');
 const status = viewer.querySelector('[role="status"]');
 const printPages = document.getElementById('batch-pdf-print-pages');
 let current = 1;
 let fileUrl;
 const printImageUrls = [];

 async function render(page,target,scale){
  const viewport = page.getViewport({scale});
  target.width = Math.ceil(viewport.width);
  target.height = Math.ceil(viewport.height);
  await page.render({canvas:target,viewport}).promise;
 }

 function clearPrintPages(){
  printPages.replaceChildren();
  for(const url of printImageUrls.splice(0))URL.revokeObjectURL(url);
 }

 async function showPage(pageNumber){
  previous.disabled = next.disabled = true;
  try{
   const page = await pdf.getPage(pageNumber);
   const {width,height} = page.getViewport({scale:1});
   const displayedWidth = Math.min(640,document.documentElement.clientWidth-40,width*3);
   const scale = Math.min(3,displayedWidth/width,Math.sqrt(4500000/(width*height)));
   await render(page,canvas,scale);
   current = pageNumber;
   number.textContent = current.toLocaleString('fa-IR')+' از '+pdf.numPages.toLocaleString('fa-IR');
  }finally{
   previous.disabled = current===1;
   next.disabled = current===pdf.numPages;
  }
 }

 function changePage(offset){
  status.textContent = '';
  void showPage(current+offset).catch(()=>{status.textContent='نمایش این صفحه انجام نشد.'});
 }
 previous.onclick = ()=>changePage(-1);
 next.onclick = ()=>changePage(1);

 print.onclick = async()=>{
  const labelPanel=document.querySelector('.direct-label');
  if(labelPanel){close.click();labelPanel.querySelector('[data-connect]').click();labelPanel.scrollIntoView({block:'center'});return;}
  print.disabled = close.disabled = true;
  try{
   const printCanvas = document.createElement('canvas');
   const pageStyle = document.getElementById('batch-pdf-page-style');
   clearPrintPages();
   for(let index=1;index<=pdf.numPages;index++){
    status.textContent = 'آماده‌سازی صفحهٔ '+index.toLocaleString('fa-IR')+' برای چاپ…';
    const page = await pdf.getPage(index);
    const {width,height} = page.getViewport({scale:1});
    const mm = points=>(points*25.4/72).toFixed(4)+'mm';
    if(index===1)pageStyle.textContent='@page{size:'+mm(width)+' '+mm(height)+';margin:0}';
    await render(page,printCanvas,Math.min(printDpi/72,Math.sqrt(12000000/(width*height))));
    const blob = await new Promise(resolve=>printCanvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('Print image unavailable');
    const img = document.createElement('img');
    const url = URL.createObjectURL(blob);
    printImageUrls.push(url);
    img.src = url;
    img.style.width = mm(width);
    img.style.height = mm(height);
    await img.decode();
    printPages.append(img);
   }
   const first=printPages.firstElementChild;
   status.textContent='';
   await window.hamnafasDocuments.open({source:printPages,width:parseFloat(first.style.width),height:parseFloat(first.style.height),extraCss:
    '#batch-pdf-print-pages{display:block!important}#batch-pdf-print-pages img{display:block;break-after:page}#batch-pdf-print-pages img:last-child{break-after:auto}body{padding:0;margin:0}'});
  }catch{
   clearPrintPages();
   status.textContent = 'آماده‌سازی چاپ انجام نشد. فایل PDF برای دریافت در دسترس است.';
  }finally{
   print.disabled = close.disabled = false;
  }
 };

 close.onclick = ()=>{
  viewer.hidden = true;
  document.body.classList.remove('batch-pdf-open');
  clearPrintPages();
  URL.revokeObjectURL(fileUrl);
  download.removeAttribute('href');
  void task.destroy();
  document.getElementById('batch-pdf-submit').focus();
 };

 try{
  await showPage(1);
  fileUrl = URL.createObjectURL(file);
  download.href = fileUrl;
  download.download = filename;
  viewer.querySelector('[data-page-controls]').hidden = pdf.numPages===1;
  document.body.classList.add('batch-pdf-open');
  viewer.hidden = false;
  viewer.querySelector('h1').focus();
 }catch(error){
  await task.destroy();
  throw error;
 }
}
