import * as vscode from 'vscode';
import { getElapsedToday, onTick, getCurrentProject } from './tracker';

let statusBarItem: vscode.StatusBarItem;
let updateTimer: NodeJS.Timeout | undefined;
let extensionContext: vscode.ExtensionContext | undefined;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function update(): void {
  const secs = getElapsedToday();
  const proj = getCurrentProject();
  const feedbackOpened = extensionContext ? extensionContext.globalState.get<boolean>('feedbackOpened', false) : false;
  const suffix = feedbackOpened ? '' : ' 💬';
  statusBarItem.text = `⏱ Today: ${formatTime(secs)}${suffix}`;
  statusBarItem.tooltip = proj
    ? `Tracking: ${proj} — ${formatTime(secs)} today. Click to open dashboard`
    : `Time Tracker — ${formatTime(secs)} today. Click to open dashboard`;
}

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.tooltip = 'Time Tracker — click to open dashboard';
  statusBarItem.command = 'timetracker.showDashboard';
  statusBarItem.show();
  update();

  updateTimer = setInterval(update, 30_000);
  const unsub = onTick(update);
  context.subscriptions.push(statusBarItem, { dispose: unsub });
}

export function refresh(): void {
  update();
}

export function deactivate(): void {
  if (updateTimer) { clearInterval(updateTimer); }
}
