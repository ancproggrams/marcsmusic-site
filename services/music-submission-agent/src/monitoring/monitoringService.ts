import type { Repositories } from '../db/repositories.js';

export interface MonitoringSignal {
  level: 'ok' | 'warning' | 'critical';
  code: string;
  message: string;
}

export class MonitoringService {
  public constructor(private readonly repositories: Repositories) {}

  public check(): MonitoringSignal[] {
    const counts = this.repositories.queue.countByStatus();
    const signals: MonitoringSignal[] = [];

    if (counts.running > 50) {
      signals.push({ level: 'warning', code: 'high_running_jobs', message: 'High number of running jobs detected' });
    }

    if (counts.queued + counts.retrying > 1_000) {
      signals.push({ level: 'warning', code: 'queue_backlog', message: 'Queue backlog exceeds 1000 jobs' });
    }

    if (counts.failed > 100) {
      signals.push({ level: 'critical', code: 'error_spike', message: 'Failed jobs exceed operational threshold' });
    }

    if (counts.retrying > counts.queued && counts.retrying > 20) {
      signals.push({ level: 'warning', code: 'high_retry_rate', message: 'Retrying jobs exceed queued jobs' });
    }

    if (signals.length === 0) {
      signals.push({ level: 'ok', code: 'healthy', message: 'No operational alarms' });
    }

    return signals;
  }
}
