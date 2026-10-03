const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(js,{exports,require:n=>{if(n.startsWith('.')||n.startsWith('@/')){let p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);if(!path.extname(p))p+=fs.existsSync(p+'.ts')?'.ts':'.tsx';return load(p)}return require(n)},Date,Intl,Map,Set,console,URL,Request,Response,crypto:globalThis.crypto,process,setTimeout,clearTimeout},{filename:file});return exports;}
const c=load('lib/persian-date.ts'),analytics=load('lib/device-analytics.ts'),dist=load('lib/distribution.ts');
for(const [solar,iso]of [['۱۴۰۵/۰۷/۱۱','2026-10-03'],['۱۴۰۳/۱۲/۳۰','2025-03-20'],['1404/01/01','2025-03-21'],['١٤٠٥/٧/١١','2026-10-03']]){
 assert.equal(c.parseCalendarDay(solar),iso);assert.equal(c.parseCalendarDay(c.solarDateText(iso)),iso);assert.equal(c.parseCalendarDay(iso),iso);
}
for(const invalid of ['',null,'1404/12/30','1405/07/31','1405/13/01','2026-02-30','11/07/1405','1405/07/00','۱۴۰۵/۰۷/۳۲'])assert.equal(c.parseCalendarDay(invalid),'');
assert.equal(c.parseCalendarDay(new Date('2026-10-03T00:00:00Z')),'2026-10-03','Excel dates preserve their day');
assert.equal(c.solarMonthDays(1403,12),30);assert.equal(c.solarMonthDays(1404,12),29);assert.equal(c.solarMonthDays(1405,6),31);assert.equal(c.solarMonthDays(1405,7),30);
assert.equal(c.localDay('2026-10-02T20:29:59Z'),'2026-10-02');assert.equal(c.localDay('2026-10-02T20:30:00Z'),'2026-10-03');
assert.equal(c.formatDate('2026-10-03'),'۱۴۰۵/۰۷/۱۱');assert.equal(c.formatDate('2026-10-02T20:30:00Z'),'۱۴۰۵/۰۷/۱۱');assert.equal(c.formatDate('2026-10-03T00:00:00+03:30'),'۱۴۰۵/۰۷/۱۱');
assert.equal(c.formatDate(''),'—');assert.equal(c.formatDate('2026-02-30'),'تاریخ نامعتبر');assert.equal(c.formatDateTime('bad'),'تاریخ نامعتبر');
assert.match(c.formatDateTime('2026-10-02T20:30:00Z'),/۱۱.*مهر.*۱۴۰۵/);assert.match(c.formatDateTime('2026-10-02T20:30:00Z'),/۰:۰۰|۰۰:۰۰/);
const original={date:'2026-10-03',created:'2026-10-02T20:30:00Z',notes:'2026-10-03',from:'line',rows:[{validFrom:'2026-10-03'}]},raw=JSON.stringify(original),display=c.calendarDisplay(original);
assert.equal(display.date,'۱۴۰۵/۰۷/۱۱');assert.equal(display.rows[0].validFrom,'۱۴۰۵/۰۷/۱۱');assert.equal(display.notes,'2026-10-03');assert.equal(display.from,'line');assert.equal(JSON.stringify(original),raw,'Stored values and optimistic snapshots must not change');
const input={serial:'NF-001',dealerName:'نماینده',dealerDate:'۱۴۰۵/۰۷/۱۱'};assert.equal(dist.normalizeDistribution(input).dealerDate,'2026-10-03');assert.equal(input.dealerDate,'۱۴۰۵/۰۷/۱۱');assert.throws(()=>dist.normalizeDistribution({...input,dealerDate:'۱۴۰۴/۱۲/۳۰'}));
const from=c.solarToIso(1405,5,1),to=c.solarToIso(1405,7,1),rows=[{date:from,count:2},{date:to,count:3}],daily=analytics.buckets(rows,from,to,false),monthly=analytics.buckets(rows,from,to,true);
assert.equal(daily.length,63);assert.equal(daily.at(-1).date,to);assert.equal(daily.reduce((a,r)=>a+r.count,0),5);assert.deepEqual(Array.from(monthly,r=>r.count),[2,0,3]);assert.match(monthly[2].label,/مهر ۱۴۰۵/);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{SolarDate}=load('components/trace/solar-date.tsx');
for(const [value,required]of [['2026-10-03',true],['',false],['1404/12/30',true]]){const html=renderToStaticMarkup(React.createElement(SolarDate,{label:'تاریخ',value,required,onChange(){}}));assert.match(html,/شمسی/);assert.ok(!html.includes('type="date"'));if(!value)assert.match(html,/اختیاری/);if(value==='1404/12/30')assert.match(html,/تاریخ معتبر انتخاب کنید/);}
console.log('Persian dates passed: leap/invalid dates, Tehran midnight, Excel text/date parsing, preserved stored snapshots, complete daily/monthly ranges, optional/invalid picker rendering. TZ='+process.env.TZ);
