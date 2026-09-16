import { randomUUID } from 'node:crypto';
export async function enqueue(tx, kind, key, { revive = false, dueAt = new Date().toISOString() } = {}) {
  const id = `${kind}:${key}`;
  const previous = await tx.get('jobs', id);
  if (previous && !revive) return previous;
  // Version identifies changes made while a worker is running. Such work is
  // scheduled again instead of being accidentally acknowledged by the old run.
  const job = { ...previous, id, kind, key, status: previous?.status === 'running' ? 'running' : 'pending',
    version: (previous?.version || 0) + 1, attempts: 0, dueAt, createdAt: previous?.createdAt || new Date().toISOString() };
  await tx.put('jobs', job);
  return job;
}
export function createWorker(store, handlers, { leaseMs = 120000, maxAttempts = 8, onError = console.error, onDead = async () => {} } = {}) {
  const running = new Set();
  let stopped = false;
  async function run(id) {
    if (stopped || running.has(id)) return;
    running.add(id);
    let claimed;
    let dead = false;
    try {
      claimed = await store.transaction(async tx => {
        const job = await tx.get('jobs', id);
        const now = Date.now();
        if (!job || ['done','dead'].includes(job.status) || Date.parse(job.dueAt) > now || (job.status === 'running' && Date.parse(job.leaseUntil) > now)) return null;
        job.status = 'running'; job.token = randomUUID(); job.leaseUntil = new Date(now + leaseMs).toISOString();
        await tx.put('jobs', job);
        return job;
      });
      if (!claimed) return;
      await handlers[claimed.kind](claimed.key);
      await store.transaction(async tx => {
        const current = await tx.get('jobs', id);
        if (current?.token !== claimed.token) return;
        current.status = current.version === claimed.version ? 'done' : 'pending';
        if (current.version === claimed.version) current.dueAt = new Date().toISOString();
        current.lastError = null;
        await tx.put('jobs', current);
      });
    } catch (error) {
      if (!claimed) throw error;
      await store.transaction(async tx => {
        const current = await tx.get('jobs', id);
        if (current?.token !== claimed.token) return;
        current.attempts = (current.attempts || 0) + 1;
        current.status = current.attempts >= maxAttempts ? 'dead' : 'pending';
        dead = current.status === 'dead';
        current.lastError = String(error.message).slice(0, 300);
        current.dueAt = new Date(Date.now() + Math.min(3600000, 1000 * 2 ** current.attempts) + Math.floor(Math.random() * 1000)).toISOString();
        await tx.put('jobs', current);
        await tx.audit('job.failed', { jobId: id, attempts: current.attempts, dead: current.status === 'dead' });
      });
      if (dead) await onDead(claimed);
      onError({ event: 'job.failed', jobId: id, error: error.message });
    } finally { running.delete(id); }
  }
  return {
    run,
    async tick() {
      if (stopped) return;
      const now = new Date().toISOString();
      const jobs = [...await store.list('jobs', { status:'pending', due:now, limit:20 }), ...await store.list('jobs', { status:'running', due:now, limit:20 })];
      for (const job of jobs) await run(job.id);
    },
    async stop() { stopped = true; while (running.size) await new Promise(resolve => setTimeout(resolve, 20)); }
  };
}
