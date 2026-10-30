import {esc,money,date,csvDownload} from './core.js';

const localToday = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const amount = value => value === null ? 'Нет данных' : money(value);
const metric = (label, value) => `<div><span>${label}</span><strong>${amount(value)}</strong></div>`;
function style() {
 if (document.getElementById('master-profit-style')) return;
 const tag = document.createElement('style'); tag.id = 'master-profit-style'; tag.textContent = `
#owner-period[hidden]{display:none}.mp-root{min-width:0}.mp-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.mp-heading h2{margin:0}.mp-tools{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin:18px 0}.mp-tools label{display:grid;gap:5px;margin:0}.mp-tools input{max-width:190px}.mp-periods{display:flex;gap:6px;flex-wrap:wrap}.mp-periods button[aria-pressed=true]{background:#0877e8;border-color:#1da7e8}.mp-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.mp-metrics>div{padding:14px;border:1px solid #314157;background:#142033;border-radius:10px;min-width:0}.mp-metrics span{display:block;color:#b4c1d3;font-size:13px}.mp-metrics strong{display:block;margin-top:8px;font-size:clamp(18px,2vw,25px);overflow-wrap:anywhere}.mp-scroll{max-width:100%;overflow:auto;overscroll-behavior:contain}.mp-table{width:100%;border-collapse:collapse;font-size:14px}.mp-table td,.mp-table th{padding:12px 10px;border-bottom:1px solid #314157;text-align:left;vertical-align:top}.mp-table th{color:#b4c1d3;font-size:12px}.mp-table .mp-number{text-align:right;white-space:nowrap}.mp-table small{display:block;color:#aebcd0;font-size:12px;margin-top:4px;white-space:normal}.mp-link{background:transparent;border:0;color:#71c8ff;padding:0;text-align:left;font:inherit;cursor:pointer;min-height:36px}.mp-notice{padding:12px;border-left:3px solid #21c7e8;background:#102437;margin:14px 0;color:#ccdeef;font-size:13px}.mp-warning{border-color:#e4b75e}.mp-detail{margin-top:22px;padding-top:18px;border-top:1px solid #314157}.mp-days select{min-width:130px;max-width:180px;font:inherit}.mp-history{padding:12px 0;color:#b4c1d3}.mp-history summary{cursor:pointer}.mp-error{color:#ff9da6}.mp-empty{color:#aebcd0;padding:18px 0}.mp-root a{color:#71c8ff}.mp-root button{touch-action:manipulation}@media(max-width:850px){.mp-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.mp-table{font-size:12px}.mp-table td,.mp-table th{padding:9px 7px}.mp-metrics>div{padding:11px}.mp-tools{align-items:stretch}.mp-tools label{flex:1}.mp-heading .btn{width:100%}.mp-table .mp-link{max-width:150px;overflow-wrap:anywhere}}
@media(max-width:600px){.mp-scroll{overflow:visible}.mp-table,.mp-table tbody{display:block}.mp-table thead{display:none}.mp-table tbody{display:grid;gap:12px}.mp-table tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid #314157;border-radius:10px;background:#112033;padding:12px;gap:12px}.mp-table td{display:block;padding:0;border:0;min-width:0}.mp-table td:before{display:block;content:attr(data-label);font-size:11px;line-height:1.3;color:#aebcd0;margin-bottom:5px;white-space:normal}.mp-table td:first-child,.mp-table .mp-action{grid-column:1/-1}.mp-table td:first-child .mp-link{max-width:none;font-size:16px}.mp-table .mp-number{text-align:left;white-space:normal;overflow-wrap:anywhere}.mp-table small{font-size:11px}.mp-days select{min-width:0;max-width:100%;width:100%;min-height:44px}.mp-action .btn{width:100%}}
`; document.head.append(tag);
}

