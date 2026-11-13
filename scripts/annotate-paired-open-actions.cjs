// Explicit, reviewable markers for state-only UI actions. Never instruments
// arbitrary handlers, business submissions, writes or unknown callbacks.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const skip=/device-pair-workspace|camera|photo|assistant|auth|credential|user-profile|user-management|role-testing|system-reset|mcp-token|llm-config/;
const pureMethods=new Set(['map','flatMap','filter','find','some','every','includes','indexOf','slice','split','join','trim','replace','replaceAll','toString','toLowerCase','toLocaleLowerCase','startsWith','endsWith','sort','reduce','concat','at','toLocaleString','normalize','json','text','preventDefault','toISOString','getFullYear','getMonth','getDate','padStart','padEnd']);
const pureGlobals=new Set(['String','Number','Boolean','BigInt','parseInt','parseFloat','isNaN','Error','tehranDay']);
function inspect(file){
 const text=fs.readFileSync(path.join(root,file),'utf8'),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),setters=new Set(),functions=new Map();
 const walk=(n,fn)=>{fn(n);ts.forEachChild(n,c=>walk(c,fn))};
 walk(sf,n=>{if(ts.isVariableDeclaration(n)&&ts.isArrayBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(sf)==='useState'){const setter=n.name.elements[1]?.name;if(setter&&ts.isIdentifier(setter))setters.add(setter.text)}if(ts.isFunctionDeclaration(n)&&n.name)functions.set(n.name.text,n);if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))functions.set(n.name.text,n.initializer)});
 function safe(node,seen=new Set()){
  if(!node)return false;
  let ok=true;walk(node,n=>{
   
   if(ts.isBinaryExpression(n)&&n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&n.operatorToken.kind<=ts.SyntaxKind.LastAssignment&&/^(window|document|location|navigator|localStorage|sessionStorage)\b/.test(n.left.getText(sf)))ok=false;
   if(ts.isNewExpression(n)&&!['Date','Map','Set','Error'].includes(n.expression.getText(sf)))ok=false;
   if(!ts.isCallExpression(n))return;const e=n.expression;
   if(ts.isIdentifier(e)){
    if(setters.has(e.text)||pureGlobals.has(e.text)||['onNavigate','onOpen','onClose','onChange'].includes(e.text))return;
    if(e.text==='fetch'){
     const options=n.arguments[1];if(!options)return;
     if(!ts.isObjectLiteralExpression(options)||options.properties.some(p=>ts.isSpreadAssignment(p))){ok=false;return;}
     const method=options.properties.find(p=>(p.name&&ts.isStringLiteral(p.name)?p.name.text:p.name?.getText(sf))==='method');if(method&&(!ts.isPropertyAssignment(method)||!ts.isStringLiteral(method.initializer)||!['GET','HEAD'].includes(method.initializer.text)))ok=false;
     return;
    }
    const fn=functions.get(e.text);if(!fn||seen.has(e.text)||!safe(fn,new Set([...seen,e.text])))ok=false;
   }else if(ts.isPropertyAccessExpression(e)){
    const name=e.getText(sf);if(/^(crypto\.randomUUID|Date\.now|JSON\.(parse|stringify)|Object\.(keys|values|entries|fromEntries)|Math\.[a-zA-Z]+)$/.test(name))return;
    if(!pureMethods.has(e.name.text))ok=false;
   }else ok=false;
  });return ok;
 }
 const edits=[],entries=[];
 walk(sf,node=>{if(!ts.isJsxOpeningElement(node)&&!ts.isJsxSelfClosingElement(node)||!['article','tr','li','section','div'].includes(node.tagName.getText(sf)))return;const attrs=node.attributes.properties;if(attrs.some(a=>ts.isJsxAttribute(a)&&a.name.getText(sf)==='data-pair-row'))return;const key=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText(sf)==='key')?.initializer;if(key&&ts.isJsxExpression(key)&&key.expression&&/\.(id|key|code)\b/.test(key.expression.getText(sf)))edits.push({pos:node.tagName.end,value:' data-pair-row={JSON.stringify('+key.expression.getText(sf)+')}'})});
 walk(sf,node=>{
  if(!ts.isJsxOpeningElement(node)&&!ts.isJsxSelfClosingElement(node)||!['button','form'].includes(node.tagName.getText(sf)))return;
  const attrs=node.attributes.properties,attr=name=>attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText(sf)===name);
  const existing=attr('data-pair-open');if(existing&&!process.argv.includes('--verify'))return;
  const manual=existing?.initializer?.text;if(['personal-home:000000000001','program-workspace:000000000001','program-workspace:000000000002'].includes(manual)){entries.push({file,marker:manual,manualNavigation:true});return;}
  const isForm=node.tagName.getText(sf)==='form';const click=attr(isForm?'onSubmit':'onClick')?.initializer;if(!click||!ts.isJsxExpression(click)||!click.expression)return;
  let fn=click.expression;if(ts.isIdentifier(fn))fn=functions.get(fn.text);if(!fn||!safe(fn)){if(existing)throw Error('Unsafe paired UI marker in '+file+': '+existing.getText(sf));return;}
  const type=attr('type')?.initializer?.getText(sf);let parent=node.parent,inForm=false;while(parent){if(ts.isJsxElement(parent)&&parent.openingElement.tagName.getText(sf)==='form')inForm=true;parent=parent.parent;}
  if(!isForm&&(type&&type!=="'button'"&&type!=='"button"'||inForm&&!type))return;
  const innerBindings=new Set();walk(fn,n=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))innerBindings.add(n.name.text);if(ts.isParameter(n)&&ts.isIdentifier(n.name))innerBindings.add(n.name.text)});
  const items=new Set();const key=attr('key')?.initializer;if(key&&ts.isJsxExpression(key)&&key.expression)items.add(key.expression.getText(sf));
  walk(fn,n=>{if(ts.isPropertyAccessExpression(n)&&n.name.text==='id'&&ts.isIdentifier(n.expression)&&!innerBindings.has(n.expression.text))items.add(n.getText(sf))});
  if(existing){entries.push({file,marker:existing.initializer.text,verified:true});return;}
  const marker=path.basename(file,'.tsx')+':'+createHash('sha256').update(file+':'+node.pos).digest('hex').slice(0,12);
  const insert=' data-pair-open="'+marker+'"'+(items.size?' data-pair-item={JSON.stringify(['+[...items].join(',')+'])}':'');
  edits.push({pos:node.tagName.end,value:insert});entries.push({file,marker,handler:click.expression.getText(sf).slice(0,180),items:[...items]});
 });
 if(process.argv.includes('--write')&&edits.length){let result=text;for(const e of edits.sort((a,b)=>b.pos-a.pos))result=result.slice(0,e.pos)+e.value+result.slice(e.pos);fs.writeFileSync(path.join(root,file),result)}
 return entries;
}
const files=fs.readdirSync(path.join(root,'components/trace')).filter(f=>f.endsWith('.tsx')&&!skip.test(f)).map(f=>'components/trace/'+f);
const entries=files.flatMap(inspect);console.log(JSON.stringify({count:entries.length,files:new Set(entries.map(e=>e.file)).size,entries},null,2));
