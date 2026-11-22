import {labelPdfScript} from './label-print-pdf';
import type {BatchLabelOptions} from './batch-labels';

type BatchPdfConfig = Pick<BatchLabelOptions, 'layout'|'width'|'height'|'roll'> & {
 columns: number;
 pitch: number;
 scale: number;
};

export function batchLabelPdfScript(config:BatchPdfConfig, printRequested:boolean){
 return 'const batchPdf='+JSON.stringify(config)+';'+labelPdfScript+String.raw`
const labelMm=96/25.4;
const thermalDpi=203;
const batchPdfStatus=message=>document.getElementById('batch-pdf-status').textContent=message;

function batchPdfPages(labels){
 const {layout,width,height,roll,columns,pitch}=batchPdf;
 if(layout==='thermal')return {width,height,pages:labels.map(label=>[{label,x:0,y:0}])};
 const isRoll=layout==='roll',gapX=isRoll?roll.gapX:2,gapY=isRoll?roll.gapY:2;
 const margin=8;
 if(!isRoll&&(width>210-2*margin||height>297-2*margin))throw Error('اندازهٔ لیبل در برگهٔ A4 جا نمی‌شود. کاغذ یا اندازه را تغییر دهید.');
 const rows=isRoll?1:Math.floor((297-2*margin+gapY)/(height+gapY));
 const cols=isRoll?roll.columns:columns,perPage=cols*rows,pages=[];
 for(let start=0;start<labels.length;start+=perPage){
  pages.push(labels.slice(start,start+perPage).map((label,index)=>{
   const column=index%cols,row=Math.floor(index/cols);
   const x=isRoll?roll.left+column*(width+gapX):210-margin-width-column*(width+gapX);
   const y=(isRoll?roll.top:margin)+row*(height+gapY);
   return {label,x:x*labelMm,y:y*labelMm};
  }));
 }
 return {width:isRoll?roll.rollWidth:210,height:isRoll?pitch:297,pages};
}

function drawBatchText(ctx,node,x,y,width,height){
 const style=getComputedStyle(node),fontSize=parseFloat(style.fontSize)*batchPdf.scale;
 const lineHeight=(parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.2)*batchPdf.scale;
 ctx.font=style.fontWeight+' '+fontSize+'px '+style.fontFamily;
 ctx.fillStyle='#111';ctx.textAlign='center';ctx.textBaseline='middle';ctx.direction=style.direction;
 const text=node.textContent.trim();
 const lines=[];
 let line='';
 for(const word of text.split(/\s+/u)){
  const next=line?line+' '+word:word;
  if(style.whiteSpace!=='nowrap'&&line&&ctx.measureText(next).width>width){lines.push(line);line=word;}
  else line=next;
 }
 if(line)lines.push(line);
 const spacing=Math.min(lineHeight,height/Math.max(1,lines.length));
 for(const [i,content] of lines.entries())ctx.fillText(content,x+width/2,y+(i+.5)*spacing,width);
}

async function buildBatchLabelPdf(directLabel){
 await document.fonts.ready;
 const labels=directLabel?[directLabel]:Array.from(document.querySelectorAll('.sheet .label'));
 if(!labels.length)throw Error('لیبلی برای چاپ وجود ندارد.');
 const {width,height,pages}=batchPdfPages(labels);
 const barcodeSvg=labels[0].querySelector('.barcode svg');
 const barcodeBox=barcodeSvg?.viewBox.baseVal;
 const barcodePaths=barcodeSvg?Array.from(barcodeSvg.querySelectorAll('path'),path=>({
  shape:new Path2D(path.getAttribute('d')),
  stroke:Number(path.getAttribute('stroke-width')),
 })):[];
 const qrSvg=labels[0].querySelector('.qr svg');
 const qrImage=qrSvg?await loadLabelSvg(qrSvg):null;
 const drawPage=async(ctx,page)=>{
  for(const {label,x,y} of page){
   const origin=label.getBoundingClientRect();
   ctx.save();ctx.beginPath();ctx.rect(x,y,batchPdf.width*labelMm,batchPdf.height*labelMm);ctx.clip();
   if(barcodeBox){
    const rect=label.querySelector('.barcode').getBoundingClientRect();
    // Align Code 128 modules with whole pixels in the generated PDF.
    const dot=1/ctx.getTransform().a,labelWidth=batchPdf.width*labelMm;
    const inset=Math.min(batchPdf.width*.025,1)*labelMm;
    const available=labelWidth-2*inset;
    const dotsPerModule=Math.floor(available/(barcodeBox.width*dot));
    const width=dotsPerModule>0?barcodeBox.width*dotsPerModule*dot:available;
    const left=x+(labelWidth-width)/2;
    ctx.save();
    ctx.translate(dotsPerModule>0?Math.round(left/dot)*dot:left,y+rect.top-origin.top);
    ctx.scale(width/barcodeBox.width,rect.height/barcodeBox.height);
    ctx.strokeStyle='#000';
    for(const {shape,stroke} of barcodePaths){ctx.lineWidth=stroke;ctx.stroke(shape);}
    ctx.restore();
   }
   if(qrImage){
    const rect=label.querySelector('.qr').getBoundingClientRect();
    ctx.drawImage(qrImage,x+rect.left-origin.left,y+rect.top-origin.top,rect.width,rect.height);
   }
   for(const node of label.querySelectorAll('.name,.batch,.part,.storage')){
    const rect=node.getBoundingClientRect();
    drawBatchText(ctx,node,x+rect.left-origin.left,y+rect.top-origin.top,rect.width,rect.height);
   }
   ctx.restore();
  }
 };
 if(directLabel)return renderLabelCanvas([{label:directLabel,x:0,y:0}],batchPdf.width,batchPdf.height,drawPage,8*25.4);
 return createLabelPdf(pages,width,height,drawPage,(current,total)=>batchPdfStatus('آماده‌سازی PDF، صفحهٔ '+current.toLocaleString('fa-IR')+' از '+total.toLocaleString('fa-IR')),
 batchPdf.layout==='a4'?600:thermalDpi);
}

async function showBatchLabelPdf(){
 try{
  const pdf=await buildBatchLabelPdf();
  const {openBatchPdf}=await import('/label-pdf/batch-viewer.mjs');
  await openBatchPdf(pdf,'batch-labels.pdf',batchPdf.layout==='a4'?300:thermalDpi);
  batchPdfStatus('');
 }catch(error){
  batchPdfStatus('ساخت PDF لیبل انجام نشد. '+error.message);
 }
}
`+(printRequested?`
window.addEventListener('load',()=>{
 const url=new URL(window.location.href);
 url.searchParams.delete('print');
 window.history.replaceState(null,'',url);
 void showBatchLabelPdf();
});
`:'');
}
