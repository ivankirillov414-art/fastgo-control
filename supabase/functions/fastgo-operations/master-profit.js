// Owner-only cash contribution and daily payroll. Historical costs and account IDs
// come from the repair journal; catalogue prices and assigned workers are not used.
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fail = (message, status = 400) => { throw Object.assign(Error(message), {status}); };
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value || 'null') : value; } catch { return null; } };
const rows = (sheets, name) => sheets[name]?.rows || [];
const cents = value => value === '' || value == null || typeof value === 'boolean' || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 100);
const money = value => value / 100;
const addDays = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const localDay = value => {
 if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
 const time = Date.parse(value); return Number.isFinite(time) ? new Date(time + 5 * 3600000).toISOString().slice(0, 10) : '';
};
export function validDate(value) {
 const time = Date.parse(value + 'T12:00:00Z');
 return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && value >= '2000-01-01' && value <= '2100-12-31' && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function reportPeriod(p, now = Date.now()) {
 const date = p.date || localDay(new Date(now).toISOString()), period = p.period || 'month';
 if (!validDate(date) || !['day', 'week', 'month'].includes(period)) fail('Проверьте дату и период');
 const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
 return {period, date, from: period === 'day' ? date : period === 'week' ? addDays(date, -((weekday + 6) % 7)) : date.slice(0, 8) + '01', to: date, timezone: 'Asia/Yekaterinburg'};
}
function journal(sheets) {
 return rows(sheets, 'События').map((row, index) => ({...row, order: Number(row.__row) || index + 2, detail: parse(row['Детали']) || {}})).sort((a, b) => a.order - b.order);
}
export function payrollState(sheets, events = journal(sheets)) {
 const rates = new Map(), days = new Map(), history = [];
 for (const e of events) {
  const d = e.detail; if (e['Тип'] !== 'payroll' || !uuid(d.employee_id)) continue;
  if (e['Действие'] === 'payroll_rate' && validDate(d.effective_date) && cents(d.daily_rate) !== null) { const entry = {...d, changed_at: e['Дата'], changed_by: e.actor_id}; rates.set(d.employee_id + ':' + d.effective_date, entry); history.push(entry); }
  if (e['Действие'] === 'payroll_day' && validDate(d.date) && ['work', 'off', 'auto'].includes(d.value)) days.set(d.employee_id + ':' + d.date, {...d, changed_at: e['Дата'], changed_by: e.actor_id});
 }
 return {rates: [...rates.values()], days: [...days.values()], history};
}
function completions(sheets, events = journal(sheets)) {
 const byRepair = new Map();
 for (const e of events) {
  const d = e.detail;
  if (e['Тип'] !== 'repair' || !e.record_id || !uuid(e.actor_id)) continue;
  const complete = e['Действие'] === 'repair_steps' && d.action === 'complete';
  const legacy = e['Действие'] === 'update' && ['ready', 'Готов', 'Готово'].includes(d.to_status) && d.from_status !== d.to_status;
  if (!complete && !legacy) continue;
  const date = localDay(complete ? d.completion_at || e['Дата'] : e['Дата']);
  if (!date) continue;
  const item = {employee_id: e.actor_id, name: d.completion_master_name || '', date, at: complete ? d.completion_at || e['Дата'] : e['Дата']};
  // A step completion also emits an update event. Keep the account from the
  // explicit completion rather than treating its companion event as more work.
  const list = byRepair.get(e.record_id) || [];
  if (!list.some(x => x.employee_id === item.employee_id && x.date === item.date)) list.push(item);
  byRepair.set(e.record_id, list);
 }
 return byRepair;
}
function repairCost(repair, movements) {
 const parsed = parse(repair['Строки запчастей']), parts = Array.isArray(parsed) ? parsed : [], movementGroups = new Map();
 let known = 0, missing = 0, zero = 0;
 for (const m of movements) {
  const sign = ['Расход', 'issue'].includes(m['Тип']) ? 1 : ['Возврат', 'return'].includes(m['Тип']) ? -1 : 0;
  if (!sign) continue;
  const id = m.product_id || '', group = movementGroups.get(id) || {quantity: 0, cost: 0, missing: false, zero: false};
  const quantity = Number(m['Количество']), price = cents(m['Цена закупки']);
  if (!Number.isFinite(quantity) || quantity <= 0) { group.missing = true; movementGroups.set(id, group); continue; }
  group.quantity += sign * quantity;
  if (price === null || price < 0) group.missing = true; else { group.cost += sign * Math.round(quantity * price); if (price === 0) group.zero = true; }
  movementGroups.set(id, group);
 }
 for (const group of movementGroups.values()) {
  if (group.quantity <= 0) continue;
  if (group.missing || group.cost < 0) missing++; else { known += group.cost; if (group.zero) zero++; }
 }
 for (const part of parts) {
  if (Number(part.quantity || 1) <= 0 || movementGroups.has(part.part_id || part.id || '')) continue;
  const price = cents(part.unit_cost), quantity = Number(part.quantity || 1);
  if (price === null || price < 0 || !Number.isFinite(quantity)) missing++;
  else { known += Math.round(price * quantity); if (price === 0) zero++; }
 }
 return {known, cost: missing ? null : Math.max(0, known), missing, zero};
}
function blank(id, name, active = true) {
 return {id, name, active, received: 0, refunds: 0, revenue: 0, parts_cost: 0, salary: 0, profit: 0, workdays: 0, missing_rates: 0, missing_cost: 0, zero_cost: 0, repairs: [], payments: [], days: [], rates: []};
}
export function masterProfit(sheets, p, members = [], now = Date.now()) {
 const events = journal(sheets), period = reportPeriod(p, now), payroll = payrollState(sheets, events), completed = completions(sheets, events), memberMap = new Map(members.map(m => [m.profile_id, m]));
 const reports = new Map(), repairs = new Map(rows(sheets, 'Ремонты').map(r => [r.repair_id, r]));
 const movementsByRepair = new Map(), paymentsByRepair = new Map();
 const append = (map, id, item) => { const list = map.get(id) || []; list.push(item); map.set(id, list); };
 for (const movement of rows(sheets, 'Движения склада')) append(movementsByRepair, movement.reference_id, movement);
 for (const event of events) if (['master_stock_consume', 'master_stock_restore'].includes(event['Действие'])) for (const item of event.detail.items || []) append(movementsByRepair, event.record_id, {product_id:item.part_id,'Тип':event['Действие']==='master_stock_consume'?'Расход':'Возврат','Количество':item.quantity,'Цена закупки':item.unit_cost});
 for (const payment of rows(sheets, 'Оплаты')) if (payment['Тип'] === 'repair') append(paymentsByRepair, payment.record_id, payment);
 const workDates = new Map();
 const get = (id, name) => {
  if (!reports.has(id)) { const member = memberMap.get(id); reports.set(id, blank(id, member?.name || name || 'Сотрудник ' + id.slice(0, 8), member?.active !== false)); }
  return reports.get(id);
 };
 for (const member of members) if (member.role === 'mechanic') get(member.profile_id, member.name);
 for (const list of completed.values()) for (const item of list) { get(item.employee_id, item.name); const set = workDates.get(item.employee_id) || new Set(); set.add(item.date); workDates.set(item.employee_id, set); }
 for (const item of [...payroll.rates, ...payroll.days]) get(item.employee_id);
 const unassigned = blank('', 'Исполнитель не подтверждён'), seenPayments = new Set(), paidWithoutJournal = [];
 for (const [repairId, repair] of repairs) {
  const cost = repairCost(repair, movementsByRepair.get(repairId) || []), total = cents(repair['Итого']), list = completed.get(repairId) || [], paid = (paymentsByRepair.get(repairId) || []).sort((a, b) => String(a['Дата']).localeCompare(String(b['Дата'])) || Number(a.__row || 0) - Number(b.__row || 0));
  if (!paid.length && Number(repair['Оплачено']) > 0) paidWithoutJournal.push({id: repairId, number: repair['Номер ремонта'], amount: Number(repair['Оплачено'])});
  let balance = 0;
  const allocatedCost = value => total > 0 && cost.cost !== null ? Number((BigInt(Math.min(total, Math.max(0, value))) * BigInt(cost.cost) + BigInt(total) / 2n) / BigInt(total)) : null;
  for (const payment of paid) {
   const key = payment.payment_id || payment.request_id || repairId + ':' + payment.__row;
   if (seenPayments.has(key)) continue; seenPayments.add(key);
   const amount = cents(payment['Сумма']), date = localDay(payment['Дата']);
   if (amount === null || !date) continue;
   const before = allocatedCost(balance); balance += amount; const after = allocatedCost(balance);
   if (date < period.from || date > period.to || amount === 0) continue;
   const performer = [...list].reverse().find(x => Date.parse(x.at) <= Date.parse(payment['Дата'])) || list[0], report = performer ? get(performer.employee_id, performer.name) : unassigned;
   const paymentCost = before === null || after === null ? null : after - before;
   report.received += Math.max(0, amount); report.refunds += Math.max(0, -amount); report.revenue += amount;
   if (paymentCost !== null) report.parts_cost += paymentCost;
   const existing = report.repairs.find(x => x.id === repairId);
   if (!existing) { report.repairs.push({id: repairId, number: repair['Номер ремонта'], paid: 0, missing_cost: cost.missing || (total === null || total <= 0 ? 1 : 0), zero_cost: cost.zero}); report.missing_cost += cost.missing || (total === null || total <= 0 ? 1 : 0); report.zero_cost += cost.zero; }
   report.repairs.find(x => x.id === repairId).paid += amount;
   report.payments.push({id: key, repair_id: repairId, number: repair['Номер ремонта'], date, amount, parts_cost: paymentCost});
  }
 }
 for (const report of reports.values()) {
  report.rates = payroll.rates.filter(x => x.employee_id === report.id).sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  report.rate_history = payroll.history.filter(x => x.employee_id === report.id).map(x => ({...x, changed_by_name: memberMap.get(x.changed_by)?.name || 'Владелец'})).reverse();
  const dayOverrides = new Map(payroll.days.filter(x => x.employee_id === report.id).map(x => [x.date, x]));
  for (let date = period.from; date <= period.to; date = addDays(date, 1)) {
   const rate = [...report.rates].reverse().find(x => x.effective_date <= date), override = dayOverrides.get(date), automatic = workDates.get(report.id)?.has(date) || false;
   const work = override?.value === 'work' || override?.value !== 'off' && automatic;
   const salary = work ? rate ? cents(rate.daily_rate) : null : 0, payments = report.payments.filter(x => x.date === date);
   if (work) { report.workdays++; if (salary === null) report.missing_rates++; else report.salary += salary; }
   report.days.push({date, automatic, override: override?.value || 'auto', revision: override?.revision || 0, work, daily_rate: rate?.daily_rate ?? null, salary, revenue: payments.reduce((n, x) => n + x.amount, 0), parts_cost: payments.some(x => x.parts_cost === null) ? null : payments.reduce((n, x) => n + x.parts_cost, 0)});
  }
  report.daily_rate = [...report.rates].reverse().find(x => x.effective_date <= period.to)?.daily_rate ?? null;
 }
 const finalize = report => {
  report.profit = report.missing_rates || report.missing_cost ? null : money(report.revenue - report.parts_cost - report.salary);
  for (const key of ['received', 'refunds', 'revenue', 'parts_cost', 'salary']) report[key] = money(report[key]);
  for (const repair of report.repairs) repair.paid = money(repair.paid);
  for (const payment of report.payments) { payment.amount = money(payment.amount); if (payment.parts_cost !== null) payment.parts_cost = money(payment.parts_cost); }
  for (const day of report.days) for (const key of ['salary', 'revenue', 'parts_cost']) if (day[key] !== null) day[key] = money(day[key]);
  report.repair_count = report.repairs.length; return report;
 };
 const items = [...reports.values()].map(finalize).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
 finalize(unassigned); unassigned.profit = null;
 const totals = items.reduce((t, x) => { for (const key of ['received', 'refunds', 'revenue', 'parts_cost', 'salary', 'workdays', 'repair_count', 'missing_rates', 'missing_cost', 'zero_cost']) t[key] += x[key]; return t; }, {received: 0, refunds: 0, revenue: 0, parts_cost: 0, salary: 0, workdays: 0, repair_count: 0, missing_rates: 0, missing_cost: 0, zero_cost: 0});
 for (const key of ['received', 'refunds', 'revenue', 'parts_cost', 'salary']) totals[key] = Math.round(totals[key] * 100) / 100;
 totals.profit = totals.missing_rates || totals.missing_cost ? null : Math.round((totals.revenue - totals.parts_cost - totals.salary) * 100) / 100;
 return {...period, items, totals, unassigned, paid_without_journal: paidWithoutJournal, generated_at: new Date(now).toISOString()};
}
export function payrollInput(action, p) {
 if (!uuid(p.request_id) || !uuid(p.employee_id) || !Number.isSafeInteger(p.expected_revision) || p.expected_revision < 0) fail('Проверьте сотрудника и повторите сохранение');
 if (action === 'salary_rate_save') {
  const value = p.daily_rate;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001 || !validDate(p.effective_date) || p.basis !== 'working_days') fail('Укажите дневную ставку, дату начала и правило начисления');
  return {request_id: p.request_id, employee_id: p.employee_id, expected_revision: p.expected_revision, daily_rate: value, effective_date: p.effective_date, basis: p.basis};
 }
 if (action !== 'salary_day_save' || !validDate(p.date) || !['work', 'off', 'auto'].includes(p.value)) fail('Проверьте рабочий день');
 return {request_id: p.request_id, employee_id: p.employee_id, expected_revision: p.expected_revision, date: p.date, value: p.value};
}
export function preparePayroll(snapshot, action, p, actor, members, now = new Date().toISOString()) {
 if (!['owner', 'developer'].includes(actor.role)) fail('Доступно только владельцу', 403);
 const value = payrollInput(action, p); if (!members.some(x => x.profile_id === p.employee_id)) fail('Сотрудник не найден', 404);
 const state = payrollState(snapshot.sheets), rate = action === 'salary_rate_save', previous = (rate ? state.rates : state.days).find(x => x.employee_id === p.employee_id && (rate ? x.effective_date === p.effective_date : x.date === p.date));
 if ((previous?.revision || 0) !== p.expected_revision) fail('Данные уже изменены. Обновите раздел и проверьте значение.', 409);
 const detail = {...value, revision: p.expected_revision + 1}; delete detail.expected_revision;
 return {changes: [{sheet: 'События', row: Math.max(1, ...rows(snapshot.sheets, 'События').map(x => Number(x.__row) || 1)) + 1, values: {event_id: crypto.randomUUID(), 'Дата': now, 'Тип': 'payroll', record_id: p.employee_id, 'Действие': rate ? 'payroll_rate' : 'payroll_day', actor_id: actor.id, 'Детали': JSON.stringify(detail), updated_at: now}}], result: detail};
}
