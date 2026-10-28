function version(value){if(typeof value!=='string'||!/^\d+\.\d+\.\d+$/.test(value))throw Error('Expected a stable Windows version');return value.split('.').map(BigInt);}
function mayBecomeLatest(candidate,currentTag){const next=version(candidate);if(!currentTag)return true;if(!currentTag.startsWith('fastgo-windows-v'))throw Error('Latest release is not a recognized common Windows channel');const current=version(currentTag.slice('fastgo-windows-v'.length));for(let i=0;i<3;i++){if(next[i]!==current[i])return next[i]>current[i];}return false;}
module.exports={mayBecomeLatest};
if(require.main===module)console.log(String(mayBecomeLatest(process.argv[2],process.argv[3])));
