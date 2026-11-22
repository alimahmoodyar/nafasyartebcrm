// Test the browser-to-renderer path with PDF only; never submit a physical job.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer}=require('node:http'),{spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../public'), folder=fs.mkdtempSync(path.join(os.tmpdir(),'hamnafas-office-'));
const origin='https://newcrm.nafasyar.com';
(async()=>{
 let complete;
 const done=new Promise(resolve=>complete=resolve);
 const server=createServer(async(req,res)=>{
  try{
   if(req.url==='/'){
    const word=process.argv.includes('--word');
    const source=word?'<div id="word"><style>section.docx{break-after:page}</style><section class="docx">FIRST-PAGE</section><section class="docx">SECOND-PAGE</section></div>':'<section>FIRST-PAGE</section><section>SECOND-PAGE</section>';
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<!doctype html><html dir="rtl"><style>@font-face{font-family:Vazirmatn;src:url(/fonts/Vazirmatn.woff2)}body{font-family:Vazirmatn}@page{size:A5;margin:8mm}section{break-after:page}</style><body>${source}<button data-office-print data-width="148" data-height="210">چاپ</button><script src="/label-printer/documents.js"></script><script>
    const baseFetch=window.fetch;window.fetch=(url,args)=>baseFetch(String(url).startsWith('http://127.0.0.1:18743/')?'/bridge/'+url.split('/').pop():url,args);
    window.onload=async()=>{if(document.querySelector('#word'))window.hamnafasDocuments.open({source:document.querySelector('#word'),width:148,height:210});else document.querySelector('[data-office-print]').click();
    const timer=setInterval(()=>{const b=document.querySelector('[data-pdf]');if(b&&!b.disabled){clearInterval(timer);b.click();}},50);};
    </script></body></html>`);return;
   }
   if(req.url.startsWith('/bridge/')){
    let input='';for await(const part of req)input+=part;
    const endpoint=req.url.slice(8);
    if(endpoint==='documents'){
     const j=JSON.parse(input);
     assert.equal(j.mode,'pdf');assert.match(j.html,/FIRST-PAGE/);assert.match(j.html,/SECOND-PAGE/);assert.ok(j.html.includes('data:font/')||j.html.includes('base64,'));
     assert.ok(!/<(?:button|script|dialog|input)\b/i.test(j.html));
    }else assert.equal(endpoint,'printers');
    const r=await fetch('http://127.0.0.1:18743/'+endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:input});
    assert.ok(r.ok,'Bridge returned '+r.status);
    const reply=await r.json();res.end(JSON.stringify(reply));
    if(reply.pdf){fs.writeFileSync(path.join(folder,'document.pdf'),Buffer.from(reply.pdf,'base64'));complete('ok');}return;
   }
   const file={'/fonts/Vazirmatn.woff2':'font/woff2','/label-printer/documents.js':'text/javascript'}[req.url];
   if(!file){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',file);res.end(fs.readFileSync(path.join(root,req.url)));
  }catch(e){res.writeHead(500).end();complete(e.message);}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=spawn(process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--user-data-dir='+path.join(folder,'chrome'),'http://127.0.0.1:'+server.address().port],{windowsHide:true,stdio:'ignore'});
 const timer=setTimeout(()=>complete('Timeout'),45000);
 try{
  assert.equal(await done,'ok');
  const pdf=path.join(folder,'document.pdf');
  const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});assert.match(info,/Pages:\s+2/);assert.match(info,/Page size:.*A5/);
  const prefix=path.join(folder,'rendered');
  execFileSync('pdftoppm',['-gray','-r','96',pdf,prefix]);
  for(const file of fs.readdirSync(folder).filter(f=>f.endsWith('.pgm'))){
    const contents=fs.readFileSync(path.join(folder,file));assert.ok(contents.filter(value=>value<80).length>50,'Empty rendered page');
  }
  console.log('PASS selected document, embedded font, two A5 pages with content through Windows renderer.');
 }finally{clearTimeout(timer);browser.kill();server.close();server.closeAllConnections();}
})().catch(e=>{console.error(e);process.exitCode=1;});
