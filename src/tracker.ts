import * as vscode from 'vscode';
import * as storage from './storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';

const IDLE_TIMEOUT_MS            = 5 * 60 * 1000;      // 5 minutes system-wide idle threshold
const VSCODE_INACTIVITY_LIMIT_MS = 20 * 60 * 1000;     // 20 minutes VS Code inactivity limit
const FLUSH_INTERVAL_MS          = 30 * 1000;          // 30 seconds flush tick

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
let currentProject: string | undefined;
let sessionStart: number | undefined;
let flushTimer: NodeJS.Timeout | undefined;
let heartbeatProc: ChildProcess | undefined;
let pendingSeconds: number = 0;
let lastTick: number = Date.now();
let lastVSCodeActivityTime: number = Date.now();

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

function isVSCodeInactive(): boolean {
  return (Date.now() - lastVSCodeActivityTime) > VSCODE_INACTIVITY_LIMIT_MS;
}

function recordVSCodeActivity(): void {
  lastVSCodeActivityTime = Date.now();
  if (currentFile && !sessionStart && !isIdle() && !isVSCodeInactive()) {
    resumeCurrent();
  }
}

function getWorkspaceFallback(): string | undefined {
  const ws = vscode.workspace.workspaceFolders;
  if (ws && ws.length > 0) { return path.join(ws[0].uri.fsPath, '__workspace__'); }
  const pwd = process.env.PWD || process.cwd();
  return pwd ? path.join(pwd, '__workspace__') : undefined;
}

function pauseCurrent(): void {
  if (currentFile && sessionStart) {
    pendingSeconds += Math.floor((Date.now() - sessionStart) / 1000);
  }
  sessionStart = undefined;
}

function flushPending(): void {
  if (currentFile && pendingSeconds > 0) {
    storage.addTime(currentFile, pendingSeconds, currentProject);
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
  if (currentFile && sessionStart && !isIdle() && !isVSCodeInactive()) {
    total += Math.floor((Date.now() - sessionStart) / 1000);
  }
  total += pendingSeconds;
  return total;
}

function startHeartbeat(extensionPath: string): void {
  let scriptPath = path.join(extensionPath, 'scripts', 'heartbeat.ps1');
  if (!fs.existsSync(scriptPath)) {
    scriptPath = path.join(extensionPath, 'heartbeat.ps1');
  }
  if (!fs.existsSync(scriptPath)) { return; }

  heartbeatProc = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
  ], { detached: false, stdio: 'ignore' });
  heartbeatProc.on('error', () => {});
}

export function activate(context: vscode.ExtensionContext): void {
  startHeartbeat(context.extensionPath);
  recordVSCodeActivity();

  const onFileChange = (editor: vscode.TextEditor | undefined) => {
    pauseCurrent();
    flushPending();
    currentFile = editor?.document.uri.fsPath || getWorkspaceFallback();
    if (currentFile) {
      const uri = editor?.document.uri ?? (currentFile ? vscode.Uri.file(currentFile) : undefined);
      const wsFolder = uri ? vscode.workspace.getWorkspaceFolder(uri) : undefined;
      currentProject = wsFolder?.name ?? vscode.workspace.workspaceFolders?.[0]?.name;
    }
    recordVSCodeActivity();
    if (currentFile && !isIdle() && !isVSCodeInactive()) { resumeCurrent(); }
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(onFileChange),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (!vscode.window.activeTextEditor) { onFileChange(undefined); }
    }),
    vscode.window.onDidChangeWindowState(e => {
      if (e.focused) {
        recordVSCodeActivity();
        if (currentFile && !sessionStart && !isIdle() && !isVSCodeInactive()) {
          resumeCurrent();
        }
      } else {
        // When VS Code is minimized or loses focus, pause continuous session accumulation to avoid sleep counting bugs
        pauseCurrent();
        flushPending();
      }
    }),
    // VS Code interaction & agent edit listeners
    vscode.workspace.onDidChangeTextDocument(() => recordVSCodeActivity()),
    vscode.window.onDidChangeTextEditorSelection(() => recordVSCodeActivity()),
    vscode.window.onDidChangeTextEditorVisibleRanges(() => recordVSCodeActivity()),
    vscode.workspace.onDidSaveTextDocument(() => recordVSCodeActivity()),
    vscode.workspace.onDidCreateFiles(() => recordVSCodeActivity()),
    vscode.workspace.onDidDeleteFiles(() => recordVSCodeActivity()),
    vscode.workspace.onDidRenameFiles(() => recordVSCodeActivity())
  );

  flushTimer = setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    lastTick = now;

    // Drop machine sleep gaps
    const slept = gap > (FLUSH_INTERVAL_MS + IDLE_TIMEOUT_MS);
    if (slept) {
      pauseCurrent();
      flushPending();
      if (!isIdle() && !isVSCodeInactive() && vscode.window.state.focused && currentFile) {
        resumeCurrent();
      }
      fireTick();
      return;
    }

    if (isIdle() || isVSCodeInactive()) {
      if (sessionStart) {
        pauseCurrent();
        flushPending();
      }
    } else {
      if (currentFile) {
        if (vscode.window.state.focused || (Date.now() - lastVSCodeActivityTime <= VSCODE_INACTIVITY_LIMIT_MS)) {
          if (!sessionStart) { resumeCurrent(); }
          pauseCurrent();
          flushPending();
          resumeCurrent();
        } else {
          if (sessionStart) { pauseCurrent(); flushPending(); }
        }
      }
    }
    fireTick();
  }, FLUSH_INTERVAL_MS);

  onFileChange(vscode.window.activeTextEditor);
}

export function getCurrentProject(): string | undefined { return currentProject; }
export function getCurrentFile(): string | undefined { return currentFile; }

export function deactivate(): void {
  pauseCurrent();
  flushPending();
  if (flushTimer) { clearInterval(flushTimer); }
  if (heartbeatProc) { heartbeatProc.kill(); }
}
