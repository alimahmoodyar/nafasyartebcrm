const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache={};
function load(relative){const file=path.resolve(root,relative);if(cache[file])return cache[file];const exports={};cache[file]=exports;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),Intl,console},{filename:file});return exports;
}
const {iranLocationCatalog,iranLocationsSource,iranProvinces,iranLocalities,normalizeIranLocation}=load('lib/iran-locations.ts');
const {ProvinceCityFields}=load('components/trace/province-city-fields.tsx');
const plain=value=>JSON.parse(JSON.stringify(value));
assert.equal(iranProvinces.length,31);assert.equal(new Set(iranProvinces).size,31);
assert.equal(iranLocationsSource.year,1404);assert.equal(iranLocationsSource.license,'MIT');assert.match(iranLocationsSource.commit,/^[a-f0-9]{40}$/);assert.match(iranLocationsSource.sha256,/^[a-f0-9]{64}$/);
assert.equal(iranLocationCatalog.reduce((n,p)=>n+p.counties.length,0),484,'all source counties are retained');
assert.equal(iranLocationCatalog.reduce((n,p)=>n+p.cities.length,0),1481,'all source cities are retained');
for(const p of iranLocationCatalog){
 assert.ok(p.counties.length&&p.cities.length,'province has counties and cities '+p.province);
 assert.equal(new Set(p.counties).size,p.counties.length,'county cannot be duplicated within '+p.province);
 const options=iranLocalities(p.province);
 assert.equal(options.filter(l=>l.kind==='county').length,p.counties.length);
 assert.equal(options.filter(l=>l.kind==='city').length,p.cities.length);
 for(const [name,county] of p.cities){assert.ok(p.counties.includes(county),'explicit county relationship '+name);assert.equal(normalizeIranLocation(p.province,name).city,name);}
 for(const county of p.counties)assert.equal(normalizeIranLocation(p.province,county).city,county);
}
assert.deepEqual(plain(normalizeIranLocation('كرمان','كرمان')),{province:'کرمان',city:'کرمان'});
assert.deepEqual(plain(normalizeIranLocation(' تهران ',' تهران ')),{province:'تهران',city:'تهران'});
assert.throws(()=>normalizeIranLocation('تهران','شیراز'),/استان/);
assert.throws(()=>normalizeIranLocation('','تهران'),/ابتدا استان/);
assert.throws(()=>normalizeIranLocation('استان نامعتبر',''),/فهرست/);
assert.throws(()=>normalizeIranLocation('تهران',1),/معتبر/);
assert.throws(()=>normalizeIranLocation('تهران','x'.repeat(101)),/معتبر/);
assert.deepEqual(plain(normalizeIranLocation('تهران','')),{province:'تهران',city:''});
const old={province:'تهران',city:'نام قدیمی محله'};
assert.deepEqual(plain(normalizeIranLocation(undefined,undefined,old)),old,'omitted properties retain stored locality');
assert.deepEqual(plain(normalizeIranLocation('تهران',old.city,old)),old,'unchanged legacy pair can be edited');
assert.deepEqual(plain(normalizeIranLocation(undefined,undefined,{city:'قدیمی بدون استان'})),{province:'',city:'قدیمی بدون استان'});
assert.throws(()=>normalizeIranLocation('فارس',old.city,old),/استان/,'legacy city cannot be assigned silently to a different province');
assert.throws(()=>normalizeIranLocation('فارس',undefined,old),/استان/);
assert.throws(()=>normalizeIranLocation('تهران','قدیمی تازه',old),/استان/,'unchanged province does not allow arbitrary new legacy values');
assert.deepEqual(plain(normalizeIranLocation('فارس','شیراز',old)),{province:'فارس',city:'شیراز'});

function nodes(value){if(Array.isArray(value))return value.flatMap(nodes);if(!React.isValidElement(value))return [];return [value,...nodes(value.props.children)];}
let changed;
const tree=props=>ProvinceCityFields({...props,onChange:(province,city)=>changed={province,city}});
const select=(element,label)=>nodes(element).find(node=>node.type==='select'&&node.props['aria-label']===label);
let t=tree({province:'تهران',city:'تهران'});
assert.equal(select(t,'استان').props.required,false);assert.equal(select(t,'شهر / شهرستان').props.required,false);
select(t,'استان').props.onChange({target:{value:'فارس'}});assert.deepEqual(changed,{province:'فارس',city:''},'changing province clears even legacy/overlapping city name');
select(t,'استان').props.onChange({target:{value:'تهران'}});assert.deepEqual(changed,{province:'تهران',city:'تهران'});
select(t,'شهر / شهرستان').props.onChange({target:{value:'لواسان'}});assert.deepEqual(changed,{province:'تهران',city:'لواسان'});
assert.equal(select(tree({}),'شهر / شهرستان').props.disabled,true,'province is selected before city');
assert.equal(select(tree({province:'تهران',disabled:true}),'استان').props.disabled,true);
assert.equal(select(tree({province:'تهران',disabled:true}),'شهر / شهرستان').props.disabled,true);
assert.equal(select(tree({province:'تهران',required:true}),'شهر / شهرستان').props.required,true);
t=tree({province:'تهران',city:old.city});assert.equal(select(t,'شهر / شهرستان').props.value,old.city);assert.ok(nodes(t).some(n=>n.type==='option'&&n.props.value===old.city),'existing legacy locality is visible');
for(const p of iranLocationCatalog){const options=nodes(tree({province:p.province})).filter(n=>n.type==='option').map(n=>n.props.value);for(const county of p.counties)assert.ok(options.includes(county),'every county is available '+p.province+' / '+county);for(const [city] of p.cities)assert.ok(options.includes(city),'every city is available '+p.province+' / '+city);}
const html=renderToStaticMarkup(React.createElement(ProvinceCityFields,{province:'تهران',city:'تهران',onChange:()=>{}}));assert.ok(html.includes('شهر / شهرستان'));assert.ok(!html.includes('http'),'catalog has no runtime network dependency');
console.log('PASS iran-locations: 31 provinces, 484 counties, 1481 cities, cross-province validation, legacy preservation and real select handlers');
