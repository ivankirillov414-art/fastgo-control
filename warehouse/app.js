import {hasManualPaymentDraft} from './manual-payment-state.js';
import {mountFinalReport} from './final-report.js';
import {mountServices,mountManualPayment} from './services.js';
import {scanError} from './scan-policy.js';
import {installScannerDiagnostics} from './scanner-diagnostics.js';
import {startReceiptLabels} from './receipt-labels.js';
import {startNotifications} from '../workshop/notifications.js';
import {avitoApi} from './client.js';
import {unknownScans} from './unknown-scans.js';
import {productPanel} from './product-panel.js';
import {partPhotos} from './part-photos.js';
import {newPartForm} from './new-part.js';
import {offerLabelPrinting,mobileLabelOffer} from './label-offer.js';
import {startWebUpdates} from './web-update.js';
import {repairPayment} from './repair-payment.js?v=20261016-scan-2';
import {liveBasket} from './live-basket.js?v=20261016-scan-2';
import {bindUSBInbox} from './usb-client.js';
import {bindScanner} from './scanner.js';
import {installPaymentScanner} from './payment-scanner.js';
import {setupLabelPrinter,printerSetupAvailable} from './printer-settings.js';
import {mountPreorders,preorderAccess} from './preorders.js';
import {api,serviceApi,login,logout,userId,esc,money,uuid,matchBarcode} from './client.js';
import {installViewportLayout} from '../workshop/viewport-layout.js';
import {installWindowControls} from './window-controls.js';
installViewportLayout({header:document.querySelector('body > header')});
installWindowControls({bar:document.querySelector('body > header')});
const formValues=form=>{const p={};new FormData(form).forEach((v,k)=>p[k]=v);return p;};
const $=id=>document.getElementById(id),terminal=document.body.dataset.mode==='terminal';let device,parts=[],staff=[],screen='home',draft,job,busy=false,polling=false,memberRole='',lastActivity=Date.now();
let stopScanner,stopUSB,preorderView,serviceView;
if(!terminal&&!window.warehouseDesktop&&matchMedia('(max-width:760px)').matches)for(const id of ['usb-scanner','terminal-update'])if($(id))$(id).hidden=true;
const serviceLink=$('warehouse-service');if(serviceLink)serviceLink.hidden=!(window.fastgoDesktop||new URLSearchParams(location.search).get('unified')==='1');
serviceLink?.addEventListener('click',e=>{if(!window.fastgoWarehouseCanLeave?.()){e.preventDefault();message('Завершите документ перед переходом в сервис',true);}});
const networkButton=$('network-diagnostics');if(networkButton){networkButton.hidden=!window.warehouseDesktop?.openNetworkDiagnostics;networkButton.onclick=()=>window.warehouseDesktop.openNetworkDiagnostics().catch(e=>message(e.message,true));}
const printerButton=$('printer-settings');if(printerButton){printerButton.hidden=!printerSetupAvailable();printerButton.onclick=setupLabelPrinter;}
const key=n=>'fgwarehouse:'+userId()+':'+n;
const load=n=>{try{return JSON.parse(localStorage.getItem(key(n))||'null');}catch{throw Error('Не удалось прочитать сохранённый документ');}};
const save=(n,v)=>localStorage.setItem(key(n),JSON.stringify(v));
const repair=repairPayment({call:(a,p)=>call(a,p),render:html=>{live.cleanup();screen='repair';shell(html);},home,run,message,load,save});
const live=liveBasket({terminal,call:(a,p)=>call(a,p),parts:()=>parts,render:html=>{screen='live';shell(html);},home,run,message,load,save,refresh:catalog,repair:q=>repair.terminal(q),stationRepair:(q,id)=>repair.station(q,id),canOpen:canReceiveIncoming,manual:()=>run(showManualPayment)});
const call=(action,p={})=>{if(!device&&document.body.dataset.readonly==='true'){if(action==='catalog')return api('service_catalog');if(action==='inventory_edit')return serviceApi(action,p);if(action==='work_catalog')return api('service_catalog').then(c=>c.services);if(action==='work_catalog_save')return serviceApi('catalog_save',p);throw Error('Приход, оплата и ТСД доступны на двух подключённых ноутбуках. Здесь доступен просмотр склада.');}return api(action,{device_id:device?.id,device_token:device?.token,...p});};
let receiptNoticeTimer;
function clearReceiptNotice(){clearTimeout(receiptNoticeTimer);document.getElementById('receipt-label-notice')?.remove();}
const receiptLabels=!terminal?startReceiptLabels({call:(a,p)=>device?call(a,p):Promise.resolve([]),notify:value=>{clearTimeout(receiptNoticeTimer);let box=$('receipt-label-notice');if(!box){box=document.createElement('p');box.id='receipt-label-notice';box.setAttribute('role','status');$('message').after(box);}box.textContent=value.text;box.className=value.ok?'notice':'error';if(value.ok)receiptNoticeTimer=setTimeout(clearReceiptNotice,10000);}}):null;
function applyReadOnly(){if(document.body.dataset.readonly!=='true')return;if(!window.warehouseDesktop)for(const id of ['usb-scanner','terminal-update','network-diagnostics','printer-settings'])if($(id))$(id).hidden=true;for(const id of ['receipt','pay','nav-receipt','nav-pay','shift','usb-scanner','terminal-update'])if($(id)){$(id).disabled=true;$(id).title='Доступно на подключённом складском ноутбуке';}}
const unknown=unknownScans({call:(a,p)=>call(a,p),parts:()=>parts,refresh:catalog,run,message,owner:()=>['owner','developer'].includes(memberRole)});
function message(v,error=false){$('message').textContent=v;$('message').className=error?'error':'';}
let scannerTest=null;installScannerDiagnostics({parts:()=>parts,report:async extra=>{if(extra.scan_test)scannerTest=extra.scan_test;lastDeviceStatus=0;await desktopStatus();}});
if(!terminal)installPaymentScanner({enabled:()=>!!device&&!busy&&!nativeUpdatePending&&document.body.dataset.readonly!=='true'&&!['login','connection','connect','setup','basket','manual-payment','services'].includes(screen)&&!document.querySelector('dialog[open]'),parts:()=>parts,refresh:catalog,observed:scan=>{scannerTest={...scan,source:'atol'};lastDeviceStatus=0;void desktopStatus();},error:text=>message(text,true),accept:scan=>run(async()=>{
 if(job||screen==='repair'||!live.canPaymentScan())throw Error('Завершите или отмените текущую оплату. Скан отменён.');
 if(scan.kind==='parts'){await live.issueParts(scan.code);return;}
 if(scan.kind==='repair'){
  if(live.hasDraft())throw Error('Завершите или отмените текущий документ перед оплатой ремонта. Скан отменён.');
  const quote=await call('repair_quote',{code:scan.code});await repair.station(quote);return;
 }
 await live.acceptPaymentScan(scan.code);
})});
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(x=>x.disabled=true);try{await fn();}catch(e){message(e.message,true);}finally{busy=false;document.querySelectorAll('button').forEach(x=>x.disabled=x.dataset.unavailable==='true');applyReadOnly();}}
for(const e of ['keydown','pointerdown','input','change'])window.addEventListener(e,()=>lastActivity=Date.now(),true);
window.warehouseUpdateSafe=(immediate=false)=>!window.fastgoServiceCatalogDirty?.()&&!hasManualPaymentDraft(load('manual-service-payment'))&&!busy&&!usbPolling&&(['home','inventory','holdings','preorders','services','manual-payment','report','login','connection'].includes(screen)||!terminal&&screen==='live')&&!job&&(terminal||!draft&&!live.hasDraft())&&!document.querySelector('#mirror-submit,dialog[open],.modal')&&!(document.activeElement?.matches('input:not([type=search]):not([data-payment-scan]),textarea,select,[contenteditable]')&&!document.activeElement.closest('.preorder-filters'))&&![...document.querySelectorAll('#login input')].some(input=>input.value)&&(immediate||Date.now()-lastActivity>15000);
window.addEventListener('beforeunload',e=>{try{live.checkpoint();}catch(error){message(error.message,true);e.preventDefault();e.returnValue='';return;}if(window.fastgoServiceCatalogDirty?.()||hasManualPaymentDraft(load('manual-service-payment'))||busy||screen==='basket'||screen==='checkout'||screen==='repair'||screen==='live'&&live.hasDraft()){e.preventDefault();e.returnValue='';}});
function shell(html){clearReceiptNotice();if(serviceView){serviceView.dispose?.();serviceView=null;}if(preorderView){preorderView.dispose();preorderView=null;}document.body.dataset.screen=screen;const section=document.getElementById('warehouse-section');if(section)section.textContent=({home:'Главная',services:'Ремонтные работы','manual-payment':'Ручная оплата',report:'Итоговый отчёт',preorders:'Предзаказы',inventory:'Остатки',holdings:'Запчасти на мастерах',shift:'Открыть смену',receipt:'Приход',live:live.kind()==='receipt'?'Приход':'Оплата',repair:'Оплата ремонта'})[screen]||'';if(stopUSB){stopUSB();stopUSB=null;}if(stopScanner){stopScanner();stopScanner=null;}$('app').innerHTML=html;message('');if(!terminal)bindNav();}
function nav(){if(!terminal)return '';return '<div class="subnav"><button id="back">← Главное</button>'+(!terminal?'<button id="inventory">Остатки</button><button id="shift">Открыть смену</button>'+(['owner','developer'].includes(memberRole)?'<button id="master-stock">Запчасти на мастерах</button>':'')+'':'')+'</div>';}
async function showServices(){if(window.fastgoServiceCatalogDirty?.())throw Error('Сохраните или отмените изменение прайса');if(live.hasDraft()||job||draft)throw Error('Завершите текущий документ');screen='services';shell('<div id="service-root"></div>');serviceView=mountServices({root:$('service-root'),call,editor:['owner','developer','admin'].includes(memberRole),message});await serviceView.ready;}
async function showManualPayment(){if(terminal||document.body.dataset.readonly==='true')throw Error('Приём оплаты доступен на кассовом ноутбуке');if(live.hasDraft()||job||draft)throw Error('Завершите текущий документ');live.suspend();screen='manual-payment';shell('<div id="service-payment-root"></div>');serviceView=mountManualPayment({root:$('service-payment-root'),call,load,save,home,message});await serviceView.ready;}
async function showPreorders(){screen='preorders';shell('<h1>Предзаказы</h1><div id="preorder-root"></div>');preorderView=mountPreorders({root:$('preorder-root'),call:serviceApi,actor:userId()});await preorderView.ready;}
async function showFinalReport(){if(terminal||document.body.dataset.readonly==='true')throw Error('Отчёт доступен на кассовом ноутбуке');if(live.hasDraft()||job||draft||load('manual-service-payment')?.items?.length)throw Error('Завершите текущий документ перед открытием отчёта');live.suspend();screen='report';shell('<div id="final-report-root"></div>');serviceView=mountFinalReport({root:$('final-report-root'),call});await serviceView.ready;}
function bindNav(){if($('final-report')){$('final-report').hidden=terminal||document.body.dataset.readonly==='true';$('final-report').onclick=()=>run(showFinalReport);}if($('service-catalog')){$('service-catalog').hidden=terminal;$('service-catalog').onclick=()=>run(showServices);}if($('preorders')){$('preorders').hidden=!preorderAccess({role:memberRole});$('preorders').onclick=()=>run(showPreorders);}if($('nav-receipt'))$('nav-receipt').onclick=()=>run(()=>live.open('receipt'));if($('nav-pay'))$('nav-pay').onclick=()=>run(()=>live.open('sale'));if($('master-stock'))$('master-stock').hidden=!['owner','developer'].includes(memberRole);document.querySelectorAll('.warehouse-sidebar button').forEach(b=>b.classList.toggle('active',b.id===(screen==='report'?'final-report':screen==='services'?'service-catalog':screen==='inventory'?'inventory':screen==='holdings'?'master-stock':screen==='preorders'?'preorders':screen==='shift'?'shift':screen==='live'?(live.kind()==='receipt'?'nav-receipt':'nav-pay'):'back')));applyReadOnly();if($('back'))$('back').onclick=home;if($('inventory'))$('inventory').onclick=()=>run(inventory);if($('shift'))$('shift').onclick=shift;if($('master-stock'))$('master-stock').onclick=()=>run(holdings);}
function notifications(){if(terminal)return;startNotifications({actor:userId(),call:avitoApi,station:async()=>device});const bell=document.querySelector('.fg-notice-bell');if(bell)document.querySelector('body > header').append(bell);}
async function catalog(){const c=await call('catalog');parts=c.parts;staff=c.staff;try{save('catalog:'+document.body.dataset.mode,{device_id:device?.id,parts,staff,role:memberRole});}catch{message('Не удалось сохранить каталог для работы без сети.',true);}}
function usbHelp(){return '<details class="panel"><summary>Подключение по USB</summary><p>На ноутбуке откройте «Сканер по USB» и нажмите «Открыть сканер на терминале». На iData должен открыться отдельный экран «FastGo · USB» с кнопками «Приход» и «Оплата».</p><p>Для USB интернет на терминале не нужен. Разрешите USB-отладку и выберите браузер, если Android его предложит.</p></details>';}
async function connectTerminal(){
 screen='connect';shell('<h1>Выбор ноутбука</h1><p>Ищем складские рабочие места…</p><button id="connect-retry">Обновить список</button>'+usbHelp());$('connect-retry').onclick=()=>run(connectTerminal);
 const stations=await api('stations');
 const connect=async station=>{let pending=load('terminal-connection');if(!pending||pending.station_id!==station.id){pending={station_id:station.id,terminal_id:uuid(),token:uuid()+uuid()};save('terminal-connection',pending);}device=await api('connect_terminal',pending);save('terminal',device);save('terminal-connection',null);await start();};
 if(stations.length===1)return connect(stations[0]);
 shell('<h1>Выбор ноутбука</h1><p>'+(stations.length?'Выберите рабочее место, на которое передавать корзины. Код не нужен.':'Сначала войдите в FastGo Склад на ноутбуке и создайте рабочее место.')+'</p><div id="stations" class="panel"></div><button id="connect-retry">Обновить список</button>'+usbHelp());
 for(const station of stations){const button=document.createElement('button');button.textContent=station.name+(stations.filter(x=>x.name===station.name).length>1?' · '+new Date(station.created_at).toLocaleString('ru-RU'):'');button.onclick=()=>run(()=>connect(station));$('stations').append(button);}
 $('connect-retry').onclick=()=>run(connectTerminal);
}
async function start(){
 if(!userId())return signIn();
 device=load(terminal?'terminal':'station');draft=load('draft:'+document.body.dataset.mode);$('logout').hidden=false;
 if(!device){if(!terminal&&(new URLSearchParams(location.search).get('unified')==='1'||!window.warehouseDesktop)){document.body.dataset.readonly='true';memberRole=(await serviceApi('me')).role;if(memberRole==='mechanic')throw Error('Этот раздел недоступен вашей роли');await catalog();$('connection').textContent='Каталог склада · общее приложение';home();await inventory();message('Приход, оплата и подключение ТСД доступны на двух разрешённых ноутбуках. Цену и остаток владелец может изменить в карточке товара.');return;}if(!terminal)return setup();try{return await connectTerminal();}catch(e){return connectionError(e);}}
 try{const info=await call('info');memberRole=info.member.role;notifications();$('connection').textContent=info.device.name+' · интернет';await catalog();home();if(!terminal){if(new URLSearchParams(location.search).get('section')==='inventory')await inventory();await live.restore();}}
 catch(e){
  if(e.status===401){signIn();message('Войдите снова. Сохранённый документ останется на устройстве.',true);return;}
  if(e.status!==403){const cached=load('catalog:'+document.body.dataset.mode);if(cached?.device_id===device.id&&Array.isArray(cached.parts)){parts=cached.parts;staff=cached.staff||[];memberRole=cached.role||'';home();if(!terminal)await live.restore();$('connection').textContent='Нет связи · сканы сохраняются';message('Можно продолжать сканировать. Передайте документ после восстановления связи.',true);return;}}
  connectionError(e);
 }
}
function connectionError(e){screen='connection';shell('<h1>Нет подключения к складу</h1><p>Сохранённые документы остаются на устройстве.</p><button id="retry">Подключиться снова</button>'+(terminal?'<button id="choose-station">Выбрать ноутбук</button>':'')+usbHelp());$('retry').onclick=()=>run(start);if($('choose-station'))$('choose-station').onclick=()=>run(connectTerminal);message(e.message,true);}
function signIn(){window.fastgoNotifications?.stop();screen='login';$('logout').hidden=true;shell('<h1>'+ (terminal?'Терминал FastGo':'FastGo Склад')+'</h1><form id="login" class="panel" style="max-width:420px"><label>Почта сотрудника<input name="email" type="email" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Войти</button></form>'+(terminal?usbHelp():''));$('login').onsubmit=e=>{e.preventDefault();const p=formValues(e.target);run(async()=>{await login(p.email,p.password);await start();});};}
function setup(){if(terminal)return connectTerminal();screen='setup';shell('<h1>Новое складское рабочее место</h1><form id="setup" class="panel"><label>Название кассы / ноутбука<input name="value" required autocomplete="off"></label><button class="primary">Создать рабочее место</button></form>');$('setup').onsubmit=e=>{e.preventDefault();const value=e.target.elements.value.value;run(async()=>{let pending=load('station-registration');if(!pending){pending={station_id:uuid(),token:uuid()+uuid()};save('station-registration',pending);}device=await api('register',{name:value,...pending});save('station',device);save('station-registration',null);await start();});};}
function home(){product.close();live.cleanup();screen='home';job=null;shell((terminal?'':nav())+'<h1>'+ (terminal?'Складской терминал':'Рабочее место склада')+'</h1><div class="homebuttons"><button class="primary" id="receipt">Приход</button><button class="primary" id="pay">Оплата</button></div>'+(terminal?'<button class="primary" id="repair-scan">Оплата ремонта</button>':'')+(draft&&!terminal?'<div class="panel">Есть сохранённый документ <button id="resume">Продолжить</button></div>':'')+(!terminal?'<section class="panel"><div id="live-terminal-panel"></div><div id="queue" aria-live="polite">Проверяем…</div><section id="unknown-scans"></section></section>':usbHelp()));bindNav();$('receipt').onclick=()=>run(()=>live.open('receipt'));$('pay').onclick=()=>run(()=>live.open('sale'));if($('repair-scan'))$('repair-scan').onclick=repairScan;if($('resume'))$('resume').onclick=()=>basket(draft.kind,true);if(!terminal){void poll();void pollUSB();}}
function repairScan(){screen='repair-scan';shell(nav()+'<h1>Оплата ремонта</h1><form id="repair-scan-form"><label>QR ремонта<input id="repair-code" autocomplete="off"></label><button>Сканировать</button></form>');const input=$('repair-code'),form=$('repair-scan-form');form.onsubmit=e=>{e.preventDefault();const code=input.value.trim();input.value='';const error=scanError('repair',code);if(error){message(error,true);return;}void run(async()=>{const quote=await call('repair_quote',{code});await repair.terminal(quote);});};stopScanner=bindScanner(input,form,()=>!busy&&screen==='repair-scan');}
function basket(kind,resume=false){if(terminal&&draft&&!resume&&draft.kind===kind)resume=true;if(draft&&!resume){message('Сначала откройте «'+(draft.kind==='receipt'?'Приход':'Оплата')+'» и завершите или отмените документ.',true);return;}screen='basket';if(!resume){draft={id:uuid(),kind,items:[],note:''};save('draft:'+document.body.dataset.mode,draft);}shell(nav()+'<h1>'+(kind==='receipt'?'Приход':'Оплата — сбор корзины')+'</h1><form id="scan"><label>Штрихкод / артикул<input id="barcode" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"></label><button>Добавить</button></form><div id="usb-inbox" class="actions"></div><div id="basket" class="panel '+(kind==='receipt'?'receipt':'')+'"></div>'+(kind==='receipt'?'<label>Поставщик / номер документа<input id="note" value="'+esc(draft.note)+'"></label>':'')+'<div class="actions"><button class="primary" id="send">'+(kind==='receipt'?'Провести приход':'Передать на ноутбук')+'</button><button id="discard">Отменить документ</button></div>');bindNav();drawBasket();$('scan').onsubmit=e=>{e.preventDefault();if(!busy){if(!terminal&&draft.kind==='receipt'){message('АТОЛ используется для оплаты и выдачи мастеру. Для прихода используйте ТСД.',true);$('barcode').value='';}else addCode($('barcode').value.trim());}};if($('note'))$('note').oninput=e=>{draft.note=e.target.value;persist();};$('send').onclick=()=>run(send);$('discard').onclick=()=>{if(confirm('Отменить этот документ? Остатки не изменятся.')){if(window.warehouseDesktop?.usbRelease)void window.warehouseDesktop.usbRelease(usbKey()).catch(e=>message(e.message,true));draft=null;save('draft:'+document.body.dataset.mode,null);home();}};stopScanner=bindScanner($('barcode'),$('scan'),()=>!busy&&screen==='basket');stopUSB=bindUSBInbox({key:usbKey(),label:kind==='receipt'?'Приход':'Оплата',container:$('usb-inbox'),enabled:()=>!busy&&screen==='basket'&&!document.activeElement.hasAttribute('data-qty'),add:item=>addCode(item.code,item.id),error:v=>message(v,true)});}
function usbKey(){return userId()+':'+draft.id;}
function addCode(code,usbId){
 if(!code)return false;
 if(usbId&&draft.usb_ids?.includes(usbId))return true;
 const found=matchBarcode(parts,code);
 if(found.length!==1){message(found.length?'Код неоднозначен. Уточните товар на ноутбуке.':'Код не найден. Создайте или привяжите товар в общей базе FastGo.',true);if(!usbId){$('barcode').focus();$('barcode').select();}return false;}
 const before=JSON.stringify(draft),old=draft.items.find(x=>x.part_id===found[0].id);
 if(old)old.quantity++;else draft.items.push({part_id:found[0].id,quantity:1});
 if(usbId)(draft.usb_ids||(draft.usb_ids=[])).push(usbId);
 try{persist();}catch(e){draft=JSON.parse(before);throw e;}
 if(!usbId)$('barcode').value='';drawBasket();message('Добавлено: '+found[0].name+' · '+draft.items.find(x=>x.part_id===found[0].id).quantity+' шт.');
 if(!usbId||!document.activeElement.matches('input,textarea,select'))$('barcode').focus();return true;
}
async function finishUSB(){if(window.warehouseDesktop?.usbRelease)await window.warehouseDesktop.usbRelease(usbKey());}
function persist(){save('draft:'+document.body.dataset.mode,draft);}
function drawBasket(){const target=$('basket');target.innerHTML=draft.items.length?draft.items.map(x=>{const p=parts.find(p=>p.id===x.part_id);return '<div class="row"><div>'+esc(p?.name||'Товар недоступен')+'<small>'+esc(p?.barcode||'')+' · остаток '+(p?.quantity??'—')+'</small></div><input type="number" min="1" max="1000" value="'+x.quantity+'" aria-label="Количество" data-qty="'+x.part_id+'"><span class="price">'+money(p?.retail_price)+'</span><button data-remove="'+x.part_id+'" aria-label="Удалить">×</button></div>';}).join(''):(terminal?'Наведите сканер на штрихкод и нажмите зелёную кнопку на терминале. Товар добавится автоматически. Вручную код можно ввести в поле выше.':'Сканируйте товар или введите штрихкод / артикул и нажмите «Добавить».');target.querySelectorAll('[data-qty]').forEach(el=>el.onchange=()=>{const n=Number(el.value);if(!Number.isInteger(n)||n<1||n>1000){message('Количество от 1 до 1000',true);return;}draft.items.find(x=>x.part_id===el.dataset.qty).quantity=n;persist();});target.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{draft.items=draft.items.filter(x=>x.part_id!==b.dataset.remove);persist();drawBasket();$('barcode').focus();});}
async function send(){if(window.warehouseDesktop?.usbTarget){await window.warehouseDesktop.usbTarget(null);if((await window.warehouseDesktop.usbBatch(usbKey())).items.length)throw Error('Дождитесь добавления USB-сканов или пропустите неизвестный код.');}if(!draft.items.length)throw Error('Добавьте товары');if(draft.kind==='receipt'){if(!draft.note.trim())throw Error('Укажите поставщика / документ');await call('receipt',{request_id:draft.id,items:draft.items,note:draft.note});await finishUSB();draft=null;save('draft:'+document.body.dataset.mode,null);await catalog();home();message('Приход проведён. Остатки обновлены.');return;}
 const queued=await call('enqueue',{request_id:draft.id,items:draft.items});const queuedId=queued.id;await finishUSB();draft=null;save('draft:'+document.body.dataset.mode,null);if(terminal){screen='sent';shell('<h1>Передано на ноутбук</h1><p>Ожидает подтверждения кассиром.</p><p>Корзина '+esc(queuedId.slice(0,8))+'</p><button id="sent-back">Главное</button><button id="sent-status">Проверить статус</button>');$('sent-back').onclick=home;$('sent-status').onclick=()=>run(async()=>{const r=await call('job',{id:queuedId});message(r?.state==='done'?'Проведено':r?.state==='processing'?'Кассир завершает операцию':'Ожидает кассира');});}else await checkout(await call('job',{id:queuedId}));}
