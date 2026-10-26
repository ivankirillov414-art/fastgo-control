// Catalog of product names, checked 2026-10-13. Coverage is not exhaustive.
// Brand index: https://www.theveloindex.com/brands
// Russian scooter brand index: https://electrotransport-spb.ru/catalog/elektrosamokaty/brendy
import {suggest} from './autocomplete.js';
import {api} from './core.js';
export const brands=["ADO","ALSO","AmpdBros","Ampler","Aniioki","Apollo","Argento","Assist","Avanti","Aventon","Batch","Beeq","Benno","Biktrix","Boardman","Brompton","BTWIN","Cannondale","Canyon","Carrera","Cikada","Claud Butler","Concord","Corratec","Cowboy","Cube","Cycrown","CYKE","Cyrusher","Dawes","Delorean","Denago","Desiknio","Diamant","DiroDi","Duotts","Dyson Bikes","DYU","Earthbikes","Electra","Elops","ENGWE","ENVO","Eskute","Estarli","Falcon","Fiido","FiSHAW","Focus","Gazelle","Ghost","Giant","Haibike","Haro","Heybike","Hiboy","Hikobike","Himiway","Hygge","Hyper","iScooter","Jasion","Kingbull","KTM","Lectric","Leitner","Lekker","Lemmo","Liv","Magnum","MeloYelo","Merida","MOD Bikes","Mokwheel","Momentum","Monarc","Mondraker","Moustache","Murf","Naveetech","NCM","Nordic","Orbea","Ozark Trail","Pedal","Pixar Bikes","Polygon","Priority","Puckipuppy","QREATE","Rad Power Bikes","Raleigh","Reid","Retrospec","Ribble","Ride1Up","Riese and Muller","Rockrider","Rocky Mountain","Scott","Segway","Sharp","Sinch","Smartmotion","Specialized","Stevens","Stoer","Super73","Superhuman","Surface 604","Tarran","TEBCO","Tenways","Tern","Trek","Troxus","Urban Arrow","Urtopia","UTO","VALK","VanMoof","Vanpowers","VelectriX","Vello","Veloretti","Velotric","Velowave","Volkswagen (N Plus)","Volt","Voodoo","Wattwheels","Winora","X-Lab","Kugoo","KuKirin","Ninebot","Xiaomi","NIU","Inmotion","Dualtron","Kaabo","Yadea","AOVO","AOVOPRO","Zaxboard","Halten","Digma","Adasmart","CCL","Currus","El-Sport","E-Twow","Electroway","Euro Scooter","GT","IKINGI","IconBIT","Jack Hot","Joyor","Liming","Maxspeed","MiniPro","Okai","Samik","SdjinYing","Syccyba","Tribe","Ultron","Velocifero","Vsett","White Siberia","Wolong","xDevice","Yamato","Yokamura","Hualu","MND","Aimika","Meikalin","Acid","Gestalt","YEZENO"];
export const aliases={"Kugoo":["Kugo","Kuga","Куго","Кугу","Куга","Кугоо"],"KuKirin":["Kukirin","Kugoo Kirin","Кукирин","Куго Кирин"],"Xiaomi":["Сяоми","Ксяоми"],"Ninebot":["Найнбот","Nine Bot"],"Segway":["Сегвей"],"NIU":["Ниу"],"Inmotion":["Инмоушен"],"Dualtron":["Дуалтрон","Minimotors"],"Kaabo":["Каабо"],"Halten":["Халтен"],"Yadea":["Ядеа"],"ENGWE":["Энгве"],"Fiido":["Фидо"],"Zaxboard":["Заксборд"],"AOVO":["Аово"],"Wolong":["Волонг","Волонкаш"]};
export const modelGroups=[["Kugoo","First|E2|F2 Plus|S3 Max|F2 Pro|F2|M2 Plus|EX|Max Speed|Max Speed Plus|Max Speed Pro|M4|M4 Pro|M4 Pro Plus|M4 Pro Max|M5|M5 Pro|M3|M3 Pro|M2 Pro|G2 Max|G2 Pro Max|G4 Max|First Bike|V1-S|U27|U14|V3|V3-29|K20|V3 FAT|V3 Pro Plus|V5|V4 Pro X2|LR 2|F1 X2|Cargo 20|U6|V5 Pro X2|F1 Pro X2|MM-29|ZX DUAL X2|Zero 20 X2|EC16 FAT|EC02|C2 Pro|C2F|First Enduro|Wish 01 Pro|Wish 02 Pro|Wish 04|V3 Pro|V1 Max|V4 Pro|V4 Max|V6|V3 Pro Max|V3 Ultra|V1 Pro|V3 Max|V1|V1 Plus|G3 Pro|G2 Pro|F3 Pro Max|F4 Pro|F4 Max|F1 Pro|F1 Pro Max|F2 Max|F2 Pro Max|G-Booster|F3 Plus|G1|G4 Pro|F3 Pro|S3 Pro|S4|S8 Pro|HX Pro|HX Plus|S3|HX|S1 Plus|X1|S1|LX 10 Pro|LX 11 Plus|EC 02 Pro|C1 Pro Plus|LX 10 Plus|C1 Pro|LX 9 Plus|C1 Plus|Wish 04 Pro|Wish 01 SE|Wish 01 Max|Wish 02|Wish 02 Mini|Wish 03|Wish 01|L2 Pro|L2 Pro Plus|Trike|T1|T2|T3|C4","https://kugoo.ru/shop/ https://kugoo-russia.ru/electrosamokaty"],["KuKirin","G2|G2 VMP|G2 Pro|G2 Pro VMP|G2 Max|G2 Master|G2 Ultra|G3|G3 Pro|G4|G4 Max|G4 Ultra|M4|M4 Max|T3","https://kukirin.se/collections/all-products"],["NIU","KQi1 Pro|KQi 100P|KQi 100F|KQi 200P|KQi 200F|KQi 300P|KQi 300X|KQi Air|KQi Air X|BQi-C3 Pro|Fat Tire 300 Step Over|NQi GTS|MQi GT","https://shop.niu.com/ https://global.niu.com/product-overview"],["Xiaomi","Electric Scooter 4 Pro|Electric Scooter 4 Pro 2nd Gen|Electric Scooter 5 Pro|Electric Scooter Elite","https://www.mi.com/se/product/xiaomi-electric-scooter-5-pro/ https://buy.mi.com/es/accessories/615"],["Segway","F2|F2 Pro E II|Max G3|ZT3 Pro|GT2|GT3 E|GT3 Pro","https://www.segway.com/ekickscooter/products.html"],["Ninebot","MAX G2|MAX G3 E|F3","https://service.segway.com/"],["Inmotion","S1|S1F|Climber|Air|Air Pro|RS|RS Lite|RS Jet|C10","https://eu.inmotionworld.com/collections/electric-scooter"],["Dualtron","Victor|Victor Limited|Thunder|Thunder II|Thunder 3|Spider|Spider II|Spider Max","https://www.dual-tron.com/"],["Kaabo","Mantis 8|Mantis 10|Wolf Warrior 11","https://www.kaabousa.com/blogs/blog/how-to-adjust-your-e-scooters-p-settings-easily"],["Fiido","C11|C11 Pro|C21|D3 Pro|Air|Titan|Nomads|M1 Pro","https://fiido.com/collections/electric-bikes"],["ENGWE","M1|M20|M20 2.0|E26|E26 3.0 Pro|EP-2 Pro|EP-2 Boost|EP-2 3.0 Boost|Engine Pro 2.0|Engine Pro 3.0 Boost|Engine X|L20|L20 Boost|L20 3.0 Pro|L20 3.0 Boost|O20 Boost|P275 SE|P20|N1 Pro|N1 Air|Y700|Y1000|T14|P275 ST|Y600|Y400|X20|X24|X26|LE20|P275 Pro|C20 Pro|P26","https://engwe.com/pages/manuals https://engwe-bikes-eu.com/sv/collections/host-rea"],["Yadea","G10|Nex|ElitePrime|Trooper01|Velax|GT25|Owin|GT20|EPOC","https://store.yadea.com/ https://yadea.com.tr/"],["Hualu","H10|H28","FastGo inventory supplied by owner"],["Meikalin","H10","FastGo inventory supplied by owner"],["Aimika","U2 Premium Pro","FastGo inventory supplied by owner"],["Acid","E7","FastGo inventory supplied by owner"],["Gestalt","001","FastGo inventory supplied by owner"],["YEZENO","2 Pro","FastGo inventory supplied by owner"]];
export const vehicles=modelGroups.flatMap(([brand,models,source])=>models.split('|').map(model=>({brand,model,source})));
const norm=v=>String(v??'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\+/g,' plus ').replace(/[‐–—]/g,'-').replace(/\s+/g,' ').trim();
const names=brands.flatMap(brand=>[brand,...(aliases[brand]||[])].map(name=>({brand,name,normalized:norm(name)}))).sort((a,b)=>b.normalized.length-a.normalized.length);
function brandPrefix(value){const n=norm(value);return names.find(x=>n===x.normalized||n.startsWith(x.normalized+' '));}
const phonetic=value=>norm(value).replace(/[а-я]/g,c=>({а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ж:'zh',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'}[c])).replace(/kugoo|kuga|kugo|kugu/g,'kugo').replace(/max/g,'maks').replace(/speed/g,'spid').replace(/plyus/g,'plus').replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim();
const tokens=value=>phonetic(value).split(' ').filter(Boolean);
const sameWords=(a,b)=>tokens(a).sort().join(' ')===tokens(b).sort().join(' ');
export function splitEquipment(value){
 const text=String(value??'').replace(/\s+/g,' ').trim(),known=brandPrefix(text);
 if(known){const words=known.name.trim().split(/\s+/).length;return {brand:known.brand,model:text.split(' ').slice(words).join(' ')};}
 const [brand='',...rest]=text.split(' ');return {brand,model:rest.join(' ')};
}
export function equipmentChoices(query,history=[]){
 const q=norm(query);if(!q)return [];
 const prefix=brandPrefix(query),canonical=prefix?norm(prefix.brand)+' '+norm(splitEquipment(query).model):q;
 const words=tokens(canonical),seen=new Set();
 const candidates=[...brands.map(brand=>({brand,model:''})),...vehicles,...history];
 return candidates.filter(x=>{
  const key=phonetic(x.brand+' '+(x.model||''));if(seen.has(key))return false;seen.add(key);
  const search=phonetic([x.brand,x.model,...(aliases[x.brand]||[])].join(' '));
  return words.every(w=>search.includes(w));
 }).sort((a,b)=>{
  const score=x=>sameWords(x.brand+' '+(x.model||''),query)||x.model&&sameWords(x.model,query)?0:1;
  return score(a)-score(b);
 }).slice(0,40).map(item=>({value:item.brand+(item.model?' '+item.model:''),label:item.brand+(item.model?' '+item.model:''),search:query,item}));
}
export function resolveEquipment(query,history=[]){
 const choices=equipmentChoices(query,history).filter(x=>x.item.model&&(sameWords(x.value,query)||sameWords(x.item.model,query)));
 return choices.length===1?choices[0].item:null;
}
export function bindEquipment(input,form,setDirty){
 const history=[];let selected=null;const preview=document.createElement('p');preview.className='muted';preview.setAttribute('role','status');preview.style.cssText='margin:8px 0 0;font-size:13px';input.after(preview);
 const sync=()=>{const item=selected||resolveEquipment(input.value,history);form.elements.brand.value=item?.brand||'';form.elements.model.value=item?.model||'';input.setCustomValidity(input.value.trim()&&!item?.model?'Выберите бренд и модель из подсказок':'');preview.textContent=item?.model?'Выбрано: '+item.brand+' '+item.model:input.value.trim()?'Выберите технику из подсказок. Название сохранится как в каталоге.':'Начните вводить модель или бренд — например «макс спид».';return !!item?.model;};
 suggest(input,q=>equipmentChoices(q,history),choice=>{selected=choice.item.model?choice.item:null;sync();setDirty(true);if(!choice.item.model){input.value=choice.item.brand+' ';input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));}});
 input.addEventListener('input',()=>{selected=null;sync();});input.addEventListener('blur',()=>{if(sync())input.value=form.elements.brand.value+' '+form.elements.model.value;});sync();
 let loaded=false;
 input.addEventListener('focus',()=>{
  if(loaded)return;loaded=true;
  Promise.allSettled(['repair','storage'].map(kind=>api('list',{kind,status:'all',limit:100}))).then(results=>{
   if(!input.isConnected)return;
   for(const result of results)if(result.status==='fulfilled')for(const record of result.value.items||[])if(record.brand)history.push({brand:record.brand,model:record.model||''});
   if(document.activeElement===input)input.dispatchEvent(new Event('input',{bubbles:true}));
  });
 });
 return sync;
}
