const fs=require('node:fs'),path=require('node:path');
const {atomicWrite}=require('./backup-replica.cjs');
const formats=['label','a4'];
function labelSize(value={}){
 const width=value.widthMm??58,height=value.heightMm??30;
 if(!Number.isFinite(width)||width<30||width>110||!Number.isFinite(height)||height<20||height>200)throw Error('Ширина этикетки должна быть от 30 до 110 мм, высота — от 20 до 200 мм');
 return {widthMm:Math.round(width*10)/10,heightMm:Math.round(height*10)/10};
}
function profile(value){
 if(!value||typeof value.deviceName!=='string'||!value.deviceName.trim()||value.deviceName.length>256||/[\x00-\x1f]/.test(value.deviceName)||!formats.includes(value.format))throw Error('Выберите установленный принтер и формат печати');
 return {format:value.format,deviceName:value.deviceName,...(value.format==='label'?labelSize(value):{})};
}
class PrinterProfiles{
 constructor(file){this.file=file;}
 read(){
  try{
   if(fs.statSync(this.file).size>65536)throw Error('settings_too_large');
   const data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(data.format!==1)throw Error('settings_invalid');
   const profiles={};for(const format of formats)if(data.profiles?.[format]){const p=profile(data.profiles[format]);if(p.format!==format)throw Error('settings_invalid');profiles[format]=p;}
   return {profiles};
  }catch(error){return {profiles:{},...(error.code==='ENOENT'?{}:{warning:'Не удалось прочитать сохранённый выбор принтера. Выберите принтер заново.'})};}
 }
 save(value){const p=profile(value),current=this.read(),profiles={...current.profiles,[p.format]:p};atomicWrite(this.file,Buffer.from(JSON.stringify({format:1,profiles},null,2)));return p;}
 clear(format){if(!formats.includes(format))throw Error('Неверный формат');const current=this.read();delete current.profiles[format];atomicWrite(this.file,Buffer.from(JSON.stringify({format:1,profiles:current.profiles},null,2)));return true;}
}
function printerList(printers){return (Array.isArray(printers)?printers:[]).filter(p=>typeof p.name==='string'&&p.name.length<=256).slice(0,256).map(p=>({name:p.name,displayName:/^(?:POScenter PC[- ]?365|4BARCODE 3B-365B)$/i.test(p.name)?'POScenter PC-365':typeof p.displayName==='string'?p.displayName.slice(0,256):p.name,description:typeof p.description==='string'?p.description.slice(0,256):'',status:Number.isInteger(p.status)?p.status:0,isDefault:p.isDefault===true}));}
function availablePrinter(printers,name){const found=printers.find(p=>p.name===name);if(!found)throw Error('Сохранённый или выбранный принтер не найден. Подключите его и обновите список принтеров.');return found;}
module.exports={PrinterProfiles,labelSize,profile,printerList,availablePrinter};
