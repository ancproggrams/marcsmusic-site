import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { config } from './config.js';

const platforms = [
  { id: 'MSP-0001', name: 'Soundplate', status: 'queued', score: 89 },
  { id: 'MSP-0002', name: 'Playlist Partner', status: 'queued', score: 82 },
  { id: 'MSP-0003', name: 'LabelRadar Beatport Greenroom', status: 'needs_manual_review', score: 95 },
  { id: 'MSP-0004', name: 'Spotify for Artists Editorial Pitching', status: 'needs_manual_review', score: 97 },
  { id: 'MSP-0005', name: 'Channel R Rising', status: 'queued', score: 87 }
];

function exportData() {
  mkdirSync(config.exportDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const queued = platforms.filter((p) => p.status === 'queued');
  const manual = platforms.filter((p) => p.status === 'needs_manual_review');
  const dashboard = {
    generated_at: generatedAt,
    total_platforms_discovered: platforms.length,
    submission_ready_platforms: queued.length,
    needs_manual_review: manual.length,
    auto_submit_enabled: config.autoSubmitEnabled
  };
  writeFileSync(`${config.exportDir}/verified_submission_platforms.json`, JSON.stringify(platforms, null, 2));
  writeFileSync(`${config.exportDir}/analytics_dashboard.json`, JSON.stringify(dashboard, null, 2));
  writeFileSync(`${config.exportDir}/submission_queue.json`, JSON.stringify(queued, null, 2));
  writeFileSync(`${config.exportDir}/daily_report.md`, `# Daily Report\n\nGenerated: ${generatedAt}\n`);
  return dashboard;
}

const dashboard = exportData();
console.log(JSON.stringify(dashboard));

createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true, ...dashboard }));
}).listen(Number(process.env.PORT ?? 3000));
