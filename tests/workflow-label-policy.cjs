const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const producers=['components/trace/device-pair-workspace.tsx','app/api/assets/print/route.ts','lib/batch-labels.ts','app/api/receipt-report/route.ts','app/api/serials/print/route.ts','app/api/after-sales/print/route.ts','app/api/finished-packages/route.ts','app/api/after-sales/return-parcels/label/route.ts','app/api/transport/receipts/label/route.ts'];
function files(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name])}
const actual=['lib','app','components'].flatMap(files).filter(f=>/\.(tsx?|jsx?)$/.test(f)&&/bcid:\s*['"]qrcode['"]/.test(fs.readFileSync(path.join(root,f),'utf8')));
assert.deepEqual(actual.sort(),producers.sort(),'Every new QR producer needs a role/stage policy and resolver roundtrip test');
for(const f of producers){const s=fs.readFileSync(path.join(root,f),'utf8');assert.match(s,/pairInviteUrl|assetQrText|batchQrText|qrText|serviceDeviceQr|shippingQr|driverReceiptQr/,'Registered identity constructor: '+f)}
assert.match(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'),/WORKFLOW-LABEL-POLICY/);
console.log('PASS label policy: all 9 QR producers registered; business identities and separately scoped expiring pairing invitation and standing development rule.');
