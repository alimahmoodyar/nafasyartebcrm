const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/iran-iban.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
const iban='IR220000000000000000000001',digits=iban.slice(2),{normalizeIranIban,validIranIban,iranIbanDigits,iranIbanError}=out;
for(const value of [iban,digits,'ir'+digits,' IR22 0000 0000 0000 0000 0000 01 ',iban.replace(/\d/g,c=>'۰۱۲۳۴۵۶۷۸۹'[Number(c)]),digits.replace(/\d/g,c=>'٠١٢٣٤٥٦٧٨٩'[Number(c)])]){assert.equal(normalizeIranIban(value),iban);assert.equal(validIranIban(value),true);assert.equal(iranIbanDigits(value),digits);assert.equal(iranIbanError(value,true),'')}
for(const value of ['',null,undefined,123456,'IR','IRIR'+digits,'DE'+digits,digits.slice(1),digits+'0','2.2e+23',iban.slice(0,-1)+'X',digits.slice(0,-1)+'-'])assert.equal(validIranIban(value),false,JSON.stringify(value));
assert.equal(iranIbanError('',false),'');assert.ok(iranIbanError('',true));assert.ok(iranIbanError(digits.slice(1),true));
for(let i=2;i<iban.length;i++){const changed=iban.slice(0,i)+(Number(iban[i])+1)%10+iban.slice(i+1);assert.equal(validIranIban(changed),false,'Single digit typo at '+i)}
assert.equal(normalizeIranIban('00001234'),'IR00001234','Leading zeros survive normalization');
console.log('PASS local SHEBA: complete/numeric-only input, Persian/Arabic digits, spacing, leading zeros, exact length, foreign prefixes, required/optional fields and every single-digit typo');