export async function renderMasterProfit({ctx,host,call,mode='profit',initialDate,initialPeriod='month'}) {
 style();
 const frame = document.createElement('section'); frame.className = 'mp-root'; host.replaceChildren(frame);
 let selected = '', period = initialPeriod, selectedDate = initialDate || localToday(), data = null, generation = 0;
 const active = () => frame.isConnected;
 const find = selector => frame.querySelector(selector);
 const all = selector => frame.querySelectorAll(selector);
 async function load() {
  const version = ++generation;
  frame.innerHTML = '<p role="status">Загружаем оплаты и рабочие дни…</p>';
  try {
   const result = await call('master_analytics', {period,date:selectedDate});
   if (!active() || version !== generation) return;
   data = result; draw();
  } catch (e) {
   if (!active() || version !== generation) return;
   frame.innerHTML = `<p class="mp-error" role="alert">${esc(e.message)}</p><button class="btn secondary" data-retry>Повторить</button>`;
   find('[data-retry]').onclick = load;
  }
 }
 function rowProfit(item) {
  return `<tr><td data-label="Мастер"><button type="button" class="mp-link" data-master="${esc(item.id)}">${esc(item.name)}</button>${!item.active?'<small>Аккаунт неактивен</small>':''}</td><td class="mp-number" data-label="Ремонтов с оплатами">${item.repair_count}</td><td class="mp-number" data-label="Оплаты">${money(item.revenue)}${item.refunds?`<small>Возвраты: ${money(item.refunds)}</small>`:''}</td><td class="mp-number" data-label="Закупка запчастей">${item.missing_cost?'Нет всех цен':money(item.parts_cost)}</td><td class="mp-number" data-label="Зарплата">${item.missing_rates?'Нет ставки':money(item.salary)}<small>${item.workdays} раб. дн.</small></td><td class="mp-number" data-label="Прибыль">${amount(item.profit)}</td></tr>`;
 }
 function rowSalary(item) {
  return `<tr><td data-label="Мастер"><button type="button" class="mp-link" data-master="${esc(item.id)}">${esc(item.name)}</button>${!item.active?'<small>Аккаунт неактивен</small>':''}</td><td class="mp-number" data-label="Ставка в день">${item.daily_rate===null?'Не задана':money(item.daily_rate)}</td><td class="mp-number" data-label="Рабочих дней">${item.workdays}</td><td class="mp-number" data-label="Зарплата">${item.missing_rates?'Нет всех ставок':money(item.salary)}</td><td class="mp-action"><button class="btn secondary small" type="button" data-rate="${esc(item.id)}">Изменить ставку</button></td></tr>`;
 }
 function draw() {
  if (!active()) return;
  const total = data.totals, salaryMode = mode === 'salary';
  frame.innerHTML = `<div class="mp-heading"><div><h2>${salaryMode?'Зарплаты мастеров':'Прибыль по мастерам'}</h2><p class="ops-notice">${salaryMode?'Дневные ставки и рабочие дни. Доступно только владельцу.':'Оплаты − закупочная стоимость запчастей − зарплата'}</p></div><button class="btn secondary" type="button" data-export>Выгрузить в Excel</button></div><div class="mp-tools"><div class="mp-periods" aria-label="Период аналитики">${[['day','День'],['week','Неделя'],['month','Месяц']].map(([value,label])=>`<button type="button" class="btn ghost small" data-period="${value}" aria-pressed="${period===value}">${label}</button>`).join('')}</div><label>На дату<input type="date" data-date value="${esc(selectedDate)}" required></label><button class="btn secondary" type="button" data-load>Показать</button></div><p class="ops-notice">${date(data.from)} — ${date(data.to)} · Екатеринбург. Неделя считается с понедельника, месяц — с первого числа.</p>${salaryMode?'':`<div class="mp-metrics">${metric('Оплаты с учётом возвратов',total.revenue)}${metric('Закупочная стоимость',total.missing_cost?null:total.parts_cost)}${metric('Зарплата',total.missing_rates?null:total.salary)}${metric('Прибыль после зарплаты',total.profit)}</div>`}${total.missing_rates?'<p class="mp-notice mp-warning">Для части рабочих дней не задана ставка. Прибыль не подменяется нулевым начислением: укажите ставку с нужной даты в «Зарплатах мастеров».</p>':''}${total.missing_cost?'<p class="mp-notice mp-warning">Для части установленных деталей нет закупочной стоимости на момент выдачи. По этим ремонтам прибыль пока не определена.</p>':''}${total.zero_cost?'<p class="mp-notice mp-warning">Есть детали с закупочной ценой 0 ₽. Проверьте, что это верно.</p>':''}<div class="mp-scroll"><table class="mp-table"><thead><tr>${(salaryMode?['Мастер','Ставка в день','Рабочих дней','Зарплата','']:['Мастер','Ремонтов с оплатами','Оплаты','Закупка запчастей','Зарплата','Прибыль']).map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${data.items.map(salaryMode?rowSalary:rowProfit).join('')||`<tr><td colspan="6">Мастеров пока нет.</td></tr>`}</tbody></table></div><div data-detail></div>${data.unassigned.repair_count?`<section class="mp-notice mp-warning"><b>Оплаты без подтверждённого исполнителя: ${money(data.unassigned.revenue)}</b><p>Не относим их к назначенному сотруднику или кассиру. Нужна запись завершения ремонта из аккаунта исполнителя.</p>${data.unassigned.repairs.map(x=>`<a href="${ctx.href('order',{kind:'repair',id:x.id})}">${esc(x.number)}</a>`).join(' · ')}</section>`:''}${data.paid_without_journal.length?`<p class="mp-notice mp-warning">У ${data.paid_without_journal.length} ремонтов сумма оплаты есть в карточке, но нет записи в журнале платежей. Она не включена повторно в поступления.</p>`:''}<p class="ops-notice">${salaryMode?'Рабочие дни отмечаются по завершённым ремонтам. Откройте мастера, чтобы добавить день без ремонта, исключить день или вернуть автоматический расчёт.':'Учитываются поступившие оплаты и возвраты, а не выставленные суммы. При частичных платежах закупочная стоимость распределяется пропорционально; одна деталь не вычитается повторно.'}</p>${!salaryMode?'<p class="ops-notice">Результат показан после запчастей и зарплаты, до аренды и остальных расходов.</p>':''}`;
  all('[data-period]').forEach(button=>button.onclick=()=>{const input=find('[data-date]');if(!input.reportValidity())return;selectedDate=input.value;period=button.dataset.period;void load();});
  find('[data-load]').onclick=()=>{const input=find('[data-date]');if(!input.reportValidity())return;selectedDate=input.value;void load();};
  all('[data-master]').forEach(button=>button.onclick=()=>{selected=button.dataset.master;drawDetail();});
  all('[data-rate]').forEach(button=>button.onclick=()=>editRate(data.items.find(x=>x.id===button.dataset.rate)));
  find('[data-export]').onclick=()=>csvDownload('FastGo-мастера-'+data.from+'-'+data.to+'.csv',['Мастер','Период с','Период по','Ремонтов','Оплаты','Возвраты','Закупка запчастей','Рабочих дней','Зарплата','Прибыль'],data.items.map(x=>[x.name,data.from,data.to,x.repair_count,x.revenue,x.refunds,x.missing_cost?'Не все цены известны':x.parts_cost,x.workdays,x.missing_rates?'Нет ставки':x.salary,x.profit??'Недостаточно данных']));
  if (selected) drawDetail();
 }
 function drawDetail() {
  const employee = data.items.find(x=>x.id===selected), detail = find('[data-detail]');
  if (!employee) { detail.innerHTML=''; return; }
  detail.innerHTML = `<section class="mp-detail"><div class="mp-heading"><h3>${esc(employee.name)}</h3><button class="btn secondary small" type="button" data-edit-rate>Дневная ставка</button></div><p class="ops-notice">Ставка на ${date(data.to)}: ${employee.daily_rate===null?'не задана':money(employee.daily_rate)} · рабочих дней: ${employee.workdays}</p><div class="mp-scroll"><table class="mp-table mp-days"><thead><tr><th>День</th><th>Начисление дня</th><th>Оплаты</th><th>Ставка</th><th>Зарплата</th></tr></thead><tbody>${employee.days.map(day=>`<tr><td data-label="День">${date(day.date)}${day.automatic?'<small>Есть завершённый ремонт</small>':''}</td><td data-label="Начисление дня"><select data-day="${day.date}" aria-label="Рабочий день ${day.date}">${[['auto','Автоматически'],['work','Рабочий день'],['off','Не начислять']].map(([value,label])=>`<option value="${value}" ${day.override===value?'selected':''}>${label}</option>`).join('')}</select></td><td class="mp-number" data-label="Оплаты">${money(day.revenue)}</td><td class="mp-number" data-label="Ставка">${day.daily_rate===null?'Не задана':money(day.daily_rate)}</td><td class="mp-number" data-label="Зарплата">${amount(day.salary)}</td></tr>`).join('')}</tbody></table></div><details class="mp-history"><summary>История дневных ставок</summary>${(employee.rate_history||employee.rates).map(rate=>`<p>С ${date(rate.effective_date)} — ${money(rate.daily_rate)} в рабочий день <small>Изменено ${date(rate.changed_at)} · ${esc(rate.changed_by_name||'Владелец')}</small></p>`).join('')||'<p>Ставка ещё не задана.</p>'}</details>${employee.repairs.length?`<details class="mp-history"><summary>Ремонты с оплатами за период</summary>${employee.repairs.map(repair=>`<p><a href="${ctx.href('order',{kind:'repair',id:repair.id})}">${esc(repair.number)}</a> · ${money(repair.paid)}</p>`).join('')}</details>`:''}<p data-day-message role="status"></p></section>`;
  detail.querySelector('[data-edit-rate]').onclick=()=>editRate(employee);
  detail.querySelectorAll('[data-day]').forEach(input=>input.onchange=async()=>{
   const day=employee.days.find(x=>x.date===input.dataset.day);input.disabled=true;
   try{await call('salary_day_save',{employee_id:employee.id,date:day.date,value:input.value,expected_revision:day.revision});await load();ctx.toast('Рабочий день сохранён');}
   catch(e){if(input.isConnected){input.value=day.override;input.disabled=false;detail.querySelector('[data-day-message]').textContent=e.message;}}
  });
 }
 function editRate(employee) {
  const start = data.to;
  ctx.modal('Дневная ставка · '+employee.name, `<label>Ставка за рабочий день, ₽<input name="daily_rate" type="number" min="0" max="1000000" step="0.01" required value="${esc(employee.daily_rate??'')}"></label><label>Действует с<input name="effective_date" type="date" required value="${start}"></label><p class="ops-notice">Начисляется один раз за рабочий день, независимо от числа ремонтов. Новая дата начала сохраняет прежние ставки для прошлых дней.</p>`,async value=>{
   const existing=employee.rates.find(x=>x.effective_date===value.effective_date);
   await call('salary_rate_save',{employee_id:employee.id,daily_rate:Number(value.daily_rate),effective_date:value.effective_date,basis:'working_days',expected_revision:existing?.revision||0});
   await load();ctx.toast('Дневная ставка сохранена');
  });
 }
 await load();
}
