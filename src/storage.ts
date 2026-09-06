import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface FileRecord {
  total: number;
  dailyTotal: { [date: string]: number };
  // seconds spent in each hour of the day (per date)
  dailyHours: { [date: string]: { [hour: number]: number } };
  lastActive: number;
  project?: string;  // workspace/repo root name, stored at tracking time
}

export interface TrackingData {
  files: { [filePath: string]: FileRecord };
}

const DATA_DIR = path.join(os.homedir(), '.vscode-time-tracker');
export const DATA_FILE = path.join(DATA_DIR, 'data.json');
const DATA_LOCK_FILE = path.join(DATA_DIR, 'data.json.lock');
const LOCK_STALE_MS = 3000;
const MAX_LOCK_RETRIES = 20;

function sleepSync(ms: number): void {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // short synchronous pause for microsecond file contention
  }
}

function acquireLock(): boolean {
  ensureDir();
  for (let attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
    try {
      const fd = fs.openSync(DATA_LOCK_FILE, 'wx');
      fs.writeFileSync(fd, `${process.pid}:${Date.now()}`, 'utf8');
      fs.closeSync(fd);
      return true;
    } catch (err: any) {
      if (err && err.code === 'EEXIST') {
        try {
          const stat = fs.statSync(DATA_LOCK_FILE);
          if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
            // Stale lock detected (process crashed or exited abruptly)
            fs.unlinkSync(DATA_LOCK_FILE);
            continue;
          }
        } catch {
          // Lock was released in the meantime
          continue;
        }
        sleepSync(10 + Math.floor(Math.random() * 15));
      } else {
        return false;
      }
    }
  }
  // Force break lock if still stuck after retries to prevent deadlock
  try {
    fs.unlinkSync(DATA_LOCK_FILE);
    const fd = fs.openSync(DATA_LOCK_FILE, 'wx');
    fs.writeFileSync(fd, `${process.pid}:${Date.now()}`, 'utf8');
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(): void {
  try {
    if (fs.existsSync(DATA_LOCK_FILE)) {
      fs.unlinkSync(DATA_LOCK_FILE);
    }
  } catch {
    // Ignore cleanup error
  }
}

export function withLock<T>(fn: () => T): T {
  const acquired = acquireLock();
  try {
    return fn();
  } finally {
    if (acquired) {
      releaseLock();
    }
  }
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeDailyHours(rec: FileRecord): boolean {
  let changed = false;
  const normalized: { [date: string]: { [hour: number]: number } } = {};

  for (const [date, entry] of Object.entries(rec.dailyHours || {})) {
    // Old format: array of hours (presence only)
    if (Array.isArray(entry)) {
      const hours = entry
        .map(h => Number(h))
        .filter(h => Number.isInteger(h) && h >= 0 && h < 24);
      const totalForDay = rec.dailyTotal?.[date] || 0;
      const perHour = hours.length > 0 ? totalForDay / hours.length : 0;
      const hourMap: { [hour: number]: number } = {};
      for (const h of hours) {
        hourMap[h] = (hourMap[h] || 0) + perHour;
      }
      normalized[date] = hourMap;
      changed = true;
      continue;
    }

    // New format: hour -> seconds
    if (entry && typeof entry === 'object') {
      const hourMap: { [hour: number]: number } = {};
      for (const [hStr, secs] of Object.entries(entry as Record<string, unknown>)) {
        const h = Number(hStr);
        if (!Number.isInteger(h) || h < 0 || h > 23) { continue; }
        const val = typeof secs === 'number' && Number.isFinite(secs) ? secs : 0;
        hourMap[h] = (hourMap[h] || 0) + val;
      }
      normalized[date] = hourMap;
      continue;
    }
  }

  if (changed || Object.keys(normalized).length !== Object.keys(rec.dailyHours || {}).length) {
    rec.dailyHours = normalized;
    return true;
  }

  rec.dailyHours = normalized;
  return false;
}

function normalizeData(data: TrackingData): boolean {
  let changed = false;
  for (const rec of Object.values(data.files)) {
    if (!rec.dailyTotal) { rec.dailyTotal = {}; changed = true; }
    if (!rec.dailyHours) { rec.dailyHours = {}; changed = true; }
    if (normalizeDailyHours(rec)) { changed = true; }
  }
  return changed;
}

export function load(): TrackingData {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { files: {} };
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (normalizeData(data)) { save(data); }
      return data;
    } catch {
      sleepSync(10);
    }
  }
  return { files: {} };
}

export function save(data: TrackingData): void {
  ensureDir();
  const tmp = DATA_FILE + '.' + process.pid + '.' + Date.now() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  if (fs.existsSync(DATA_FILE)) {
    try {
      fs.copyFileSync(DATA_FILE, DATA_FILE + '.backup');
    } catch {
      // ignore backup contention
    }
  }
  // Windows-safe rename with retry
  let replaced = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.renameSync(tmp, DATA_FILE);
      replaced = true;
      break;
    } catch {
      sleepSync(15);
    }
  }
  if (!replaced) {
    try {
      fs.copyFileSync(tmp, DATA_FILE);
      fs.unlinkSync(tmp);
    } catch {
      // fallback
    }
  }
}

export function addTime(filePath: string, seconds: number, project?: string): void {
  withLock(() => {
    const data = load();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const hour = now.getHours();
    if (!data.files[filePath]) {
      data.files[filePath] = { total: 0, dailyTotal: {}, dailyHours: {}, lastActive: Date.now() };
    }
    const rec = data.files[filePath];
    rec.total += seconds;
    rec.dailyTotal[today] = (rec.dailyTotal[today] || 0) + seconds;
    if (!rec.dailyHours) { rec.dailyHours = {}; }
    if (!rec.dailyHours[today]) { rec.dailyHours[today] = {}; }
    rec.dailyHours[today][hour] = (rec.dailyHours[today][hour] || 0) + seconds;
    rec.lastActive = Date.now();
    if (project) { rec.project = project; }
    save(data);
  });
}

export function resetAll(): void {
  withLock(() => {
    save({ files: {} });
  });
}
