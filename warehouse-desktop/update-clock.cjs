// Orenburg is UTC+5. Persist the attempted day before starting network work.
function createDailyCheck({read,write,check,now=()=>Date.now()}){
 let last=read()||'',running=false;
 return async function daily(){
  const local=new Date(now()+5*60*60*1000),day=local.toISOString().slice(0,10);
  if(running||local.getUTCHours()<18||last>=day)return false;
  running=true;last=day;
  try{write(day);await check();return true;}finally{running=false;}
 };
}
module.exports={createDailyCheck};
