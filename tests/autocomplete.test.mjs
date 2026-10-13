import test from 'node:test';
import assert from 'node:assert/strict';
import {matches,partChoices} from '../workshop/autocomplete.js';
test('parts match multiple words, model, SKU and barcode without losing identity',()=>{const choices=partChoices([{id:'a',name:'Амортизатор',model:'FGP-037',sku:'SKU1',barcode:'FGP-00000036'},{id:'b',name:'Амортизатор',model:'Другой'},{id:'c',name:'Выключенный',active:false}]);for(const q of ['аморт 037','00000036','sku1'])assert.equal(matches(choices,q)[0].item.id,'a');assert.equal(choices.length,2);});
test('matching tolerates ё and casing, excludes nonmatches, bounds results',()=>{assert.equal(matches([{value:'Колёсный'}],'КОЛЕС')[0].value,'Колёсный');assert.deepEqual(matches([{value:'Тормоз'}],'аморт'),[]);assert.equal(matches(Array.from({length:30},(_,i)=>({value:'Товар '+i})), 'товар').length,12);});

test('phone preview handles formatting, country prefix and latest contact without duplicates',async()=>{
 const {phoneQuery,clientPhoneChoices}=await import('../workshop/autocomplete.js');
 const records=[{phone:'+7 (912) 345-67-89',first_name:'Старое',created_at:'2026-01-01'},{phone:'+79123456789',first_name:'Иван',email:'client@example.test',created_at:'2026-10-13'},{phone:'+79995554433',first_name:'Другой',created_at:'2026-10-12'}];
 for(const query of ['8 (912)','+7 (912)','912','8 (912) 345-67-89']){
  const choices=clientPhoneChoices(records,query);assert.equal(choices.length,1);assert.equal(choices[0].item.first_name,'Иван');assert.equal(choices[0].item.email,'client@example.test');assert.equal(matches(choices,query).length,1);
 }
 assert.equal(phoneQuery('8 (912) 345-67-89'),'79123456789');
 assert.deepEqual(clientPhoneChoices(records,'+7'),[]);assert.deepEqual(clientPhoneChoices(records,'900'),[]);
});
