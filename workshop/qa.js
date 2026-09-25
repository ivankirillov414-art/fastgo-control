import {api,esc,date} from './core.js';

const KEY='fastgo_final_qa_v1';
const $=id=>document.getElementById(id);
function state(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}}
function save(name,value=true){const s=state();s[name]=value;s.updated_at=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(s));}
function badge(done){return done?'<b>✓ Проверено</b>':'<span class="muted">Не проверено</span>';}

export async function renderQa(ctx,token){
  const q=state();
  const [health,backup]=await Promise.all([
    api('health',{}, {fresh:true}),
    api('backup_status',{}, {fresh:true}).catch(e=>({error:e.message}))
  ]);
  const backupOk=!!backup?.last_success&&!backup?.last_error;
  const backupText=backup?.error
    ? 'Ошибка проверки: '+backup.error
    : backupOk
      ? 'Последняя успешная копия: '+date(backup.last_success)+' · триггеров: '+Number(backup.trigger_count||0)
      : 'Успешная резервная копия пока не подтверждена';

  const html=ctx.head('Финальная проверка','Аппаратные тесты и контроль готовности FastGo')+
    '<section class="panel"><h2>Система</h2><div class="info">'+
      '<div><label>API</label><p>'+esc(health.release||'—')+'</p></div>'+
      '<div><label>База</label><p>'+esc(health.backend||'—')+'</p></div>'+
      '<div><label>Резервная копия</label><p>'+esc(backupText)+'</p></div>'+
    '</div><p>'+badge(backupOk||q.backup)+'</p></section>'+
    '<section class="panel"><h2>1. Камера / фото</h2><p class="muted">Проверка задней камеры и системного выбора фото.</p>'+
      '<video id="qa-video" playsinline muted style="display:none;width:100%;max-width:420px;border-radius:14px;background:#000;margin:12px 0"></video>'+
      '<div class="actions"><button class="btn secondary" id="qa-camera">Запустить камеру</button><button class="btn ghost" id="qa-camera-stop" style="display:none">Остановить</button>'+
      '<label class="btn ghost" style="cursor:pointer">Выбрать / снять фото<input id="qa-photo" type="file" accept="image/*" capture="environment" style="display:none"></label></div>'+
      '<p id="qa-camera-status">'+badge(q.camera)+'</p><p id="qa-photo-status">'+badge(q.photo)+'</p></section>'+
    '<section class="panel"><h2>2. QR-код</h2><p class="muted">Создайте QR и отсканируйте его другим устройством. Он должен открыть FastGo.</p>'+
      '<div id="qa-qr" style="margin:12px 0"></div><div class="actions"><button class="btn secondary" id="qa-qr-generate">Создать QR</button><button class="btn ghost" id="qa-qr-ok">QR считывается</button></div>'+
      '<p id="qa-qr-status">'+badge(q.qr)+'</p></section>'+
    '<section class="panel"><h2>3. Печать</h2><p class="muted">Проверьте обычную печать A4 и этикетку 58×30 мм.</p>'+
      '<div class="actions"><button class="btn secondary" id="qa-print-a4">Тест A4</button><button class="btn secondary" id="qa-print-label">Тест 58 мм</button><button class="btn ghost" id="qa-print-ok">Печать работает</button></div>'+
      '<p id="qa-print-status">'+badge(q.print)+'</p></section>'+
    '<section class="panel"><h2>4. Сканер штрих-кодов</h2><p class="muted">Поставьте курсор в поле и отсканируйте любую этикетку FastGo.</p>'+
      '<input id="qa-scanner" autocomplete="off" placeholder="Сканируйте FGP-..."><p id="qa-scanner-value" class="muted"></p><p id="qa-scanner-status">'+badge(q.scanner)+'</p></section>'+
    '<section class="panel"><h2>5. Контрольная приёмка</h2><p>Автоматические тесты проверяют цепочку ремонта на сервере. Для финального живого прохода создайте одну тестовую приёмку и проведите её обычным способом.</p>'+
      '<div class="actions"><a class="btn" href="#new?kind=repair">Тестовый ремонт</a><a class="btn secondary" href="#new?kind=storage">Тестовое хранение</a><button class="btn ghost" id="qa-flow-ok">Живой проход выполнен</button></div>'+
      '<p id="qa-flow-status">'+badge(q.flow)+'</p></section>';

  if(!ctx.mount(html,token))return;
  if(backupOk)save('backup');

  let stream=null;
  const mark=(key,id)=>{save(key);const el=$(id);if(el)el.innerHTML='<b>✓ Проверено</b>';};

  $('qa-camera').onclick=e=>ctx.run(e.currentTarget,async()=>{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Этот браузер не поддерживает доступ к камере');
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    const video=$('qa-video');video.srcObject=stream;video.style.display='block';await video.play();
    $('qa-camera-stop').style.display='inline-flex';mark('camera','qa-camera-status');
  });
  $('qa-camera-stop').onclick=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;$('qa-video').style.display='none';$('qa-camera-stop').style.display='none';};
  $('qa-photo').onchange=e=>{const file=e.target.files?.[0];if(file){$('qa-photo-status').innerHTML='<b>✓ Файл получен: '+esc(file.name)+'</b>';save('photo');}};

  $('qa-qr-generate').onclick=()=>{
    if(!window.qrcode){ctx.modal('QR недоступен','<p class="error">Не загрузился локальный генератор QR.</p>');return;}
    const qr=window.qrcode(0,'M'),url=new URL('workshop.html',location.href);url.hash='home';qr.addData(url.href);qr.make();
    $('qa-qr').innerHTML=qr.createImgTag(5,5,'Тестовый QR FastGo');
  };
  $('qa-qr-ok').onclick=()=>mark('qr','qa-qr-status');

  const printTest=thermal=>{
    const w=window.open('','_blank','width=700,height=700');if(!w)throw new Error('Разрешите всплывающие окна для печати');
    const css=thermal
      ? '@page{size:58mm 30mm;margin:0}body{width:58mm;height:30mm;margin:0;display:grid;place-items:center;text-align:center;font:700 12pt Arial}'
      : '@page{size:A4;margin:15mm}body{font:18pt Arial;padding:20mm}';
    w.document.open();w.document.write('<!doctype html><meta charset="utf-8"><title>FastGo test</title><style>'+css+'</style><body><div>FASTGO · ТЕСТ ПЕЧАТИ<br><small>'+new Date().toLocaleString('ru-RU')+'</small></div></body>');w.document.close();
    setTimeout(()=>w.print(),180);
  };
  $('qa-print-a4').onclick=()=>{try{printTest(false)}catch(e){ctx.modal('Печать','<p class="error">'+esc(e.message)+'</p>')}};
  $('qa-print-label').onclick=()=>{try{printTest(true)}catch(e){ctx.modal('Печать','<p class="error">'+esc(e.message)+'</p>')}};
  $('qa-print-ok').onclick=()=>mark('print','qa-print-status');

  $('qa-scanner').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const value=e.currentTarget.value.trim();if(value){$('qa-scanner-value').textContent='Получено: '+value;mark('scanner','qa-scanner-status');e.currentTarget.value='';}}};
  $('qa-flow-ok').onclick=()=>mark('flow','qa-flow-status');

  window.addEventListener('hashchange',()=>stream?.getTracks().forEach(t=>t.stop()),{once:true});
}
