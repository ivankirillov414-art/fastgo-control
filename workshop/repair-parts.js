const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CODE_LENGTH = 100;
const MAX_QUANTITY = 1000;

function codeText(value) {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) return '';
  return String(value).trim();
}

function validatePart(part) {
  if (!part || typeof part.id !== 'string' || !UUID.test(part.id)) {
    throw new Error('У запчасти некорректный идентификатор. Обновите каталог.');
  }
  if (part.active === false) {
    throw new Error('Эта запчасть отключена. Выберите активную позицию.');
  }
  if (typeof part.name !== 'string' || !part.name.trim() || part.name.length > 200) {
    throw new Error('У запчасти некорректное название. Обновите каталог.');
  }
  const value = part.retail_price;
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim()) ||
      !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e9) {
    throw new Error('У запчасти некорректная цена. Обновите каталог.');
  }
  return part;
}

function findPart(code, catalogParts) {
  if (!Array.isArray(catalogParts)) {
    throw new Error('Не удалось прочитать каталог запчастей. Обновите страницу.');
  }
  const candidates = new Map();
  for (const part of catalogParts) {
    if (!part || ![part.barcode, part.sku].some(value => codeText(value).toUpperCase() === code)) continue;
    validatePart(part);
    const id = part.id.toLowerCase();
    if (!candidates.has(id)) candidates.set(id, part);
  }
  if (candidates.size > 1) {
    throw new Error('Код относится к нескольким запчастям. Выберите нужную вручную.');
  }
  return candidates.values().next().value;
}

export async function resolveRepairPart(rawCode, catalogParts, refreshParts) {
  const text = codeText(rawCode);
  if (!text) throw new Error('Сканируйте код конкретной запчасти или введите его вручную.');
  if (text.length > MAX_CODE_LENGTH) {
    throw new Error('Код запчасти слишком длинный: максимум 100 символов.');
  }
  const code = text.toUpperCase();
  if (code.startsWith('FGC-')) {
    throw new Error('Это код категории. Сканируйте конкретную запчасть.');
  }
  // QR payloads are literal codes, never URLs to open or sources of an arbitrary ID.
  let part = findPart(code, catalogParts);
  if (!part && typeof refreshParts === 'function') part = findPart(code, await refreshParts());
  if (!part) throw new Error('Запчасть не найдена. Найдите её вручную или проверьте этикетку.');
  return part;
}

export function addRepairPart(rows, part) {
  validatePart(part);
  if (!Array.isArray(rows)) {
    throw new Error('Не удалось прочитать список запчастей ремонта. Обновите карточку.');
  }
  const existing = rows.find(row => typeof row?.part_id === 'string' &&
    row.part_id.toLowerCase() === part.id.toLowerCase());
  if (existing) {
    const value = existing.quantity;
    const quantity = Number(value);
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !value.trim()) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity >= MAX_QUANTITY) {
      throw new Error('Количество запчасти в строке должно быть целым числом от 1 до 1000.');
    }
    existing.quantity = quantity + 1;
    return existing;
  }
  // Stock changes only when the repair is saved; its existing parts are already deducted.
  const row = { name: part.name, price: Number(part.retail_price), quantity: 1, part_id: part.id };
  rows.push(row);
  return row;
}
