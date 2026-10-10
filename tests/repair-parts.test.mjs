import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRepairPart, addRepairPart } from '../workshop/repair-parts.js';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const OTHER_ID = '123e4567-e89b-42d3-a456-426614174001';
const part = overrides => ({
  id: ID, name: 'Тормозные колодки', barcode: 'FGP-00000001', sku: 'PAD-01',
  retail_price: 350, quantity: 5, active: true, ...overrides
});
const noRefresh = () => { throw new Error('unexpected refresh'); };

test('barcode and SKU match exactly with case and surrounding whitespace ignored', async () => {
  const item = part({ sku: ' pad-01 ' });
  for (const code of ['FGP-00000001', ' \nfgp-00000001\r ', ' PAD-01 ']) {
    assert.equal(await resolveRepairPart(code, [item], noRefresh), item);
  }
  const numbered = part({ barcode: '001234567890' });
  assert.equal(await resolveRepairPart('001234567890', [numbered], noRefresh), numbered);
  await assert.rejects(resolveRepairPart('1234567890', [numbered]), /не найдена/);
  await assert.rejects(resolveRepairPart('PAD', [item]), /не найдена/);
});

test('the same product matched by both fields or repeated ID remains one candidate', async () => {
  const item = part({ sku: 'FGP-00000001' });
  const duplicate = { ...item, id: ID.toUpperCase() };
  assert.equal(await resolveRepairPart(item.barcode, [item, duplicate], noRefresh), item);
});

test('duplicate SKU and barcode-SKU collisions never select the first product', async () => {
  const item = part();
  const sameSku = part({ id: OTHER_ID, barcode: 'FGP-00000002' });
  const crossField = part({ id: OTHER_ID, barcode: 'FGP-00000002', sku: item.barcode });
  const sameBarcode = part({ id: OTHER_ID, sku: 'PAD-02' });
  for (const [code, entries] of [
    [item.sku, [item, sameSku]],
    [item.barcode, [item, crossField]],
    [item.barcode, [crossField, item]],
    [item.barcode, [item, sameBarcode]]
  ]) {
    await assert.rejects(resolveRepairPart(code, entries, noRefresh), /нескольким запчастям/);
  }
});

test('archived products and category codes fail without refreshing or exposing the code', async () => {
  await assert.rejects(resolveRepairPart('FGP-00000001', [part({ active: false })], noRefresh), /отключена/);
  await assert.rejects(resolveRepairPart(' fGc-000001 ', [], noRefresh), /код категории.*Сканируйте конкретную запчасть/);
});

test('a catalog miss refreshes once and can find a newly available product', async () => {
  const item = part();
  let calls = 0;
  const result = await resolveRepairPart('pad-01', [], async () => { calls++; return [item]; });
  assert.equal(result, item);
  assert.equal(calls, 1);
});

test('unknown text remains unknown after one refresh and is not echoed in the error', async () => {
  const code = 'private-unrecognized-label';
  let calls = 0;
  await assert.rejects(resolveRepairPart(code, [part()], async () => { calls++; return []; }), error => {
    assert.match(error.message, /Запчасть не найдена/);
    assert.equal(error.message.includes(code), false);
    return true;
  });
  assert.equal(calls, 1);
});

test('refresh errors propagate unchanged, and malformed responses cannot become a match', async () => {
  const failure = Object.assign(new Error('Нет соединения с сервером'), { status: 503 });
  let calls = 0;
  await assert.rejects(resolveRepairPart('PAD-01', [], async () => { calls++; throw failure; }), error => error === failure);
  assert.equal(calls, 1);
  await assert.rejects(resolveRepairPart('PAD-01', [], async () => ({ parts: [part()] })), /прочитать каталог/);
  await assert.rejects(resolveRepairPart('PAD-01', [], async () => [part({ active: false })]), /отключена/);
});

test('QR URLs are not interpreted as product IDs or embedded barcodes', async () => {
  for (const code of [
    'https://f.go/?barcode=FGP-00000001',
    'https://f.go/#stock?part_id=' + ID,
    '{"barcode":"FGP-00000001"}'
  ]) {
    let calls = 0;
    await assert.rejects(resolveRepairPart(code, [part()], async () => { calls++; return [part()]; }), /не найдена/);
    assert.equal(calls, 1);
  }
});

