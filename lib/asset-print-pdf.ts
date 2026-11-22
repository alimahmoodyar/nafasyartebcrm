import {labelPdfScript} from './label-print-pdf';

// Browser-only, lossless PDF pages from the already-authorized label DOM.
// No external conversion service, document URL, date or browser page furniture.
export function assetPdfScript(config:{selector:string;width:number;height:number;margin:number}){return 'const assetPdfConfig='+JSON.stringify(config)+';'+labelPdfScript+String.raw`
let assetPdfBusy=false;
function assetPdfStatus(message){const node=document.getElementById('asset-pdf-status');if(node)node.textContent=message;}
async function buildAssetPdf(){
 await document.fonts.ready;if(typeof prepareApprovedAssets==='function')await prepareApprovedAssets();fitAssetLabels();
 const pages=Array.from(document.querySelectorAll(assetPdfConfig.selector));
 if(!pages.length)throw Error('لیبلی برای چاپ وجود ندارد.');
 function lines(ctx,text,maxWidth,nowrap){
  if(nowrap)return [text];const result=[];let line='';
  for(const word of text.split(/\s+/u).filter(Boolean)){
   if(line&&ctx.measureText(line+' '+word).width<=maxWidth){line+=' '+word;continue;}
   if(line){result.push(line);line='';}
   if(ctx.measureText(word).width<=maxWidth){line=word;continue;}
   for(const char of Array.from(word)){if(line&&ctx.measureText(line+char).width>maxWidth){result.push(line);line='';}line+=char;}
  }
  if(line)result.push(line);return result;
 }
 function drawWords(ctx,words,x,y,width,height){
  const elements=Array.from(words.children),gap=parseFloat(getComputedStyle(words).gap)||0;let factor=1,blocks=[];
  for(let attempt=0;attempt<160;attempt++){
   blocks=elements.map(element=>{const style=getComputedStyle(element),size=parseFloat(style.fontSize)*factor;ctx.font=style.fontWeight+' '+size+'px '+style.fontFamily;return {style,size,rows:lines(ctx,element.textContent||'',width,style.whiteSpace==='nowrap')};});
   const total=blocks.reduce((sum,b)=>sum+b.rows.length*b.size*1.5,0)+gap*Math.max(0,blocks.length-1);
   const fits=total<=height&&blocks.every(b=>{ctx.font=b.style.fontWeight+' '+b.size+'px '+b.style.fontFamily;return b.rows.every(line=>ctx.measureText(line).width<=width+.01)});
   if(fits){y+=(height-total)/2;break;}factor*=.94;
  }
  ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const block of blocks){ctx.font=block.style.fontWeight+' '+block.size+'px '+block.style.fontFamily;ctx.direction=block.style.direction;const lineHeight=block.size*1.5;for(const line of block.rows){ctx.fillText(line,x+width/2,y+lineHeight/2);y+=lineHeight;}y+=gap;}
 }
 const margin=assetPdfConfig.margin*96/25.4;
 return createLabelPdf(pages,assetPdfConfig.width,assetPdfConfig.height,async(ctx,page)=>{
  const rect=page.getBoundingClientRect();
  const labels=page.matches('.label')?[page]:Array.from(page.querySelectorAll('.label'));
  for(const label of labels){
   if(label.matches('.approved-asset')){
    const box=label.getBoundingClientRect();
    ctx.drawImage(label.querySelector('canvas'),box.left-rect.left+margin,box.top-rect.top+margin,box.width,box.height);
    continue;
   }
   const qr=label.querySelector('.qr'),svg=qr&&qr.querySelector('svg'),words=label.querySelector('.words');if(!svg||!words)throw Error('محتوای لیبل کامل نیست.');const qrRect=qr.getBoundingClientRect(),textRect=words.getBoundingClientRect();ctx.drawImage(await loadLabelSvg(svg),qrRect.left-rect.left+margin,qrRect.top-rect.top+margin,qrRect.width,qrRect.height);drawWords(ctx,words,textRect.left-rect.left+margin,textRect.top-rect.top+margin,textRect.width,textRect.height);}
 },(current,total)=>assetPdfStatus('آماده‌سازی PDF؛ صفحه '+current.toLocaleString('fa-IR')+' از '+total.toLocaleString('fa-IR')));
}

async function showAssetPdf(download=false){
 if(assetPdfBusy)return;assetPdfBusy=true;try{const blob=await buildAssetPdf(),url=URL.createObjectURL(blob);if(download){const link=document.createElement('a');link.href=url;link.download='asset-labels.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);assetPdfStatus('PDF لیبل آماده و دریافت شد.');}else{assetPdfStatus('PDF آماده شد؛ چاپ را از نمایشگر PDF انجام دهید.');window.location.assign(url);}}catch(error){assetPdfStatus('ساخت PDF انجام نشد؛ دوباره تلاش کنید. '+error.message);}finally{assetPdfBusy=false;}
}
`;}
