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
const DATA_FILE = path.join(DATA_DIR, 'data.json');

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
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (normalizeData(data)) { save(data); }
    return data;
  } catch {
    return { files: {} };
  }
}

export function save(data: TrackingData): void {
  ensureDir();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  if (fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(DATA_FILE, DATA_FILE + '.backup');
  }
  fs.renameSync(tmp, DATA_FILE);
}

export function addTime(filePath: string, seconds: number, project?: string): void {
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
}

export function resetAll(): void {
  save({ files: {} });
}
