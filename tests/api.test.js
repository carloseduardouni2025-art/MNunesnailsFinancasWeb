import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index.js';
import { openDatabase } from '../server/database.js';

test('API: cadastros, validação, vínculo e arquivos públicos', async () => {
  const db = openDatabase(':memory:');
  const server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body) => fetch(base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const clientResponse = await request('/api/clients', { name: 'Ana', phone: '11999999999' });
    assert.equal(clientResponse.status, 201);
    const client = await clientResponse.json();
    assert.equal((await request('/api/services', { name: 'Manicure', price: 4500 })).status, 201);
    const transaction = { description: 'Manicure', amount: 4500, type: 'income', date: '2026-10-11', category: 'Atendimento', client_id: client.id };
    assert.equal((await request('/api/transactions', transaction)).status, 201);
    for (const invalid of [{ amount: -1 }, { amount: 1.5 }, { type: 'other' }, { date: '2026-02-30' }, { client_id: 999 }, { description: '' }]) {
      assert.equal((await request('/api/transactions', { ...transaction, ...invalid })).status, 400);
    }
    assert.equal((await request('/api/clients', { name: ' ' })).status, 400);
    assert.equal((await request('/api/services', { name: 'Manicure', price: -1 })).status, 400);
    assert.equal((await fetch(base + '/api/clients', { method: 'POST', body: '{broken' })).status, 400);
    assert.equal((await fetch(base + `/api/clients/${client.id}`, { method: 'DELETE' })).status, 200);
    const rows = await (await request('/api/transactions')).json();
    assert.equal(rows.length, 1); assert.equal(rows[0].client_id, null); assert.equal(rows[0].amount, 4500);
    assert.equal((await fetch(base + `/api/transactions/${rows[0].id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(base + '/api/transactions/999', { method: 'DELETE' })).status, 404);
    assert.equal((await request('/api/unknown')).status, 404);
    for (const path of ['/', '/app.js', '/styles.css']) assert.equal((await request(path)).status, 200);
    assert.equal((await request('/server/database.js')).status, 404);
    assert.equal((await request('/data/financas.sqlite')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});

test('SQLite mantém os registros ao reabrir o banco', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mnunes-test-'));
  const path = join(directory, 'test.sqlite');
  let db;
  try {
    db = openDatabase(path);
    db.prepare('INSERT INTO services (name, price) VALUES (?, ?)').run('Alongamento', 12000);
    db.close(); db = openDatabase(path);
    assert.equal(db.prepare('SELECT price FROM services').get().price, 12000);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
  } finally { db?.close(); rmSync(directory, { recursive: true }); }
});

test('Sprint 2: editar serviço, registrar receita e preservar histórico após edição e exclusão', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mnunes-sprint2-'));
  const path = join(directory, 'test.sqlite');
  let db = openDatabase(path);
  const server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (route, method = 'GET', body) => fetch(base + route, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    const created = await request('/services', 'POST', { name: 'Manicure', price: 4500 });
    assert.equal(created.status, 201);
    const service = await created.json();
    const edited = await request(`/services/${service.id}`, 'PUT', { name: 'Manicure completa', price: 5500 });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).price, 5500);
    for (const body of [{ name: '', price: 100 }, { name: 'Teste', price: -1 }, { name: 'Teste', price: 1.2 }, { name: 'Teste' }]) {
      assert.equal((await request(`/services/${service.id}`, 'PUT', body)).status, 400);
    }
    assert.equal((await request('/services/99999', 'PUT', { name: 'Teste', price: 100 })).status, 404);
    const services = await (await request('/services')).json();
    assert.equal(services[0].name, 'Manicure completa');
    assert.equal(services[0].price, 5500);
    const receipt = await request('/transactions', 'POST', {
      description: services[0].name, type: 'income', amount: services[0].price,
      date: '2026-11-01', category: 'Atendimento',
    });
    assert.equal(receipt.status, 201);
    assert.equal((await request(`/services/${service.id}`, 'PUT', { name: 'Novo nome', price: 6500 })).status, 200);
    assert.equal((await request(`/services/${service.id}`, 'DELETE')).status, 200);
    const receipts = await (await request('/transactions')).json();
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].amount, 5500);
    assert.equal(receipts[0].description, 'Manicure completa');
    assert.equal((await (await request('/services')).json()).length, 0);
    await new Promise(resolve => server.close(resolve));
    db.close(); db = openDatabase(path);
    assert.equal(db.prepare('SELECT amount FROM transactions').get().amount, 5500);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    db.close(); rmSync(directory, { recursive: true });
  }
});
