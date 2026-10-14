// Authenticated metadata only. Never return journal values, receipts or customer data.
const query = values => new URLSearchParams(values).toString();
const canonical = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const version = value => /^\d{1,15}$/.test(String(value)) && Number.isSafeInteger(Number(value));
const uuid = value => /^[a-f0-9-]{36}$/i.test(String(value || ''));
export async function nativeSyncStatus(db, member, permissions, release) {
  const [states, configs, staff] = await Promise.all([
    db('workshop_native_state', 'id=eq.1&select=version,mode,imported_at'),
    db('workshop_backend_config', 'id=eq.1&select=storage_mode'),
    db('workshop_members', 'select=profile_id,name,role,active,tags,created_at,approved_at&order=profile_id')
  ]);
  const state = states?.[0];
  if (configs?.[0]?.storage_mode !== 'postgres' || state?.mode !== 'active' || !version(state.version)) return {protocol: 1, incremental: false};
  const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value))))].map(n => n.toString(16).padStart(2, '0')).join('');
  return {protocol: 1, incremental: true, version: String(state.version), epoch: String(state.imported_at || ''), access: await hash({member, permissions, release}), catalog: await hash(staff)};
}

export async function nativeSyncChanges(db, p) {
  if (!version(p.since) || !version(p.until) || Number(p.since) > Number(p.until)) throw Object.assign(Error('Неверная версия синхронизации'), {status: 400});
  const reset = () => ({reset: true, version: String(p.until)});
  const states = await db('workshop_native_state', 'id=eq.1&select=version,mode,imported_at');
  const state = states?.[0];
  if (state?.mode !== 'active' || String(state.imported_at || '') !== p.epoch || Number(p.until) > Number(state.version)) return reset();
  const size = Number(p.until) - Number(p.since);
  // A long offline period or a gap in retention safely falls back to a full snapshot.
  if (size > 200) return reset();
  if (!size) return {reset: false, version: String(p.until), records: [], catalog: false, overview: false};
  const journal = await db('workshop_native_outbox', query({and: `(version.gt.${p.since},version.lte.${p.until})`, select: 'version,changes', order: 'version.asc', limit: '200'}));
  if (journal.length !== size || journal.some((r, i) => Number(r.version) !== Number(p.since) + i + 1)) return reset();
  const sheets = new Map(), ignored = new Set(['Операции API', 'Движения склада', 'Продажи', 'Строки продаж']);
  const catalogSheets = new Set(['Категории', 'Товары', 'Сотрудники', 'Прайс работ', 'Фото товаров']);
  const recordSheets = new Set(['Ремонты', 'Зимнее хранение', 'Приёмки', 'Клиенты', 'Оплаты', 'События', 'Файлы миграции', 'Настройки']);
  let catalog = false;
  for (const entry of journal) {
    if (!Array.isArray(entry.changes)) return reset();
    for (const change of entry.changes) {
      if (catalogSheets.has(change.sheet)) {catalog = true; continue;}
      if (ignored.has(change.sheet)) continue;
      // Legal details, schema changes and future domains affect more than a card.
      if (!recordSheets.has(change.sheet) || !Number.isInteger(change.row) || change.row < 2) return reset();
      if (!sheets.has(change.sheet)) sheets.set(change.sheet, new Set());
      sheets.get(change.sheet).add(change.row);
    }
  }
  const rows = [];
  const read = async (sheet, filter) => {
    const result = await db('workshop_native_rows', query({sheet: 'eq.' + sheet, ...filter, select: 'sheet,row_no,data', limit: '501'}));
    if (result.length > 500) throw Object.assign(Error('sync snapshot required'), {syncReset: true});
    rows.push(...result);return result;
  };
  try {
    for (const [sheet, numbers] of sheets) {
      const list = [...numbers];
      if (list.length > 500) return reset();
      for (let i = 0; i < list.length; i += 100) {
        const part = list.slice(i, i + 100), found = await read(sheet, {row_no: 'in.(' + part.join(',') + ')'});
        if (found.length !== part.length) return reset();
      }
    }
    // Every new intake advances number counters; these must not cause a full reload.
    if (rows.some(r => r.sheet === 'Настройки' && !/^next_(product|category|intake|repair|storage|sale|movement)_seq$/.test(r.data['Ключ']))) return reset();
    const related = async (sheet, field, values) => {
      const ids = [...new Set(values.filter(Boolean))];
      if (ids.some(id => !uuid(id))) throw Object.assign(Error('sync snapshot required'), {syncReset: true});
      for (let i = 0; i < ids.length; i += 50) await read(sheet, {['data->>' + field]: 'in.(' + ids.slice(i, i + 50).join(',') + ')'});
    };
    await related('Приёмки', 'client_id', rows.filter(r => r.sheet === 'Клиенты').map(r => r.data.client_id));
    const intakes = rows.filter(r => r.sheet === 'Приёмки').map(r => r.data.intake_id);
    for (const sheet of ['Ремонты', 'Зимнее хранение']) await related(sheet, 'intake_id', intakes);
    // Payment/photo/event rows identify the card even if its status never changed.
    const ids = rows.map(r => r.data.record_id).filter(Boolean);
    await related('Ремонты', 'repair_id', ids);
    await related('Зимнее хранение', 'storage_id', ids);
    const records = new Map();
    const add = (kind, id) => {if (id) {if (!uuid(id)) throw Object.assign(Error('sync snapshot required'), {syncReset: true});records.set(kind + ':' + id, {kind, id});}};
    for (const row of rows) {
      if (row.sheet === 'Ремонты') {add('repair', row.data.repair_id);add('storage', row.data.storage_id);}
      if (row.sheet === 'Зимнее хранение') add('storage', row.data.storage_id);
    }
    if (records.size > 200) return reset();
    return {reset: false, version: String(p.until), records: [...records.values()], catalog, overview: true};
  } catch (e) {if (e.syncReset) return reset();throw e;}
}
