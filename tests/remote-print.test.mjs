import test from 'node:test';
import assert from 'node:assert/strict';
import {runPrintJob} from '../workshop/print-worker.js';
test('print is invoked once after durable dispatch and acknowledged afterward',async()=>{
 const steps=[];await runPrintJob({id:'job'},{prepare:async()=>steps.push('prepare'),call:async action=>steps.push(action),print:()=>steps.push('print')});
 assert.deepEqual(steps,['prepare','dispatch','print','complete']);
});
test('failed preparation never starts printing',async()=>{
 const steps=[];await assert.rejects(runPrintJob({id:'job'},{prepare:async()=>{throw Error('Document load failed');},call:async action=>steps.push(action),print:()=>steps.push('print')}));
 assert.deepEqual(steps,['fail']);
});
test('lost acknowledgement never calls print again or releases dispatched job',async()=>{
 const steps=[];await assert.rejects(runPrintJob({id:'job'},{prepare:async()=>{},call:async action=>{steps.push(action);if(action==='complete')throw Error('Network');},print:()=>steps.push('print')}));
 assert.deepEqual(steps,['dispatch','print','complete']);
});
test('failed dispatch cannot invoke print',async()=>{
 const steps=[];await assert.rejects(runPrintJob({id:'job'},{prepare:async()=>{},call:async action=>{steps.push(action);if(action==='dispatch')throw Error('Lease expired');},print:()=>steps.push('print')}));
 assert.deepEqual(steps,['dispatch','fail']);
});
