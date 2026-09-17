import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const tables = new Set(['bookings', 'supports', 'payments', 'subscriptions', 'assignments', 'jobs', 'audit_events', 'sync_state', 'metadata']);
const tableName = name => {
  if (!tables.has(name)) throw new Error('Unknown storage collection');
  return name;
};

// SQL records, rather than a shared JSON snapshot. All domain read/modify/write
// transactions use the same cross-process lock, and never perform network I/O.
export async function openStore({ url, path, legacyPath } = {}) {
  let pool, sqlite;
  if (url) {
    pool = new pg.Pool({ connectionString: url, max: 8, connectionTimeoutMillis: 5000,
      statement_timeout: 10000, idle_in_transaction_session_timeout: 15000 });
  } else {
    await mkdir(dirname(path), { recursive: true });
    const { DatabaseSync } = await import('node:sqlite');
    sqlite = new DatabaseSync(path);
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  }
  const execute = async (sql, values = [], client = pool) => {
    if (pool) return (await client.query(sql, values)).rows;
    const statement = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
    return statement.columns().length ? statement.all(...values) : (statement.run(...values), []);
  };
  const api = client => ({
    async get(table, id) {
      const rows = await execute(`SELECT payload FROM ${tableName(table)} WHERE id=$1`, [id], client);
      return rows[0] ? JSON.parse(rows[0].payload) : null;
    },
    async list(table, { status, source, before, after, limit = 100, offset = 0, due, active, requestKey, paymentId } = {}) {
      const where = [], values = [];
      const add = (expr, value) => { values.push(value); where.push(expr.replace('?', `$${values.length}`)); };
      if (status) add('status = ?', status);
      if (source) add('source = ?', source);
      if (before) add('start_utc < ?', before);
      if (after) add('end_utc > ?', after);
      if (due) add('due_at <= ?', due);
      if (active !== undefined) add('active = ?', active ? 1 : 0);
      if (requestKey) add('request_key = ?', requestKey);
      if (paymentId) add('payment_id = ?', paymentId);
      values.push(limit, offset);
      return (await execute(`SELECT payload FROM ${tableName(table)}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values, client)).map(row => JSON.parse(row.payload));
    },
    async put(table, record) {
      const id = record.id;
      if (!id) throw new Error('Record requires an ID');
      await execute(`INSERT INTO ${tableName(table)} (id,payload,status,start_utc,end_utc,created_at,request_key,payment_id,source,active,due_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,status=excluded.status,start_utc=excluded.start_utc,end_utc=excluded.end_utc,
        request_key=excluded.request_key,payment_id=excluded.payment_id,source=excluded.source,active=excluded.active,due_at=excluded.due_at`,
      [id, JSON.stringify(record), record.status || '', record.startUtc || '', record.endUtc || '', record.createdAt || new Date().toISOString(),
        record.requestKey || null, record.molliePaymentId || null, record.source || '', record.active ? 1 : 0, record.dueAt || ''], client);
      return record;
    },
    async remove(table, id) { await execute(`DELETE FROM ${tableName(table)} WHERE id=$1`, [id], client); },
    async audit(action, details = {}) {
      return this.put('audit_events', { id: randomUUID(), action, details, createdAt: new Date().toISOString() });
    },
    async count(table, status) {
      const rows = await execute(`SELECT COUNT(*) AS count FROM ${tableName(table)}${status ? ' WHERE status=$1' : ''}`, status ? [status] : [], client);
      return Number(rows[0].count);
    },
    async prune(table, before, { status, active } = {}) {
      const where = ['created_at < $1'];
      const values = [before];
      if (status) { values.push(status); where.push(`status = $${values.length}`); }
      if (active !== undefined) { values.push(active ? 1 : 0); where.push(`active = $${values.length}`); }
      await execute(`DELETE FROM ${tableName(table)} WHERE ${where.join(' AND ')}`, values, client);
    }
  });
  let queue = Promise.resolve(), pending = 0;
  const store = {
    ...api(pool),
    async transaction(work) {
      if (pending >= 100) throw Object.assign(new Error('Storage busy'), { statusCode: 503 });
      pending++;
      const task = queue.then(async () => {
        const client = pool ? await pool.connect() : undefined;
        try {
          await execute(pool ? 'BEGIN' : 'BEGIN IMMEDIATE', [], client);
          if (pool) await execute('SELECT pg_advisory_xact_lock(782145901)', [], client);
          const result = await work(api(client));
          await execute('COMMIT', [], client);
          return result;
        } catch (error) {
          await execute('ROLLBACK', [], client).catch(() => {});
          throw error;
        } finally { client?.release(); }
      });
      queue = task.catch(() => {});
      try { return await task; } finally { pending--; }
    },
    async readiness() {
      return this.transaction(async tx => { const id = randomUUID(); await tx.put('metadata', { id }); await tx.remove('metadata', id); return true; });
    },
    async close() { await queue; if (pool) await pool.end(); else sqlite.close(); }
  };
  for (const table of tables) {
    await execute(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT '',start_utc TEXT NOT NULL DEFAULT '',end_utc TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,request_key TEXT,payment_id TEXT,source TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 0,due_at TEXT NOT NULL DEFAULT '')`);
  }
  for (const sql of [
    'CREATE UNIQUE INDEX IF NOT EXISTS bookings_request_key ON bookings(request_key)',
    'CREATE UNIQUE INDEX IF NOT EXISTS bookings_payment_id ON bookings(payment_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_id ON payments(payment_id)',
    'CREATE INDEX IF NOT EXISTS bookings_window ON bookings(start_utc,end_utc)',
    'CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,due_at)',
    'CREATE INDEX IF NOT EXISTS assignments_source ON assignments(source,active)',
    'CREATE INDEX IF NOT EXISTS bookings_created ON bookings(created_at,id)'
  ]) await execute(sql);
  if (legacyPath) {
    let legacy;
    try { legacy = JSON.parse(await readFile(legacyPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (legacy) await store.transaction(async tx => {
      if (await tx.get('metadata', 'legacy-import-v1')) return;
      if (await tx.count('bookings') || await tx.count('subscriptions') || await tx.count('assignments')) throw new Error('Refusing legacy import into non-empty database');
      for (const [key, table] of [['bookings','bookings'], ['supports','supports'], ['payments','payments'], ['newsletterSubscriptions','subscriptions'], ['assignments','assignments'], ['audit','audit_events']]) {
        for (const record of legacy[key] || []) await tx.put(table, { ...record, id: record.id || record.email || randomUUID(), createdAt: record.createdAt || record.at || new Date().toISOString() });
      }
      for (const [id, record] of Object.entries(legacy.syncState || {})) await tx.put('sync_state', { ...record, id });
      if (legacy.trackPlayCounts) await tx.put('metadata', { id: 'track-play-counts', counts: legacy.trackPlayCounts });
      await tx.put('metadata', { id: 'legacy-import-v1', path: legacyPath });
    });
  }
  return store;
}
