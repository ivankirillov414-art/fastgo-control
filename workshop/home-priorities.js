import {api, esc, date, fio, number, statuses, canSell} from './core.js';
import {icon} from './icons.js';
import {buildPriorities, workshopDay} from './home-priorities-model.js';

let activeHome = null;
window.addEventListener('fastgo-home-data-changed', () => activeHome?.refresh());
setInterval(() => { if (activeHome?.day !== workshopDay()) activeHome?.refresh(); }, 60000);
export const usePrioritiesHome = () => !!window.fastgoDesktop || window.matchMedia('(min-width:1024px)').matches;

async function activeRows(kind) {
  const rows = []; let offset = 0, count;
  do {
    const result = await api('list', {kind, status: 'active', offset, limit: 100});
    if (!Array.isArray(result.items)) throw Error('Не удалось загрузить список приёмок');
    rows.push(...result.items); offset += result.items.length;
    count = Number(result.count ?? result.total ?? offset);
    if (!result.items.length) break;
  } while (offset < count);
  return rows;
}
async function loadHome(canManage) {
  if (window.fastgoDesktop?.homeData) return window.fastgoDesktop.homeData();
  const [repairs, storage] = await Promise.all([activeRows('repair'), canManage ? activeRows('storage') : []]);
  return {repairs, storage};
}
const vehicle = r => [r.brand, r.model].filter(Boolean).join(' ') || 'Техника не указана';
const repairNumber = r => r.repair_number ? 'Р-' + number(r, 'repair') : 'Новая приёмка';
function reason(r, model) {
  if (model.overdue.some(x => x.id === r.id)) return 'Уточнить срок готовности';
  if (model.approvals.some(x => x.id === r.id)) return 'Согласовать стоимость';
  return {accepted: 'Начать диагностику', diagnostics: 'Завершить диагностику', waiting_parts: 'Проверить поступление запчастей', repair: 'Продолжить ремонт', ready: 'Связаться с клиентом для выдачи'}[r.status] || statuses.repair[r.status] || '';
}

