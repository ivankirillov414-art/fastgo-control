import test from 'node:test';
import assert from 'node:assert/strict';
import {submitControl} from '../workshop/form-submit.js';
test('keeps the clicked submit control when the browser supplies it',()=>{
 const button={};assert.equal(submitControl({submitter:button}),button);
});
test('Android WebView without SubmitEvent.submitter still gets the save control',()=>{
 const button={},form={querySelector:selector=>{assert(selector.includes('button[type="submit"]'));return button;}};
 assert.equal(submitControl({currentTarget:form}),button);
 assert.equal(submitControl({submitter:null,currentTarget:form}),button);
});
