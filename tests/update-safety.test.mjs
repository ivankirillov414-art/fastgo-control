import test from 'node:test';
import assert from 'node:assert/strict';
import {installUpdateSafety} from '../workshop/update-safety.js';
function setup(){let time=0,dirty=false,modal=false,focused=false;const events={};const window={location:{hash:'#home'},fastgoHasUnsavedChanges:()=>dirty,addEventListener:(n,f)=>events[n]=f};const document={body:{inert:false},querySelector:()=>modal,activeElement:{matches:()=>focused}};installUpdateSafety({window,document,now:()=>time});return{window,document,events,setTime:v=>time=v,setDirty:v=>dirty=v,setModal:v=>modal=v,setFocus:v=>focused=v};}
test('downloaded update waits through intake, failed save, focus loss and inactivity; only saved and exited form permits installation',()=>{
 const x=setup();x.window.location.hash='#new?kind=repair';x.setDirty(true);x.setTime(900000);assert.equal(x.window.fastgoUpdateSafe(),false);assert.equal(x.window.fastgoUpdateSafe(true),false);
 // Losing focus and failed save must not be interpreted as saving.
 x.setFocus(false);assert.equal(x.window.fastgoUpdateSafe(true),false);
 x.window.location.hash='#repairs';assert.equal(x.window.fastgoUpdateSafe(true),false);
 x.setDirty(false);x.events.hashchange();assert.equal(x.window.fastgoUpdateSafe(),false);x.setTime(1020001);assert.equal(x.window.fastgoUpdateSafe(),true);
});
test('update now cannot bypass an open modal, active field or missing application guard',()=>{const x=setup();x.setModal(true);assert.equal(x.window.fastgoLockForUpdate(true),false);x.setModal(false);x.setFocus(true);assert.equal(x.window.fastgoLockForUpdate(true),false);x.setFocus(false);delete x.window.fastgoHasUnsavedChanges;assert.equal(x.window.fastgoLockForUpdate(true),false);});
test('new input between first check and restart cancels installation; lock is reversible on installer error',()=>{const x=setup();x.setTime(120001);assert.equal(x.window.fastgoUpdateSafe(),true);x.events.input();x.setDirty(true);assert.equal(x.window.fastgoLockForUpdate(),false);assert.equal(x.document.body.inert,false);x.setDirty(false);x.setTime(240002);assert.equal(x.window.fastgoLockForUpdate(),true);assert.equal(x.document.body.inert,true);assert.equal(x.window.fastgoLockForUpdate(true),false);x.window.fastgoReleaseUpdateLock();assert.equal(x.document.body.inert,false);assert.equal(x.window.fastgoUpdateSafe(),false);assert.equal(x.window.fastgoUpdateSafe(true),true);});
test('manual update accepts a saved repair and its own progress window; automatic update still waits for a list',()=>{
 const x=setup();x.window.location.hash='#order?kind=repair&id=example';x.setTime(900000);
 x.document.querySelector=selector=>{assert.match(selector,/:not\(#desktop-update-progress\)/);return null;};
 assert.equal(x.window.fastgoUpdateSafe(),false);assert.equal(x.window.fastgoUpdateSafe(true),true);
 x.setDirty(true);assert.match(x.window.fastgoUpdateBlockReason(true),/Сохраните/);assert.equal(x.window.fastgoLockForUpdate(true),false);
});
