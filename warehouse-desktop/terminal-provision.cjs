const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
// Only the authorized USB shell can reach Android's DUMP-protected setup receiver.
function createTerminalProvisioner({terminal,dir,safeStorage,account,request}){
 const file=path.join(dir,'terminal-setup.bin');let running=false;
 return async serial=>{
  if(running)return '';running=true;
  try{
   const status=await terminal.nativeStatus(serial);if(status.configured)return '';
   if(status.blocking_documents>0||status.active_screen)throw Error('Завершите документы на ТСД перед подключением');
   const station=await account();if(!station?.id||!station?.token)return '';
   let pending={};if(fs.existsSync(file))pending=JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
   if(!pending[serial]){if(!safeStorage.isEncryptionAvailable())throw Error('Недоступно защищённое хранилище Windows');pending[serial]={terminal_id:randomUUID(),token:randomUUID()+randomUUID()};fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,safeStorage.encryptString(JSON.stringify(pending)));}
   const response=await request({...pending[serial],source_station_id:station.id,source_station_token:station.token});
   if(!response?.data?.auth?.refresh_token||!response.data.device?.id)throw Error('Сервер не подтвердил подключение');
   await terminal.provision(serial,response.data);
   if(!(await terminal.nativeStatus(serial)).configured)throw Error('ТСД не подтвердил сохранение подключения');
   await terminal.command(['-s',serial,'shell','am','start','-n','ru.fastgo.tsd.app/ru.fastgo.tsd.MainActivity']);
   return 'FastGo ТСД подключён к '+(response.data.device.name||'кассовому ноутбуку');
  }finally{running=false;}
 };
}
module.exports={createTerminalProvisioner};
