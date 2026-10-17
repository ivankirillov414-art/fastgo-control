// Only the connected, ADB-authorized iData is eligible for automatic migration.
function createAutoTerminal({terminal,blocked=()=>false}){
 let running=false;const state={message:''};
 async function tick(){
  if(running||terminal.busy||blocked())return false;
  running=true;
  try{const devices=(await terminal.devices()).filter(d=>d.state==='device'&&/idata/i.test(d.model));
   for(const d of devices){if(terminal.busy||blocked())break;state.message='Проверяем '+d.model;state.message=await terminal.installNative(d.serial,true);}
   return devices.length>0;
  }catch(e){state.message=e.message;return false;}finally{running=false;}
 }
 return {tick,state};
}
module.exports={createAutoTerminal};
