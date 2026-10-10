import test from 'node:test';
import assert from 'node:assert/strict';
import {matches,partChoices} from '../workshop/autocomplete.js';
test('parts match multiple words, model, SKU and barcode without losing identity',()=>{const choices=partChoices([{id:'a',name:'Амортизатор',model:'FGP-037',sku:'SKU1',barcode:'FGP-00000036'},{id:'b',name:'Амортизатор',model:'Другой'},{id:'c',name:'Выключенный',active:false}]);for(const q of ['аморт 037','00000036','sku1'])assert.equal(matches(choices,q)[0].item.id,'a');assert.equal(choices.length,2);});
test('matching tolerates ё and casing, excludes nonmatches, bounds results',()=>{assert.equal(matches([{value:'Колёсный'}],'КОЛЕС')[0].value,'Колёсный');assert.deepEqual(matches([{value:'Тормоз'}],'аморт'),[]);assert.equal(matches(Array.from({length:30},(_,i)=>({value:'Товар '+i})), 'товар').length,12);});
