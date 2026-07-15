export class Metrics {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
  }

  increment(name, labels = {}, value = 1) {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  gauge(name, labels = {}, value = 0) {
    this.gauges.set(metricKey(name, labels), Number(value));
  }

  render() {
    const lines = [];
    for (const [key, value] of [...this.counters.entries(), ...this.gauges.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`${key} ${Number.isFinite(value) ? value : 0}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

function metricKey(name, labels) {
  const safeName = String(name).replace(/[^a-zA-Z0-9_:]/gu, "_");
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return safeName;
  const serialized = entries.map(([key, value]) => `${key.replace(/[^a-zA-Z0-9_]/gu, "_")}="${String(value).replace(/["\\\n]/gu, "_")}"`).join(",");
  return `${safeName}{${serialized}}`;
}
