const native=()=>window.warehouseDesktop;
export const printerSetupAvailable=()=>typeof native()?.printers==='function'&&typeof native()?.savePrinter==='function';

export function printerFields(root,{format='label',allowDialog=false,changed=()=>{}}={}){
 root.className='printer-fields';root.innerHTML='<label>Принтер<select data-printer></select></label><button type="button" data-refresh>Обновить список</button><div class="printer-size"><label>Ширина, мм<input data-width type="number" min="30" max="110" step="0.1" value="58" required></label><label>Высота, мм<input data-height type="number" min="20" max="200" step="0.1" value="30" required></label></div>'+(allowDialog?'<label class="printer-remember"><input type="checkbox" data-remember checked>Запомнить для этого формата</label>':'')+'<p class="muted" data-note role="status"></p>';
 const select=root.querySelector('[data-printer]'),width=root.querySelector('[data-width]'),height=root.querySelector('[data-height]'),remember=root.querySelector('[data-remember]'),note=root.querySelector('[data-note]'),refresh=root.querySelector('[data-refresh]');
 const connect=document.createElement('button');connect.type='button';connect.dataset.connectP2='';connect.textContent='Подключить DETONGER P2';connect.hidden=true;refresh.after(connect);
 let snapshot={printers:[],profiles:{}},loading=false,pollTimer;
 const option=(name,value)=>{const o=document.createElement('option');o.value=value;o.textContent=name;return o;};
 function describe(){if(remember)remember.disabled=!select.value;const found=snapshot.printers.some(p=>p.name===select.value);note.textContent=select.value&&!found?'Этот принтер не найден. Подключите его и обновите список.':select.value?'Выбор сохраняется на этом ноутбуке для следующих печатей.':allowDialog?'Для автоматического выбора укажите принтер из списка.':'Подключите принтер к ноутбуку, установите драйвер его модели и обновите список.';if(format==='label'&&snapshot.setup?.message)note.textContent=snapshot.setup.message;if(snapshot.warning)note.textContent=snapshot.warning;connect.hidden=format!=='label'||typeof native()?.setupPrinter!=='function'||snapshot.setup?.status==='ready';connect.disabled=snapshot.setup?.busy===true;connect.textContent=connect.disabled?'Устанавливаем DETONGER P2…':'Подключить DETONGER P2';changed({loading});}
 function populate(preserve=false){
  const saved=snapshot.profiles?.[format],wanted=preserve?select.value:saved?.deviceName||'';
  select.replaceChildren(option(allowDialog?'Выбор в окне Windows':'Выберите установленный принтер',''),...snapshot.printers.map(p=>option(p.displayName+(p.isDefault?' · основной в Windows':''),p.name)));
  if(wanted&&!snapshot.printers.some(p=>p.name===wanted))select.append(option(wanted+' · не найден',wanted));select.value=wanted;
  root.querySelector('.printer-size').hidden=format!=='label';width.disabled=height.disabled=format!=='label';
  if(!preserve){width.value=saved?.widthMm||58;height.value=saved?.heightMm||30;}
  describe();
 }
 async function load(preserve=false){if(loading)return;loading=true;refresh.disabled=select.disabled=true;changed({loading});note.textContent='Получаем список принтеров…';try{const previous=snapshot.setup?.status;snapshot=await native().printers();populate(previous==='installing'&&snapshot.setup?.status==='ready'?false:preserve);}catch{note.textContent='Не удалось получить список принтеров. Нажмите «Обновить список».';}finally{loading=false;refresh.disabled=select.disabled=false;changed({loading});clearTimeout(pollTimer);if(snapshot.setup?.busy||snapshot.setup?.status==='installing')pollTimer=setTimeout(()=>{if(root.isConnected)void load(true);},3000);}}
 select.onchange=describe;refresh.onclick=()=>void load(true);
 connect.onclick=async()=>{connect.disabled=true;try{await native().setupPrinter();await load(true);}catch(e){note.textContent=e.message;connect.disabled=false;}};
 const ready=load();
 return {ready,setFormat:next=>{format=next;populate();},selection:()=>{
  if(loading)throw Error('Дождитесь списка принтеров');const deviceName=select.value;if(deviceName&&!snapshot.printers.some(p=>p.name===deviceName))throw Error('Принтер не найден. Подключите его и обновите список.');
  if(!deviceName&&!allowDialog)throw Error('Выберите установленный принтер');
  return {deviceName,systemDialog:!deviceName,remember:!!deviceName&&!!remember?.checked,...(format==='label'?{widthMm:Number(width.value),heightMm:Number(height.value)}:{})};
 }};
}

export function setupLabelPrinter(){
 if(!printerSetupAvailable())return;
 const dialog=document.createElement('dialog');dialog.className='barcode-print-dialog';dialog.setAttribute('aria-label','Принтер этикеток');dialog.innerHTML='<form><h2>Принтер этикеток</h2><p>Сохранённый принтер будет автоматически выбираться в складе и в разделе склада общего FastGo.</p><div data-printer-fields></div><p role="alert" class="error"></p><div class="actions"><button type="button" data-close>Закрыть</button><button type="button" data-test>Пробная этикетка</button><button type="submit" class="primary">Сохранить</button></div><p data-result role="status"></p></form>';
 document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove();dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 const form=dialog.querySelector('form'),save=dialog.querySelector('[type=submit]'),test=dialog.querySelector('[data-test]'),error=dialog.querySelector('[role=alert]'),result=dialog.querySelector('[data-result]');
 let busy=false;const controls=printerFields(dialog.querySelector('[data-printer-fields]'),{changed:({loading})=>{save.disabled=test.disabled=loading||busy;}});
 async function run(testLabel){if(busy||!form.reportValidity())return;busy=true;save.disabled=test.disabled=true;error.textContent='';result.textContent='';
  try{const selection=controls.selection();if(testLabel){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');window.JsBarcode(svg,'FASTGO-TEST',{format:'CODE128',displayValue:false,width:2,height:72,margin:0,marginLeft:20,marginRight:20});const r=await native().printBarcode({...selection,remember:true,format:'label',quantity:1,name:'Проверка принтера FastGo',barcode:'FASTGO-TEST',svg:svg.outerHTML});result.textContent=r?.warning||'Пробная этикетка отправлена принтеру. Выбор сохранён.';}else{await native().savePrinter({format:'label',...selection});result.textContent='Принтер и размер этикетки сохранены на этом ноутбуке.';}}
  catch(e){error.textContent=e.message;}finally{busy=false;save.disabled=test.disabled=false;}
 }
 form.onsubmit=e=>{e.preventDefault();void run(false);};test.onclick=()=>void run(true);
}
