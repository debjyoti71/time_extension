import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface FileRecord {
  total: number; // seconds
  dailyTotal: { [date: string]: number };
  lastActive: number; // timestamp
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

export function load(): TrackingData {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { files: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { files: {} };
  }
}

export function save(data: TrackingData): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
}

export function addTime(filePath: string, seconds: number): void {
  const data = load();
  const today = new Date().toISOString().slice(0, 10);
  if (!data.files[filePath]) {
    data.files[filePath] = { total: 0, dailyTotal: {}, lastActive: Date.now() };
  }
  const rec = data.files[filePath];
  rec.total += seconds;
  rec.dailyTotal[today] = (rec.dailyTotal[today] || 0) + seconds;
  rec.lastActive = Date.now();
  save(data);
}

export function resetAll(): void {
  save({ files: {} });
}
