import{test}from'node:test';import assert from'node:assert/strict';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),{WAREHOUSE_URL,registerTerminalLauncher}=require('../warehouse-desktop/warehouse-bridge.cjs');
test('warehouse button opens USB updater only from its trusted main frame',()=>{
 let handler,opened=0;const frame={url:WAREHOUSE_URL},contents={mainFrame:frame},win={isDestroyed:()=>false,webContents:contents};
 registerTerminalLauncher({handle:(name,fn)=>{assert.equal(name,'terminal:open');handler=fn;}},()=>win,()=>opened++);
 assert.equal(handler({sender:contents,senderFrame:frame}),true);assert.equal(opened,1);
 for(const event of [{sender:{},senderFrame:frame},{sender:contents,senderFrame:{url:WAREHOUSE_URL}}])assert.throws(()=>handler(event),/Недоступно/);
 for(const url of ['https://evil.test/fastgo-control/warehouse.html','https://ivankirillov414-art.github.io/fastgo-control/warehouse-terminal.html','file:///warehouse.html']){frame.url=url;assert.throws(()=>handler({sender:contents,senderFrame:frame}),/Недоступно/);}
 frame.url=WAREHOUSE_URL;win.isDestroyed=()=>true;assert.throws(()=>handler({sender:contents,senderFrame:frame}),/Недоступно/);assert.equal(opened,1);
});
