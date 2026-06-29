export function nowIso(date = new Date()): string {
  return date.toISOString();
}

export function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

export function isDue(isoDate: string, now = new Date()): boolean {
  return new Date(isoDate).getTime() <= now.getTime();
}