test('blank codes fail before lookup and codes longer than 100 characters are never truncated', async () => {
  for (const code of ['', ' \r\n ', null, undefined, {}, true]) {
    await assert.rejects(resolveRepairPart(code, [], noRefresh), /Сканируйте код/);
  }
  const code = 'x'.repeat(100), item = part({ sku: code });
  assert.equal(await resolveRepairPart(' ' + code + ' ', [item], noRefresh), item);
  await assert.rejects(resolveRepairPart(code + 'y', [item], noRefresh), /максимум 100/);
});

test('a matching product needs a valid ID, name, and finite nonnegative price', async () => {
  for (const fields of [
    { id: '' }, { id: 'not-a-product-id' }, { id: 15 },
    { name: '' }, { name: '  ' }, { name: 15 }, { name: 'x'.repeat(201) },
    { retail_price: null }, { retail_price: undefined }, { retail_price: '' },
    { retail_price: ' ' }, { retail_price: true }, { retail_price: [] },
    { retail_price: {} }, { retail_price: -1 }, { retail_price: NaN },
    { retail_price: Infinity }, { retail_price: 'not a price' }, { retail_price: 1e9 + 1 }
  ]) {
    await assert.rejects(resolveRepairPart('FGP-00000001', [part(fields)], noRefresh), /некорректн/);
  }
  for (const retail_price of [0, '0', '350.50']) {
    const item = part({ retail_price });
    assert.equal(await resolveRepairPart(item.barcode, [item], noRefresh), item);
  }
});

test('unmatched malformed catalog entries and empty codes do not create phantom matches', async () => {
  const item = part();
  assert.equal(await resolveRepairPart(item.barcode, [null, {}, item], noRefresh), item);
  await assert.rejects(resolveRepairPart('undefined', [part({ sku: undefined })]), /не найдена/);
});

test('adding a part creates a linked row and repeated scans preserve its edited name and price', () => {
  const rows = [], item = part({ retail_price: '350.50' });
  const first = addRepairPart(rows, item);
  assert.deepEqual(first, { name: item.name, price: 350.5, quantity: 1, part_id: ID });
  first.name = 'Колодки, цена согласована';
  first.price = 300;
  assert.equal(addRepairPart(rows, part({ retail_price: 400 })), first);
  assert.equal(rows.length, 1);
  assert.deepEqual(first, { name: 'Колодки, цена согласована', price: 300, quantity: 2, part_id: ID });
});

test('free rows with the same name remain separate and zero stock does not block draft changes', () => {
  const free = { name: 'Тормозные колодки', price: 100, quantity: 1 };
  const rows = [free], item = part({ quantity: 0 });
  const linked = addRepairPart(rows, item);
  assert.notEqual(linked, free);
  assert.equal(rows.length, 2);
  addRepairPart(rows, item);
  assert.equal(rows.length, 2);
  assert.equal(free.quantity, 1);
  assert.equal(linked.quantity, 2);
  assert.equal(item.quantity, 0);
});

test('existing product IDs do not create a second linked line and quantity 999 can become 1000', () => {
  const row = { part_id: ID.toUpperCase(), name: 'Сохранённое название', price: 200, quantity: '999' };
  const rows = [row];
  assert.equal(addRepairPart(rows, part()), row);
  assert.equal(row.quantity, 1000);
  assert.equal(rows.length, 1);
  assert.throws(() => addRepairPart(rows, part()), /от 1 до 1000/);
  assert.equal(row.quantity, 1000);
  assert.equal(rows.length, 1);
});

test('invalid quantities cannot be silently corrected or changed by a scan', () => {
  for (const quantity of [0, -1, 1.5, 1001, NaN, Infinity, null, undefined, '', ' ', true, []]) {
    const row = { part_id: ID, name: 'Сохранённая строка', price: 200, quantity };
    const rows = [row], before = structuredClone(rows);
    assert.throws(() => addRepairPart(rows, part()), /от 1 до 1000/);
    assert.deepEqual(rows, before);
  }
});

test('invalid or archived parts cannot mutate the repair even when called directly', () => {
  for (const fields of [{ active: false }, { id: 'broken' }, { name: '' }, { retail_price: null }]) {
    const rows = [];
    assert.throws(() => addRepairPart(rows, part(fields)), /отключена|некорректн/);
    assert.deepEqual(rows, []);
  }
});