export async function renderPrioritiesHome(ctx, token) {
  const native = window.fastgoDesktop, canManage = ctx.manager();
  const controls = native ? `<button class="priority-icon-button" type="button" data-home-sync aria-label="Синхронизировать" title="Синхронизировать">${icon('sync')}</button><button class="priority-icon-button" type="button" data-home-settings aria-label="Настройки приложения" title="Настройки приложения">${icon('settings')}</button>` : '';
  const html = `<section class="priorities-home" aria-label="Главное — приоритеты дня">
    <header class="priority-header"><time class="priority-date">${esc(new Intl.DateTimeFormat('ru-RU', {timeZone:'Asia/Yekaterinburg',weekday:'long',day:'numeric',month:'long'}).format(new Date()))}</time><h1>Главное</h1><div class="priority-header-tools">${controls}<button class="ops-bell priority-bell" id="home-repair-alerts" type="button" disabled aria-label="Просроченные ремонты">${icon('bell')}<span class="priority-bell-count" hidden></span></button></div></header>
    <div class="priority-toolbar"><div class="home-actions">${canManage ? `<a class="btn" href="#new?kind=repair">${icon('repairs')}Принять в ремонт</a><a class="btn secondary storage-action" href="#new?kind=storage">${icon('storage')}Зимнее хранение</a>` : ''}${canSell(ctx.me) ? '<div id="home-sale-slot"></div>' : ''}</div><form class="priority-search" id="priority-search">${icon('search')}<input name="search" type="search" autocomplete="off" aria-label="Поиск заказа, клиента или серийного номера" placeholder="Заказ, клиент или серийный номер"><button type="submit" aria-label="Найти">${icon('arrow')}</button></form></div>
    <div class="priority-error" role="alert" hidden></div>
    <div class="priority-grid"><section class="priority-hero" id="home-next-action" aria-live="polite"><span class="priority-eyebrow">${icon('arrow')}Следующий шаг</span><h2>Загружаем приоритеты…</h2><p>Проверяем текущие ремонты и сроки готовности.</p></section>
    <div class="priority-alert-cards"><section class="priority-card priority-overdue"><strong data-count="overdue">—</strong><h2>Просрочено</h2><p>Нужно уточнить сроки</p><button class="priority-link" type="button" data-home-list="overdue" disabled>Разобрать ремонты ${icon('arrow')}</button></section><section class="priority-card"><strong data-count="ready">—</strong><h2>Готовы к выдаче</h2><p>Можно пригласить клиентов</p><button class="priority-link" type="button" data-home-list="ready" disabled>К выдаче ${icon('arrow')}</button></section></div>
    <section class="priority-day"><header><h2 data-task-title>На сегодня</h2><a class="priority-link" href="#repairs">Все ремонты</a></header><div id="home-orders" aria-live="polite"><p class="priority-empty">Загружаем ремонты…</p></div>${canManage ? `<section class="priority-history"><h2>История клиента и техники</h2><p>Предыдущие обращения, работы и установленные запчасти</p><form id="priority-history-form"><label class="priority-visually-hidden" for="priority-history-kind">Искать по</label><select id="priority-history-kind" name="kind"><option value="serial">Серийный номер</option><option value="phone">Телефон клиента</option></select><label class="priority-visually-hidden" for="priority-history-query">Номер для поиска</label><input id="priority-history-query" name="query" required autocomplete="off" placeholder="Введите серийный номер"><button type="submit" aria-label="Найти историю">${icon('search')}</button></form></section>` : ''}</section>
    <section class="priority-summary" id="home-stats" aria-live="polite"><h2>Мастерская сегодня</h2><a class="priority-summary-row" href="#repairs?status=active"><span>В работе</span><strong data-count="working">—</strong></a><a class="priority-summary-row" href="#repairs?status=ready"><span>Готовы к выдаче</span><strong data-count="summary-ready">—</strong></a><div class="priority-meter" role="img" aria-label="Соотношение ремонтов в работе и готовых"><span data-meter="working"></span><span data-meter="ready"></span></div>${canManage ? '<a class="priority-summary-row" href="#storage?status=active"><span>На хранении</span><strong data-count="storage">—</strong></a><button class="priority-summary-row" type="button" data-home-list="storageDue" disabled><span>Выдать с хранения</span><strong data-count="storageDue">—</strong></button><p class="priority-storage-note">Просроченная выдача и ближайшие 7 дней</p><a class="priority-link priority-summary-footer" href="#storage">Открыть хранение '+icon('arrow')+'</a>' : ''}</section></div></section>`;
  if (!ctx.mount(html, token)) return;
  const root = document.querySelector('.priorities-home');
  const valid = () => token === ctx.token && root.isConnected;
  const controller = {day:workshopDay(),refresh:null}; activeHome = controller;
  let model, loading = false, queued = false;
  function showList(kind) {
    if (!model || !valid()) return;
    const storage = kind === 'storageDue', rows = kind === 'next' ? model.next.items : model[kind] || [];
    const titles = {overdue:'Просроченные ремонты',ready:'Готовы к выдаче',storageDue:'Выдать с хранения',next:model.next.title};
    ctx.modal(titles[kind], rows.length ? `<div class="priority-modal-list">${rows.map(r => `<a href="${ctx.href('order',{kind:storage?'storage':'repair',id:r.id})}"><strong>${esc(storage ? 'Х-'+number(r,'storage') : repairNumber(r))} · ${esc(vehicle(r))}</strong><span>${esc(fio(r))}</span><small>${esc(storage ? date(r.planned_return_date) : reason(r,model))}</small></a>`).join('')}</div>` : '<p>В этом списке пока нет приёмок.</p>', undefined, () => document.querySelectorAll('#dialog .priority-modal-list a').forEach(a => a.addEventListener('click', () => document.getElementById('dialog').close())));
  }
  root.querySelector('#priority-search').onsubmit = event => {event.preventDefault();const search = new FormData(event.currentTarget).get('search').trim();if(search)ctx.go('repairs',{search,status:'all'});};
  const history = root.querySelector('#priority-history-form');
  if (history) {
    history.elements.kind.onchange = () => {const phone=history.elements.kind.value==='phone';history.elements.query.placeholder=phone?'+7…':'Введите серийный номер';history.elements.query.inputMode=phone?'tel':'text';};
    history.onsubmit = event => {event.preventDefault();const kind=history.elements.kind.value,query=history.elements.query.value.trim();if(query)ctx.go('history',{[kind]:query});};
  }
  if (native) {
    root.querySelector('[data-home-settings]').onclick = () => window.dispatchEvent(new Event('fastgo-desktop-settings'));
    root.querySelector('[data-home-sync]').onclick = async event => {const button=event.currentTarget;button.disabled=true;try{await native.sync();await refresh();const state=await native.state();ctx.toast(state.online?'Синхронизация завершена':'Нет связи. Изменения сохранены на ноутбуке.');}catch(error){ctx.toast(error.message);}finally{button.disabled=false;}};
  }
  root.querySelector('[id="home-repair-alerts"]').onclick = () => showList('overdue');
  root.querySelectorAll('[data-home-list]').forEach(button => button.onclick=()=>showList(button.dataset.homeList));
  function paint(data) {
    model=buildPriorities(data);controller.day=model.today;
    root.querySelector('.priority-error').hidden=true;
    root.querySelector('.priority-date').textContent=new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Yekaterinburg',weekday:'long',day:'numeric',month:'long'}).format(new Date());
    const counts={working:model.working.length,ready:model.ready.length,'summary-ready':model.ready.length,overdue:model.overdue.length,storage:model.storage.length,storageDue:model.storageDue.length};
    root.querySelectorAll('[data-count]').forEach(el=>el.textContent=counts[el.dataset.count]);
    const bell=root.querySelector('#home-repair-alerts'),counter=bell.querySelector('.priority-bell-count');bell.disabled=false;counter.hidden=!model.overdue.length;counter.textContent=model.overdue.length;bell.setAttribute('aria-label',`Просроченных ремонтов: ${model.overdue.length}`);
    const next=model.next;
    root.querySelector('#home-next-action').innerHTML=`<span class="priority-eyebrow">${icon('arrow')}Следующий шаг</span><h2>${esc(next.title)}</h2><p>${esc(next.description)}</p>${next.items.length?`<button type="button" class="btn" data-open-next>${esc(next.action)} ${icon('arrow')}</button>`:canManage?`<a class="btn" href="#new?kind=repair">${esc(next.action)} ${icon('arrow')}</a>`:''}`;
    root.querySelector('[data-open-next]')?.addEventListener('click',()=>showList('next'));
    root.querySelector('[data-task-title]').textContent=model.tasksTitle;
    root.querySelector('#home-orders').innerHTML=model.tasks.length?model.tasks.map(r=>{const due=String(r.promised_date||'').slice(0,10),late=model.overdue.some(x=>x.id===r.id);return `<a class="priority-task" href="${ctx.href('order',{kind:'repair',id:r.id})}"><span class="priority-task-date ${late?'is-late':''}">${esc(due===model.today?'Сегодня':due?date(due):'Без срока')}</span><span class="priority-task-description"><strong>${esc(vehicle(r))}</strong><small>${esc(repairNumber(r))} · ${esc(reason(r,model))}</small></span>${icon('arrow')}</a>`;}).join(''):'<p class="priority-empty">Активных ремонтов пока нет.</p>';
    const total=model.working.length+model.ready.length;
    root.querySelector('[data-meter="working"]').style.width=(total?model.working.length/total*100:0)+'%';
    root.querySelector('[data-meter="ready"]').style.width=(total?model.ready.length/total*100:0)+'%';
    root.querySelector('.priority-meter').setAttribute('aria-label',`${model.working.length} в работе, ${model.ready.length} готовы к выдаче`);
    root.querySelectorAll('[data-home-list]').forEach(b=>b.disabled=false);
  }
  async function refresh() {
    if(!valid())return;
    if(loading){queued=true;return;}
    loading=true;
    try {const data=await loadHome(canManage);if(valid())paint(data);}
    catch(error){if(valid()){const host=root.querySelector('.priority-error');host.hidden=false;host.innerHTML=`<span>${esc(error.message)}</span><button type="button" class="btn secondary small">Повторить</button>`;host.querySelector('button').onclick=refresh;}}
    finally{loading=false;if(queued){queued=false;refresh();}}
  }
  controller.refresh=refresh;
  await refresh();
}
