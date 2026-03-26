import * as vscode from 'vscode';
import * as storage from './storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';

const IDLE_TIMEOUT_MS   = 5 * 60 * 1000;
const FLUSH_INTERVAL_MS = 30 * 1000;

type TickCallback = () => void;
let onTickCallbacks: TickCallback[] = [];

export function onTick(cb: TickCallback): () => void {
  onTickCallbacks.push(cb);
  return () => { onTickCallbacks = onTickCallbacks.filter(x => x !== cb); };
}

function fireTick(): void {
  onTickCallbacks.forEach(cb => cb());
}

let currentFile: string | undefined;
let sessionStart: number | undefined;
let flushTimer: NodeJS.Timeout | undefined;
let heartbeatProc: ChildProcess | undefined;
let pendingSeconds: number = 0;

const HEARTBEAT_FILE = path.join(os.homedir(), '.vscode-time-tracker', 'heartbeat.json');

function getSystemIdleMs(): number {
  try {
    const raw = fs.readFileSync(HEARTBEAT_FILE, 'utf8');
    return JSON.parse(raw).idleMs || 0;
  } catch {
    return 0;
  }
}

function isIdle(): boolean {
  return getSystemIdleMs() > IDLE_TIMEOUT_MS;
}

function getWorkspaceFallback(): string | undefined {
  const ws = vscode.workspace.workspaceFolders;
  return ws && ws.length > 0 ? path.join(ws[0].uri.fsPath, '__workspace__') : undefined;
}

function pauseCurrent(): void {
  if (currentFile && sessionStart) {
    pendingSeconds += Math.floor((Date.now() - sessionStart) / 1000);
  }
  sessionStart = undefined;
}

function flushPending(): void {
  if (currentFile && pendingSeconds > 0) {
    storage.addTime(currentFile, pendingSeconds);
    pendingSeconds = 0;
  }
}

function resumeCurrent(): void {
  if (currentFile) {
    sessionStart = Date.now();
  }
}

export function getElapsedToday(): number {
  const data = storage.load();
  const today = new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const rec of Object.values(data.files)) {
    total += rec.dailyTotal[today] || 0;
  }
  if (currentFile && sessionStart && !isIdle()) {
    total += Math.floor((Date.now() - sessionStart) / 1000);
  }
  total += pendingSeconds;
  return total;
}

function startHeartbeat(extensionPath: string): void {
  const scriptPath = path.join(extensionPath, 'heartbeat.ps1');
  if (!fs.existsSync(scriptPath)) { return; }
  heartbeatProc = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
  ], { detached: false, stdio: 'ignore' });
  heartbeatProc.on('error', () => {});
}

export function activate(context: vscode.ExtensionContext): void {
  startHeartbeat(context.extensionPath);

  const onFileChange = (editor: vscode.TextEditor | undefined) => {
    pauseCurrent();
    flushPending();
    currentFile = editor?.document.uri.fsPath || getWorkspaceFallback();
    if (currentFile && !isIdle()) { resumeCurrent(); }
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(onFileChange),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      // workspace opened/closed with no file — update fallback
      if (!vscode.window.activeTextEditor) { onFileChange(undefined); }
    }),
    vscode.window.onDidChangeWindowState(e => {
      if (e.focused && currentFile && !sessionStart && !isIdle()) {
        resumeCurrent();
      }
    })
  );

  flushTimer = setInterval(() => {
    if (isIdle()) {
      if (sessionStart) { pauseCurrent(); flushPending(); }
    } else {
      if (currentFile) {
        if (!sessionStart) { resumeCurrent(); }
        pauseCurrent();
        flushPending();
        resumeCurrent();
      }
    }
    fireTick();
  }, FLUSH_INTERVAL_MS);

  onFileChange(vscode.window.activeTextEditor);
}

export function deactivate(): void {
  pauseCurrent();
  flushPending();
  if (flushTimer) { clearInterval(flushTimer); }
  if (heartbeatProc) { heartbeatProc.kill(); }
}
