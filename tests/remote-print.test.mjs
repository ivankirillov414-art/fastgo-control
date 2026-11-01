import test from 'node:test';
import assert from 'node:assert/strict';
import {runPrintJob} from '../workshop/print-worker.js';
import {printDocumentType} from '../desktop/renderer/print-document.js';
import {renderCompletionRepair} from '../desktop/renderer/completion-renderer.js';

test('automatic act rendering refuses an unpaid or superseded revision before mounting or printing',async()=>{
 const record={status:'issued',total_amount:2000,paid_amount:2000,step_state:{completion_request_id:'new'}};
 for(const [params,value] of [[{document_type:'completion'},{...record,status:'ready'}],[{document_type:'completion'},{...record,paid_amount:1600}],[{document_type:'completion',completion_request_id:'old'},record]])await assert.rejects(renderCompletionRepair({},params,0,value),/Акт изменён или ещё не оплачен/);
});

test('completion purpose reaches the renderer while legacy intake stays compatible',()=>{
 assert.equal(printDocumentType({kind:'repair',document_type:'completion'}),'completion');
 assert.equal(printDocumentType({kind:'repair'}),'master');
 assert.equal(printDocumentType({kind:'storage',document_type:'master'}),'master');
 assert.throws(()=>printDocumentType({kind:'storage',document_type:'completion'}));
 assert.throws(()=>printDocumentType({kind:'repair',document_type:'unknown'}));
});
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
