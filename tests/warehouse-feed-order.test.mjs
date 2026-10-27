import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('warehouse feed cannot roll back or replace immutable installer bytes',()=>{
 const script=`import importlib.util
s=importlib.util.spec_from_file_location('feed','scripts/publish-warehouse-feed.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def f(v,h='same'):return 'version: '+v+'\\nsha512: '+h+'\\n'
assert m.may_publish(f('1.0.30'),f('1.0.32'))
assert not m.may_publish(f('1.0.32'),f('1.0.31'))
assert not m.may_publish(f('1.0.32'),f('1.0.32'))
assert m.may_publish(f('1.0.9'),f('1.0.10'))
try:m.may_publish(f('1.0.32'),f('1.0.32','different'))
except RuntimeError:pass
else:raise AssertionError('immutable checksum changed')
print('feed guards passed')`;
 const result=spawnSync(process.env.FASTGO_PYTHON||'python3',['-c',script],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.error?.message);assert.match(result.stdout,/feed guards passed/);
});
