const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {createRequire} = require('node:module');
const {pathToFileURL} = require('node:url');
const ts = require('typescript');

const root = path.resolve(__dirname,'..');
const output = process.env.BATCH_PDF_QA_DIR || fs.mkdtempSync(path.join(os.tmpdir(),'batch-pdf-'));
const chrome = process.env.CHROME_BIN || [
 'C:/Program Files/Google/Chrome/Application/chrome.exe',
 '/usr/bin/chromium',
 '/usr/bin/google-chrome',
].find(fs.existsSync);
assert.ok(chrome,'Set CHROME_BIN');
fs.mkdirSync(output,{recursive:true});
const localRequire = createRequire(path.join(root,'package.json'));
const zx = createRequire(localRequire.resolve('@zxing/browser'))('@zxing/library');
const cache = new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const exports = {};
 cache.set(file,exports);
 const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 vm.runInNewContext(code,{exports,URLSearchParams,require:specifier=>{
  if(specifier==='./authorization')return {AccessError:Error};
  if(specifier==='@bwip-js/generic')return localRequire(path.join(root,'node_modules/@bwip-js/generic/dist/bwip-js-gen.mjs'));
  return specifier.startsWith('.')?load(path.resolve(path.dirname(file),specifier+'.ts')):localRequire(specifier);
 }});
 return exports;
}

function run(command,args){
 const result = spawnSync(command,args,{windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024});
 assert.equal(result.status,0,String(result.error||result.stderr));
 return result.stdout;
}

function verifyCodes(file,expected){
 const prefix = path.join(output,'thermal-203dpi');
 run('pdftoppm',['-f','1','-l','1','-singlefile','-r','203',file,prefix]);
 const ppm = fs.readFileSync(prefix+'.ppm');
 const header = /^P6\s+(\d+)\s+(\d+)\s+255\r?\n/.exec(ppm.toString('latin1',0,100));
 assert.ok(header);
 const w = Number(header[1]), h = Number(header[2]);
 const gray = new Uint8ClampedArray(w*h);
 for(let pixel=0;pixel<gray.length;pixel++)gray[pixel]=ppm[header[0].length+pixel*3];
 const bitmap = new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.RGBLuminanceSource(gray,w,h)));
 for(const format of [zx.BarcodeFormat.CODE_128,zx.BarcodeFormat.QR_CODE]){
  const hints = new Map([[zx.DecodeHintType.POSSIBLE_FORMATS,[format]],[zx.DecodeHintType.TRY_HARDER,true]]);
  assert.equal(new zx.MultiFormatReader().decode(bitmap,hints).getText(),expected);
 }
 // The last millimetre of the printed label is blank rather than carrying page furniture.
 assert.ok(gray.slice(w*(h-7)).every(pixel=>pixel>250));
}

(async()=>{
 const {batchLabelHtml,batchLabelOptions} = load(path.join(root,'lib/batch-labels.ts'));
 const font = fs.readFileSync(path.join(root,'public/fonts/Vazirmatn.woff2')).toString('base64');
 const batch = {id:'test-batch',data:{code:'991002-14050812-001',part:'ابر آکوستیک',partCode:'991002'}};
 const samples = [
  {name:'thermal-45x30',query:'layout=thermal&copies=2',width:45,height:30,pages:2},
  {name:'roll-test-row',query:'layout=roll&rollWidth=94&columns=2&gapX=2&gapY=2&left=1&top=1&copies=5&print=test',width:94,height:32,pages:1},
  {name:'roll',query:'layout=roll&rollWidth=94&columns=2&gapX=2&gapY=2&left=1&top=1&copies=5',width:94,height:32,pages:3},
  {name:'a4',query:'layout=a4&copies=35',width:210,height:297,pages:2},
 ];
 for(const sample of samples){
  const query = new URLSearchParams(sample.query+'&width=45&height=30&symbol=both');
  const markup = await batchLabelHtml(batch,batchLabelOptions(query),false,batch.data.code,'قفسه ۲');
  assert.ok(!markup.includes('window.print()'));
  const probe = `<pre id="pdf-result"></pre><script>
window.addEventListener('load',async()=>{
 const result=document.getElementById('pdf-result');
 try{
  const pdf=await buildBatchLabelPdf();
  const reader=new FileReader();
  reader.onload=()=>{result.textContent=reader.result.split(',')[1]};
  reader.readAsDataURL(pdf);
 }catch(error){result.textContent='ERROR '+error.message}
});
</script>`;
  const html = path.join(output,sample.name+'.html');
  fs.writeFileSync(html,markup
   .replace("url('/fonts/Vazirmatn.woff2')",'url(data:font/woff2;base64,'+font+')')
   .replace('<head>',"<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'\">")
   .replace('</body>',probe+'</body>'));
  const dom = run(chrome,['--headless=new','--disable-gpu','--disable-extensions','--no-first-run',
   '--user-data-dir='+path.join(output,'chrome-'+sample.name),'--virtual-time-budget=15000','--dump-dom',pathToFileURL(html).href]);
  const payload = /<pre id="pdf-result">([^<]+)<\/pre>/.exec(dom)?.[1];
  assert.ok(payload&&!payload.startsWith('ERROR'),payload||'Browser PDF generation did not complete');
  const content = Buffer.from(payload,'base64');
  assert.doesNotMatch(content.toString('latin1'),/\/(URI|Annots|CreationDate|Metadata)\b/);
  const pdf = path.join(output,sample.name+'.pdf');
  fs.writeFileSync(pdf,content);
  const info = run('pdfinfo',[pdf]);
  assert.match(info,new RegExp('Pages:\\s+'+sample.pages+'\\b'));
  const dimensions = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info);
  assert.ok(dimensions);
  for(const [i,mm] of [sample.width,sample.height].entries()){
   assert.ok(Math.abs(Number(dimensions[i+1])*25.4/72-mm)<.03,info);
  }
  if(sample.name==='thermal-45x30')verifyCodes(pdf,batch.data.code);
  console.log('PASS',sample.name,sample.pages+' page(s)',sample.width+'×'+sample.height+' mm');
 }
 console.log('PASS Code 128 and QR at 203 dpi from the actual 45×30 PDF. Footer is blank.');
 console.log(output);
})().catch(error=>{console.error(error);process.exitCode=1});
