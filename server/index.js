import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { openDatabase } from './database.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const resources = {
  clients: ['name', 'phone'], services: ['name', 'price'],
  transactions: ['description', 'type', 'amount', 'date', 'category', 'client_id'],
};
function validate(resource, body) {
  const text = (key, optional = false) => {
    if (optional && body[key] == null) { body[key] = ''; return; }
    if (typeof body[key] !== 'string' || (!optional && !body[key].trim()) || body[key].length > 200) throw new Error(`Campo inválido: ${key}`);
    body[key] = body[key].trim();
  };
  if (resource !== 'transactions') text('name');
  if (resource === 'clients') text('phone', true);
  if (resource === 'services' && (!Number.isSafeInteger(body.price) || body.price < 0)) throw new Error('Preço inválido');
  if (resource === 'transactions') {
    text('description'); text('category');
    if (!['income', 'expense'].includes(body.type)) throw new Error('Tipo inválido');
    if (!Number.isSafeInteger(body.amount) || body.amount <= 0) throw new Error('Valor inválido');
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date)) || new Date(body.date).toISOString().slice(0, 10) !== body.date) throw new Error('Data inválida');
    body.client_id ??= null;
    if (body.client_id !== null && (!Number.isSafeInteger(body.client_id) || body.client_id <= 0)) throw new Error('Cliente inválido');
  }
  return body;
}
export function createApp(db) {
  return createServer(async (req, res) => {
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const [, , resource, id, extra] = url.pathname.split('/');
        if (!resources[resource] || extra !== undefined || (id !== undefined && !/^[1-9]\d*$/.test(id))) return json(404, { error: 'Recurso não encontrado' });
        if (req.method === 'GET' && !id) return json(200, db.prepare(`SELECT * FROM ${resource} ORDER BY id DESC`).all());
        if (req.method === 'DELETE' && id) {
          const result = db.prepare(`DELETE FROM ${resource} WHERE id = ?`).run(Number(id));
          return json(result.changes ? 200 : 404, result.changes ? { success: true } : { error: 'Registro não encontrado' });
        }
        if (req.method === 'POST' && !id) {
          let raw = '';
          for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) return json(413, { error: 'Requisição muito grande' }); }
          let body;
          try {
            body = JSON.parse(raw);
            if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Dados inválidos');
            validate(resource, body);
            if (resource === 'transactions' && body.client_id !== null && !db.prepare('SELECT id FROM clients WHERE id = ?').get(body.client_id)) throw new Error('Cliente não encontrado');
          } catch (error) { return json(400, { error: error instanceof SyntaxError ? 'JSON inválido' : error.message }); }
          const fields = resources[resource];
          const result = db.prepare(`INSERT INTO ${resource} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...fields.map(key => body[key]));
          return json(201, db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(Number(result.lastInsertRowid)));
        }
        return json(405, { error: 'Método não permitido' });
      }
      const files = { '/': 'public/index.html', '/index.html': 'public/index.html', '/app.js': 'public/app.js', '/styles.css': 'public/styles.css' };
      if (!files[url.pathname]) return json(404, { error: 'Página não encontrada' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Método não permitido' });
      const file = await readFile(resolve(root, files[url.pathname]));
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(files[url.pathname])] + '; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'" });
      res.end(req.method === 'HEAD' ? undefined : file);
    } catch (error) { console.error(error); json(500, { error: 'Não foi possível concluir a operação' }); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openDatabase(process.env.DATABASE_PATH || resolve(root, 'data/financas.sqlite'));
  const app = createApp(db);
  app.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`MNunes Nails: http://127.0.0.1:${app.address().port}`));
  const close = () => app.close(() => { db.close(); process.exit(0); });
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