function canReceiveIncoming(){return !busy&&!job&&!draft&&['home','live','inventory','holdings','preorders'].includes(screen)&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input:not(#live-code):not(#filter):not([data-payment-scan]),textarea,select');}
const autoQueueSeen=new Set();
async function poll(){
 if(terminal||!canReceiveIncoming()||!live.canAutoOpen()||polling||!device)return;polling=true;
 try{
  const jobs=await call('queue');if(!canReceiveIncoming()||!live.canAutoOpen())return;
  const next=jobs.filter(x=>x.state!=='done'&&!autoQueueSeen.has(x.id)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0];
  if(next){live.suspend();await checkout(next);autoQueueSeen.add(next.id);void window.warehouseDesktop?.showIncoming?.();return;}
  await live.pollMirror();
  if(!$('queue'))return;
  $('queue').innerHTML=jobs.length?jobs.map(x=>'<div class="job"><span>'+ (x.payload.kind==='repair'?'Ремонт № '+esc(x.payload.repair.number)+' · '+money(x.payload.repair.due):'Корзина '+esc(x.id.slice(0,8))+' · '+x.payload.items.reduce((n,i)=>n+i.quantity,0)+' шт.')+'<small style="display:block">'+new Date(x.created_at).toLocaleString('ru-RU')+' · '+(x.state==='processing'?'Требует завершения':'Ожидает оплаты')+'</small></span><button data-job="'+x.id+'">Открыть</button></div>').join(''):'Новых корзин нет';
  $('queue').querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>run(async()=>checkout(jobs.find(x=>x.id===b.dataset.job))));$('connection').textContent=device.name+' · есть связь';
 }catch(e){$('connection').textContent='Нет связи';message(e.message,true);}finally{polling=false;}
}
async function checkout(value){if(value.payload.kind==='repair')return repair.checkout(value);job=value;screen='checkout';const state=await call('cash_state'),fixed=job.checkout;shell(nav()+'<h1>Оплата · '+esc(job.id.slice(0,8))+'</h1><div class="twocol"><section class="panel"><h2>Товары</h2>'+job.payload.items.map(x=>{const p=parts.find(p=>p.id===x.part_id),price=fixed?.items.find(i=>i.part_id===x.part_id)?.unit_price??p?.retail_price??0;return '<label>'+esc(p?.name||x.part_id)+' · '+x.quantity+' шт.<input type="number" min="0" step="0.01" value="'+price+'" data-price="'+x.part_id+'" '+(fixed?'disabled':'')+'></label>';}).join('')+'<div class="total"><span>Итого</span><b id="total"></b></div></section><section class="panel"><label>Операция<select id="mode" '+(fixed?'disabled':'')+'><option value="sale">Продажа</option>'+(fixed?.mode==='master'?'<option value="master">Завершить прежнюю выдачу мастеру · 0 ₽</option>':'')+'</select></label><div id="sale-fields"><label>Смена<select id="cash-shift">'+state.shifts.filter(x=>x.status==='open').map(x=>'<option value="'+x.id+'">'+esc(x.register)+' · № '+x.number+'</option>').join('')+'</select></label><label>Оплата<select id="method"><option value="cash">Наличные</option><option value="card">Безналичные</option></select></label><p class="muted">Проводим учёт продажи. Банковский платёж и фискальный чек выполняются на кассе.</p></div><label id="master-fields" hidden>Выбрать мастера<select id="master">'+staff.map(x=>'<option value="'+x.profile_id+'">'+esc(x.name)+'</option>').join('')+'</select></label><button class="primary" id="checkout">Провести</button><button type="button" class="live-cancel" id="checkout-cancel" '+(fixed||job.state!=='queued'?'disabled data-unavailable="true"':'')+'>Отменить оплату</button><p class="muted">Выдача мастеру уменьшает складской остаток и записывает запчасти на мастера, без денежной выручки.</p></section></div>');bindNav();if(fixed){$('mode').value=fixed.mode;$('method').value=fixed.payment_method;$('cash-shift').value=fixed.shift_id;$('master').value=fixed.master_id;for(const id of ['method','cash-shift','master'])$(id).disabled=true;}
 $('checkout-cancel').onclick=()=>run(async()=>{if(fixed||job.state!=='queued')throw Error('Оплата уже проводится. Дождитесь результата');if(!confirm('Отменить оплату? Продажа не будет проведена, остатки и расчёты не изменятся.'))return;const currentId=job.id;const finish=value=>{if(value?.state!=='done')throw Error('Сервер не подтвердил отмену. Повторите');job=null;home();message(value.result?.cancelled?'Оплата отменена':'Оплата уже проведена');};try{finish(await call('cancel_document',{id:currentId,kind:'sale',revision:job.payload.revision||1}));}catch(error){const latest=await call('job',{id:currentId}).catch(()=>null);if(latest?.state==='done'){finish(latest);return;}throw error;}});
 const calc=()=>{$('sale-fields').hidden=$('mode').value==='master';$('master-fields').hidden=$('mode').value!=='master';$('total').textContent=money($('mode').value==='master'?0:job.payload.items.reduce((n,x)=>n+x.quantity*Number(document.querySelector('[data-price="'+x.part_id+'"]').value),0));};$('mode').onchange=calc;document.querySelectorAll('[data-price]').forEach(x=>x.oninput=calc);calc();$('checkout').onclick=()=>run(async()=>{const p={id:job.id,mode:$('mode').value,shift_id:$('cash-shift').value,payment_method:$('method').value,master_id:$('master').value,items:job.payload.items.map(x=>({...x,unit_price:Number(document.querySelector('[data-price="'+x.part_id+'"]').value)}))};await call('checkout',p);job=null;await catalog();home();message(p.mode==='master'?'Запчасти выданы мастеру. Оплата 0 ₽.':'Продажа проведена.');});}
function shift(){screen='shift';shell(nav()+'<h1>Открыть смену</h1><form id="shift-form" class="panel"><label>Касса<input name="register" value="'+esc(device.name)+'" required></label><label>Наличные на начало, ₽<input name="opening_cash" type="number" min="0" step="0.01" value="0" required></label><button class="primary">Открыть</button></form>');bindNav();const request_id=uuid();$('shift-form').onsubmit=e=>{e.preventDefault();const p=formValues(e.target);run(async()=>{await call('shift_open',{...p,request_id});home();message('Смена открыта');});};}
let drawInventory=()=>{};
const canManageParts=()=>!terminal&&['owner','developer','admin'].includes(memberRole);
const canReceiveParts=()=>!terminal&&(!!device&&document.body.dataset.readonly!=='true'||canManageParts());
const refreshParts=async()=>{await catalog();drawInventory();};
const photos=partPhotos({api:serviceApi,editable:canManageParts,run,changed:refreshParts,message});
const offerLabels=(part,quantity)=>{if(mobileLabelOffer())return offerLabelPrinting(part,quantity,{call:serviceApi,actor:userId()});};
const product=productPanel({parts:()=>parts,editable:canManageParts,call:(a,p)=>call(a,p),run,changed:()=>drawInventory(),message,photos,offerLabels});
const createPart=newPartForm({actor:userId,api:serviceApi,photos,parts:()=>parts,canReceive:canReceiveParts,run,refresh:refreshParts,openProduct:p=>product.open(p),message,offerLabels});
async function inventory(){await catalog();screen='inventory';shell(nav()+'<div class="inventory-toolbar"><h1>Остатки общей базы</h1>'+(canManageParts()?'<button id="new-part" class="primary">Добавить запчасть</button>':'')+'</div><label class="inventory-search"><span class="sr-only">Поиск</span><input id="filter" type="search" placeholder="Поиск по названию, артикулу или штрихкоду…"></label><div class="inventory-table"><div class="inventory-columns"><span>Название</span><span>Артикул</span><span>Остаток</span><span>Продажа / закупка</span></div><div id="stock-list"></div></div>');bindNav();drawInventory=()=>{if(!$('stock-list'))return;const q=$('filter').value.toLowerCase(),matches=parts.filter(x=>[x.name,x.barcode,x.sku,x.model].join(' ').toLowerCase().includes(q));$('stock-list').innerHTML=matches.slice(0,100).map(x=>'<button type="button" class="inventory-item" data-part="'+esc(x.id)+'"><span class="inventory-name">'+photos.thumbnail(x)+'<strong>'+esc(x.name)+'</strong></span><span>'+esc(x.sku||'—')+'</span><span>'+x.quantity+' шт.</span><span>'+money(x.retail_price)+'<small class="purchase-price">Закупка: '+money(x.unit_cost)+'</small></span></button>').join('')+(matches.length?'':'<p class="muted inventory-empty">Ничего не найдено</p>');photos.bindThumbnails($('stock-list'),parts);$('stock-list').querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.inventory-item').forEach(x=>x.classList.toggle('selected',x===b));product.open(parts.find(x=>x.id===b.dataset.part));});};if($('new-part'))$('new-part').onclick=createPart;$('filter').oninput=drawInventory;drawInventory();}

async function holdings(){
 const rows=await api('holdings');screen='holdings';
 shell(nav()+'<h1>Запчасти на мастерах</h1><div class="panel tablewrap"><table><thead><tr><th>Мастер</th><th>Запчасть</th><th>Количество</th><th>Себестоимость</th><th></th></tr></thead><tbody>'+rows.map((x,i)=>'<tr><td>'+esc(x.master_name)+'</td><td>'+esc(x.name)+'</td><td>'+x.quantity+' шт.</td><td>'+money(x.unit_cost*x.quantity)+'</td><td><button data-master-return="'+i+'">Вернуть на склад</button></td></tr>').join('')+'</tbody></table>'+(rows.length?'':'Запчастей на мастерах нет.')+'</div>');bindNav();
 document.querySelectorAll('[data-master-return]').forEach(button=>button.onclick=()=>{
  const x=rows[Number(button.dataset.masterReturn)],request_id=crypto.randomUUID(),dialog=document.createElement('dialog');
  dialog.innerHTML='<form><h2>Возврат на склад</h2><p>'+esc(x.master_name)+' · '+esc(x.name)+'</p><label>Количество<input name="quantity" type="number" min="1" max="'+x.quantity+'" step="1" value="1" required></label><p class="error" role="alert"></p><div class="actions"><button type="button" data-cancel>Отмена</button><button class="primary">Вернуть на склад</button></div></form>';
  document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
  let pending=null;dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=dialog.querySelector('.primary'),input=dialog.querySelector('input');if(submit.disabled)return;pending=pending||{request_id,master_id:x.master_id,part_id:x.part_id,quantity:Number(input.value)};submit.disabled=true;input.disabled=true;
   try{await call('master_return',pending);dialog.close();await holdings();message('Деталь возвращена на склад. Запас мастера уменьшен.');}catch(error){dialog.querySelector('[role=alert]').textContent=error.message;submit.disabled=false;}
  };
 });
}
let lastDeviceStatus=0,nativeUpdatePending=false;
async function desktopStatus(){
 const el=$('desktop-status');if(!el)return;if(window.fastgoInstalledApp?.platform==='ios'){el.textContent='FastGo для iPhone · '+window.fastgoInstalledApp.version;return;}
 if(!window.warehouseDesktop?.desktopStatus){el.textContent=window.warehouseDesktop?'USB: откройте «Сканер по USB» для проверки подключения.':'Открыта веб-версия. Для USB запустите программу FastGo Склад на Windows.';return;}
 try{const s=await window.warehouseDesktop.desktopStatus(),update=s.update||{};nativeUpdatePending=['ready','preparing','installing'].includes(update.status);if(device&&userId()&&Date.now()-lastDeviceStatus>60000){lastDeviceStatus=Date.now();const printing=await window.warehouseDesktop.printers?.().catch(()=>null),scanner=await window.warehouseDesktop.scannerStatus?.().catch(()=>null);void call('device_status',{app:window.fastgoDesktop?'desktop':'warehouse',version:s.version,host:s.host,background:s.background,update_status:update.status,latest_version:update.version,blocking_reason:update.waitReason,network:s.network,printing,scanner,input_health:{screen,busy,focused:document.hasFocus(),tag:document.activeElement?.tagName||'',disabled:document.activeElement?.disabled===true,readonly:document.activeElement?.readOnly===true,payment_pending:!!load('manual-service-payment')?.pending},scan_test:scannerTest}).catch(()=>{});}let note='';if(update.status==='downloading')note=' · Загружается '+update.version+': '+update.progress+'%';if(update.status==='ready')note=' · Обновление '+update.version+' готово — приложение само перезапустится после завершения документа';if(update.status==='error')note=' · Ошибка обновления: '+update.error;if(s.terminalUpdate?.message)note+=' · ТСД: '+s.terminalUpdate.message;if(s.recovery?.status==='current')note+=' · Копия базы: '+s.recovery.media_present+'/'+s.recovery.media_expected+' файлов';else if(s.recovery?.status==='copying')note+=' · Копируем базу: '+s.recovery.media_present+'/'+s.recovery.media_expected+' файлов';else if(s.recovery?.status==='error')note+=' · Резервная копия: '+s.recovery.error;const value='Windows '+s.version+' · '+s.usb.status+(s.usb.pending?' · Ожидают добавления: '+s.usb.pending:'')+note;if(el.textContent!==value)el.textContent=value;}
 catch(e){el.textContent='Не удалось проверить USB: '+e.message;}
}
if(!terminal){void desktopStatus();setInterval(desktopStatus,2500);}
if($('usb-scanner'))$('usb-scanner').onclick=()=>{if(window.warehouseDesktop?.openUSBScanner)void window.warehouseDesktop.openUSBScanner().catch(e=>message(e.message,true));else message('Сканирование по USB доступно в установленной программе FastGo Склад версии 1.0.4 и новее.');};
if($('terminal-update'))$('terminal-update').onclick=async()=>{try{if(window.warehouseDesktop?.openTerminalUpdater)await window.warehouseDesktop.openTerminalUpdater();else $('terminal-help').showModal();}catch(e){message('Не удалось открыть обновление терминала: '+e.message,true);}};
if($('terminal-help'))$('terminal-help').onclick=e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.currentTarget.close();};
$('logout').onclick=()=>run(async()=>{if((draft||job)&&!confirm('Документ сохранён. Выйти?'))return;await logout();device=null;parts=[];staff=[];draft=null;job=null;signIn();});setInterval(()=>void poll(),1000);window.addEventListener('online',()=>{if(terminal&&screen==='connection')void run(start);else void poll();});void start();

// Manual updates bypass idle delays, never an open document or pending scan.
const webSafe=(immediate=false)=>!polling&&window.warehouseUpdateSafe(immediate);
const webUpdater=window.warehouseDesktop||window.fastgoInstalledApp?null:startWebUpdates({canApply:async immediate=>{
 if(!webSafe(immediate))return false;
 if(window.warehouseDesktop?.desktopStatus){const state=await window.warehouseDesktop.desktopStatus();if(state.usb?.pending||state.usb?.target||['downloading','ready','preparing','installing'].includes(state.update?.status))return false;}
 return webSafe(immediate);
}});
let updating=false;
async function updateNow(){
 if(updating)return;
 updating=true;
 try{
  live.checkpoint();
  message('Проверка версии приложения…');
  if(window.fastgoDesktop?.updateNow){await window.fastgoDesktop.updateNow();await desktopStatus();return;}
  if(window.warehouseDesktop?.checkUpdates){
   const state=await window.warehouseDesktop.checkUpdates();await desktopStatus();
   if(['downloading','ready','preparing','installing'].includes(state?.status)){message('Обновление '+state.version+' будет установлено сразу после загрузки, когда документы закрыты и USB свободен.');return;}
   if(state?.status==='error'){message('Не удалось проверить приложение: '+state.error,true);return;}
  }
  await webUpdater?.now();message(window.warehouseUpdateSafe(true)?'':'Проверка выполнена. Обновление применится после завершения документа на главном экране; документ сохранён.');
 }catch(e){message('Ошибка обновления: '+e.message,true);}finally{updating=false;}
}
window.warehouseRequestUpdate=()=>void updateNow();
if($('warehouse-update-now'))$('warehouse-update-now').onclick=()=>void updateNow();
window.fastgoWarehouseCanLeave=()=>!window.fastgoServiceCatalogDirty?.()&&!hasManualPaymentDraft(load('manual-service-payment'))&&!busy&&!job&&!live.hasDraft()&&!draft&&!document.querySelector('dialog[open]');
window.fastgoWarehouseOpenMode=async kind=>{if(!['receipt','sale'].includes(kind)||!window.fastgoWarehouseCanLeave()&&!live.canUSB(kind))return false;if(!live.active()||live.kind()!==kind)await live.open(kind);return true;};
if(window.fastgoDesktop){window.fastgoHasUnsavedChanges=()=>!window.fastgoWarehouseCanLeave();window.fastgoUpdateBlockReason=immediate=>window.warehouseUpdateSafe?.(immediate)?'':'Завершите документ склада';window.fastgoLockForUpdate=immediate=>{if(!window.warehouseUpdateSafe?.(immediate))return false;document.body.inert=true;return true;};window.fastgoReleaseUpdateLock=()=>{document.body.inert=false;};}

window.addEventListener('keydown',e=>{if(e.key==='F5'||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='r'){e.preventDefault();void updateNow();}},true);
if($('screen-refresh'))$('screen-refresh').onclick=updateNow;
if($('terminal-refresh'))$('terminal-refresh').onclick=updateNow;

let usbPolling=false,usbRetryAfter=0;
async function pollUSB(){
 const bridge=window.warehouseDesktop;if(terminal||!device||!bridge?.usbInbox||usbPolling||nativeUpdatePending||Date.now()<usbRetryAfter||busy||!['home','live'].includes(screen))return;
 usbPolling=true;try{
  const inbox=await bridge.usbInbox();
  for(const item of inbox.items){if(busy||!['home','live'].includes(screen))break;
   if(!item.kind)continue;const problem=scanError(item.kind,item.code);if(problem){await bridge.usbResult(item.id,{error:problem});continue;}if(item.kind==='repair'){if(!['home','live'].includes(screen)||live.hasDraft())break;try{const quote=await call('repair_quote',{code:item.code});await repair.station(quote,item.id);await bridge.usbResult(item.id,{name:'Ремонт № '+quote.number,price:quote.due});}catch(error){usbRetryAfter=Date.now()+5000;await bridge.usbResult(item.id,{error:error.message,retry:!error.status||error.status>=500});}break;}if(!live.canUSB(item.kind))break;
   try{const result=await live.acceptUSB(item);await bridge.usbResult(item.id,result);}
   catch(e){usbRetryAfter=Date.now()+5000;await bridge.usbResult(item.id,{error:e.message,retry:!e.rejected});message(e.message,true);break;}
  }
 }catch(e){usbRetryAfter=Date.now()+5000;message(e.message,true);}finally{usbPolling=false;}
}
setInterval(()=>void pollUSB(),400);

setInterval(()=>{if(!terminal&&screen==='home'&&!busy)void unknown.poll();},3000);

document.querySelector('.warehouse-sidebar')?.addEventListener('click',e=>{if(window.fastgoServiceCatalogDirty?.()){e.preventDefault();e.stopImmediatePropagation();message('Сохраните или отмените изменение прайса',true);}},{capture:true});
