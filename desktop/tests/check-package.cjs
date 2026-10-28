const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const yaml=require('js-yaml'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),dist=path.join(root,'dist');
const metadata=yaml.load(fs.readFileSync(path.join(dist,'latest.yml'),'utf8'));
const name=`FastGo-Setup-${pkg.version}-Windows-x64.exe`,file=metadata.files.find(f=>f.url===name);
assert(file);assert.equal(metadata.version,pkg.version);assert.equal(crypto.createHash('sha512').update(fs.readFileSync(path.join(dist,name))).digest('base64'),file.sha512);
assert(fs.existsSync(path.join(dist,name+'.blockmap')));
const resources=path.join(dist,'win-unpacked/resources'),feed=yaml.load(fs.readFileSync(path.join(resources,'app-update.yml'),'utf8'));
assert.equal(feed.provider,'generic');assert.equal(feed.url,pkg.build.publish.url);
const archive=path.join(resources,'app.asar');assert.match(asar.extractFile(archive,'updates.cjs').toString(),/quitAndInstall/);assert.equal(JSON.parse(asar.extractFile(archive,path.join('node_modules','electron-updater','package.json')).toString()).version,pkg.dependencies['electron-updater']);
console.log('PASS: packaged updater, public update feed, installer checksum and blockmap');

assert(asar.extractFile(archive,'warehouse-updater.cjs').toString().includes('class WarehouseUpdater'));assert(asar.extractFile(archive,'warehouse-native/backup-replica.cjs').toString().includes('class BackupReplica'));
assert(asar.extractFile(archive,path.join('warehouse-native','printer-profiles.cjs')).toString().includes('class PrinterProfiles'));

const p2base=path.join(resources,'p2-driver'),p2raw=fs.readFileSync(path.join(p2base,'manifest.json')),p2manifest=JSON.parse(p2raw);
assert.equal(crypto.createHash('sha256').update(p2raw).digest('hex'),'a2a4732c56f093f3972293abeb618cfffe71b9dbad8b03c0cf500004c0311847');
for(const f of p2manifest.files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(p2base,f.path))).digest('hex'),f.sha256,'Changed signed P2 file: '+f.path);
assert(asar.extractFile(archive,'warehouse-native/label-printer-setup.ps1').length>0);
console.log('PASS: all signed P2 driver bytes are preserved in the delivered common application');

// The final archive must contain the same warehouse UI that passed source tests.
for(const file of ['warehouse.html','warehouse/app.js','warehouse/services.js','warehouse/final-report.js','warehouse/style.css'])assert.deepEqual(asar.extractFile(archive,path.join('web',file)),fs.readFileSync(path.join(root,'web',file)),'Stale bundled UI: '+file);
assert(asar.extractFile(archive,'web/warehouse.html').toString().includes('Итоговый отчёт'));
assert(asar.extractFile(archive,path.join('web','warehouse','services.js')).toString().includes('manual-payment-grid'));
console.log('PASS: packaged warehouse payment and report assets match the tested UI');
