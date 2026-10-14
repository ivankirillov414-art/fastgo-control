const closed = new Set(['issued', 'returned', 'cancelled', 'deleted']);
const day = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';
export function workshopDay(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Yekaterinburg'}).format(now);
}
export function repairCount(count) {
  const n = Math.abs(count), tail = n % 100, digit = n % 10;
  return `${count} ${tail >= 11 && tail <= 14 ? 'ремонтов' : digit === 1 ? 'ремонт' : digit >= 2 && digit <= 4 ? 'ремонта' : 'ремонтов'}`;
}
export function needsApproval(record) {
  const total = Number(record.total_amount), approved = record.approved_amount;
  return ['diagnostics', 'waiting_parts', 'repair'].includes(record.status)
    && !!String(record.diagnostics_notes || '').trim() && total > 0
    && (approved === null || approved === undefined || approved === ''
      || !Number.isFinite(Number(approved)) || Math.abs(Number(approved) - total) >= .005);
}
export function buildPriorities(data, now = new Date()) {
  const today = workshopDay(now);
  const unique = rows => [...new Map((rows || []).filter(r => r?.id && !closed.has(r.status)).map(r => [r.id, r])).values()];
  const repairs = unique(data.repairs), storage = unique(data.storage);
  const byDue = (a, b) => (day(a.promised_date) || '9999').localeCompare(day(b.promised_date) || '9999')
    || String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id));
  const ready = repairs.filter(r => r.status === 'ready').sort(byDue);
  const working = repairs.filter(r => r.status !== 'ready').sort(byDue);
  const overdue = working.filter(r => day(r.promised_date) && day(r.promised_date) < today);
  const approvals = working.filter(needsApproval);
  const dueToday = repairs.filter(r => day(r.promised_date) === today).sort(byDue);
  const accepted = working.filter(r => r.status === 'accepted');
  const week = new Date(today + 'T12:00:00Z'); week.setUTCDate(week.getUTCDate() + 7);
  const weekEnd = week.toISOString().slice(0, 10);
  const storageDue = storage.filter(r => {
    const date = day(r.planned_return_date);
    return r.status === 'ready_return' || (date && date <= weekEnd);
  });
  let next;
  if (overdue.length) next = {kind: 'overdue', items: overdue, title: `${repairCount(overdue.length)} с прошедшим сроком`, description: 'Проверьте ход работ, уточните дату готовности и предупредите клиентов.', action: 'Разобрать просроченные'};
  else if (approvals.length) next = {kind: 'approval', items: approvals, title: `${repairCount(approvals.length)} ${approvals.length === 1 ? 'ждёт' : 'ждут'} согласования`, description: 'Диагностика завершена. Согласуйте текущую стоимость с клиентом перед продолжением работ.', action: 'Открыть согласования'};
  else if (ready.length) next = {kind: 'ready', items: ready, title: `${repairCount(ready.length)} ${ready.length === 1 ? 'готов' : 'готовы'} к выдаче`, description: 'Свяжитесь с клиентами и подготовьте технику к выдаче.', action: 'Открыть готовые ремонты'};
  else if (accepted.length) next = {kind: 'accepted', items: accepted, title: 'Начните диагностику', description: `${repairCount(accepted.length)} ${accepted.length === 1 ? 'принят' : 'приняты'} в мастерскую. Проверьте неисправность и определите дальнейшие работы.`, action: 'Открыть принятые ремонты'};
  else if (working.length) next = {kind: 'working', items: working, title: 'Продолжайте работу', description: 'Проверьте ближайшие сроки, поступление запчастей и готовность текущих ремонтов.', action: 'Открыть ремонты'};
  else next = {kind: 'empty', items: [], title: 'Можно принять новый ремонт', description: 'Сейчас активных ремонтов нет. Новая приёмка появится здесь после сохранения.', action: 'Принять в ремонт'};
  const tasks = unique([...overdue, ...dueToday]).sort(byDue);
  return {today, repairs, working, ready, overdue, approvals, storage, storageDue, next,
    tasks: (tasks.length ? tasks : [...approvals, ...working, ...ready].filter((r, i, all) => all.findIndex(x => x.id === r.id) === i)).slice(0, 3),
    tasksTitle: tasks.length ? 'На сегодня' : 'Ближайшие ремонты'};
}
