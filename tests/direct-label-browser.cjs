const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const ts = require('typescript');
const zx = createRequire(require.resolve('@zxing/browser'))('@zxing/library');
const root = path.resolve(__dirname,'..');
function load(file) {
  const exports={};
  let code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,URLSearchParams,require(name){
    if(name==='./authorization')return {AccessError:Error};
    if(name==='@bwip-js/generic')return require(path.join(root,'node_modules/@bwip-js/generic/dist/bwip-js-gen.mjs'));
    return name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);
  }});
  return exports;
}
(async()=>{
  const {batchLabelHtml,batchLabelOptions}=load(path.join(root,'lib/batch-labels.ts'));
  let code='991002-14050812-001';
  const query=new URLSearchParams('layout=thermal&symbol=both&width=45&height=30&copies=2');
  const multi=process.argv.includes('--multi');
  if(multi){query.set('layout','roll');query.set('columns','2');query.set('rollWidth','92');query.set('copies','3');}
  let html=await batchLabelHtml({id:'sample',data:{code,part:'ابر آکوستیک',partCode:'991002'}},batchLabelOptions(query),false,code,'');
  const receipt=process.argv.includes('--receipt');
  if(receipt){
    const {directLabelPanel}=load(path.join(root,'lib/direct-label.ts'));
    const {qrcode,drawingSVG}=require(path.join(root,'node_modules/@bwip-js/generic/dist/bwip-js-gen.mjs'));
    const qr=qrcode({bcid:'qrcode',text:code,scale:2,padding:4},drawingSVG());
    html='<html><style>article{width:60mm;height:40mm;}article svg{width:28mm;height:28mm}</style><body>'+directLabelPanel(60,40,'article')+'<article>'+qr+'</article></body></html>';
  }
  const asset=process.argv.includes('--asset');
  if(asset){
    const id='00000000-0000-4000-8000-000000000001';
    code='NAFASYAR-ASSET/1:'+id;
    html=await load(path.join(root,'lib/asset-print.ts')).assetPrintHtml({id,name:'چاپگر لیبل',code:'AM-001245',registrationNumber:3},query,[],false,false);
    assert.ok(html.includes('class="label approved-asset"'));
  }
  let finish;
  const done=new Promise(resolve=>finish=resolve);
  const probe=`<script>
  const originalFetch=window.fetch;
  window.fetch=(url,args)=>String(url).startsWith('http://127.0.0.1:18743/')?originalFetch('/mock/'+url.split('/').pop(),args):originalFetch(url,args);
  window.addEventListener('load',async()=>{
    await document.querySelector('[data-connect]').onclick();
    document.querySelector('[data-send]').click();
    new MutationObserver(()=>{const s=document.querySelector('[data-status]').textContent;if(!s.startsWith('آماده‌سازی لیبل'))originalFetch('/status',{method:'POST',body:s});}).observe(document.querySelector('[data-status]'),{childList:true});
  });</script>`;
  let job;
  const server=createServer(async(req,res)=>{
    const url=req.url;
    if(url==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; style-src 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-src 'self'"});res.end(html.replace('</body>',probe+'</body>'));return;}
    if(url==='/mock/printers'){res.end(JSON.stringify({printers:['Test G500'],version:'1.0.0'}));return;}
    if(url==='/mock/jobs'||url==='/status'){
      let body='';for await(const part of req)body+=part;
      if(url.endsWith('jobs')){job=JSON.parse(body);res.end('{"queued":true}');}
      else{res.end();finish(body);}return;
    }
    const file=['/label-printer/direct.js','/label-printer/html2canvas.min.js','/fonts/Vazirmatn.woff2','/brand/nafasyar-logo.png'].includes(url)&&path.join(root,'public',url);
    if(file&&fs.existsSync(file)){res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'font/woff2'});res.end(fs.readFileSync(file));}else res.writeHead(404).end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const chrome=process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const child=spawn(chrome,['--headless=new','--disable-gpu','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'direct-label-')),'http://127.0.0.1:'+server.address().port],{stdio:'ignore',windowsHide:true});
  const timer=setTimeout(()=>finish('browser timeout'),40000);
  try{
    const status=await done;
    assert.ok(job,status);
    assert.deepEqual([job.width,job.height,job.pages.length],multi?[736,240,2]:receipt?[480,320,1]:[360,240,2]);
    const bytes=Buffer.from(job.pages[0],'hex'),gray=new Uint8ClampedArray(job.width*job.height);
    for(let i=0;i<gray.length;i++)gray[i]=(bytes[i>>3]&(128>>(i%8)))?0:255;
    const bitmap=new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.RGBLuminanceSource(gray,job.width,job.height)));
    for(const format of (receipt||asset?[zx.BarcodeFormat.QR_CODE]:[zx.BarcodeFormat.QR_CODE,zx.BarcodeFormat.CODE_128])){
      const hints=new Map([[zx.DecodeHintType.POSSIBLE_FORMATS,[format]],[zx.DecodeHintType.TRY_HARDER,true]]);
      if(multi){
        for(const offset of [0,376]){
          const cropped=new Uint8ClampedArray(360*240);
          for(let y=0;y<240;y++)cropped.set(gray.subarray(y*736+offset,y*736+offset+360),y*360);
          const region=new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.RGBLuminanceSource(cropped,360,240)));
          assert.equal(new zx.MultiFormatReader().decode(region,hints).getText(),code);
        }
      }else assert.equal(new zx.MultiFormatReader().decode(bitmap,hints).getText(),code);
    }
    console.log(multi?'PASS two-column 92 mm roll, both codes readable in each column, partial final row':asset?'PASS approved asset layout at 45x30 mm with decodable asset QR':receipt?'PASS single receipt label QR at 60x40 mm':'PASS direct print actual batch page: selected printer, two 45x30 mm labels, QR and Code128 decoded.');
  }finally{clearTimeout(timer);child.kill();server.close();server.closeAllConnections();}
})().catch(e=>{console.error(e);process.exitCode=1;});
