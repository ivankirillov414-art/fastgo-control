import test from 'node:test';
import assert from 'node:assert/strict';
import {createDailyCheck} from '../warehouse-desktop/update-clock.cjs';
test('18:00 Orenburg once per day, persisted across restart, catch up after launch',async()=>{let stamp='',calls=0,time=Date.parse('2026-10-16T12:59:00Z');const options={read:()=>stamp,write:v=>stamp=v,now:()=>time,check:async()=>calls++};let daily=createDailyCheck(options);await daily();assert.equal(calls,0);time+=60000;await Promise.all([daily(),daily()]);assert.equal(calls,1);daily=createDailyCheck(options);await daily();assert.equal(calls,1);time=Date.parse('2026-10-17T16:00:00Z');await daily();assert.equal(calls,2);});
test('failed automatic check does not poll network every minute',async()=>{let stamp='',calls=0;const daily=createDailyCheck({read:()=>stamp,write:v=>stamp=v,now:()=>Date.parse('2026-10-16T14:00:00Z'),check:async()=>{calls++;throw Error('offline');}});await assert.rejects(daily());await daily();assert.equal(calls,1);});
