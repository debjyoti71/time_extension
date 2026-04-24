import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as storage from './storage';
import { onTick, getCurrentProject, getCurrentFile } from './tracker';
import { getProjectFolder, isJunk } from './projectUtils';

let panel: vscode.WebviewPanel | undefined;

function buildDashboardData() {
  const data = storage.load();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const isoDates = (dates: Date[]): string[] => dates.map(d => d.toISOString().slice(0, 10));
  const dayOfWeek = now.getDay(); // Sunday = 0
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek); // move to Sunday
  const thisWeekDates = isoDates(Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); return d;
  }));
  const prevWeekStart = new Date(startOfWeek); prevWeekStart.setDate(startOfWeek.getDate() - 7);
  const prevWeekDates = isoDates(Array.from({ length: 7 }, (_, i) => {
    const d = new Date(prevWeekStart); d.setDate(prevWeekStart.getDate() + i); return d;
  }));
  const prevWeekDateSet = new Set(prevWeekDates);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const thisMonthDates = isoDates(Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(now); d.setDate(i + 1); return d;
  }));
  const prevMonthDate = new Date(now);
  prevMonthDate.setDate(1);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthDays = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate();
  const prevMonthDates = isoDates(Array.from({ length: prevMonthDays }, (_, i) => {
    const d = new Date(prevMonthDate); d.setDate(i + 1); return d;
  }));
  const monthDateSet = new Set(thisMonthDates);
  const prevMonthDateSet = new Set(prevMonthDates);

  const projectMap: {
    [project: string]: {
      totalSecs: number; todaySecs: number; weekSecs: number;
      monthSecs: number; rolling30Secs: number; last7Secs: number; lastActive: number;
    }
  } = {};

  // last 7 days
  const last7: { [date: string]: number } = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    last7[d.toISOString().slice(0, 10)] = 0;
  }
  const last7dates = Object.keys(last7);

  // last 30 days
  const last30: { [date: string]: number } = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    last30[d.toISOString().slice(0, 10)] = 0;
  }
  const last30Keys = new Set(Object.keys(last30));
  const last30DaysCount = last30Keys.size || 1;

  // last 6 months
  const last6months: { [ym: string]: number } = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6months[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
  }

  // hour of day buckets — computed after main loop (needs activeDaysSet)

  const activeDaysSet = new Set<string>();
  let lifetimeSecs = 0;
  let mostActiveProjSecs = 0;
  let mostActiveProj = '—';
  const hourTotals: number[] = new Array(24).fill(0); // seconds per hour bucket (last 30 days)
  let yesterdayTotal = 0;
  let prevWeekTotal = 0;
  let prevMonthTotal = 0;

  // pre-compute project per file once — avoids repeated getProjectFolder calls in later loops
  const fileProjectMap = new Map<string, string>();
  for (const filePath of Object.keys(data.files)) {
    const project = getProjectFolder(filePath);
    if (!isJunk(project, filePath)) { fileProjectMap.set(filePath, project); }
  }

  for (const [filePath, rec] of Object.entries(data.files)) {
    const project = fileProjectMap.get(filePath);
    if (!project) { continue; }

    const todaySecs = rec.dailyTotal[today] || 0;
    yesterdayTotal += rec.dailyTotal[yesterdayKey] || 0;

    let weekSecs = 0;
    for (const date of thisWeekDates) { weekSecs += rec.dailyTotal[date] || 0; }
    for (const date of prevWeekDateSet) { prevWeekTotal += rec.dailyTotal[date] || 0; }

    let monthSecs = 0;
    let last30WindowSecs = 0;
    for (const date of monthDateSet) { monthSecs += rec.dailyTotal[date] || 0; }
    for (const date of prevMonthDateSet) { prevMonthTotal += rec.dailyTotal[date] || 0; }
    for (const date of last30Keys) {
      const s = rec.dailyTotal[date] || 0;
      last30WindowSecs += s;
      last30[date] += s;
    }
    let last7SecsForProject = 0;
    for (const date of last7dates) {
      const s = rec.dailyTotal[date] || 0;
      last7[date] += s;
      last7SecsForProject += s;
    }

    for (const [date, secs] of Object.entries(rec.dailyTotal)) {
      const ym = date.slice(0, 7);
      if (ym in last6months) { last6months[ym] += secs; }
      if (secs > 0) { activeDaysSet.add(date); }
    }

    const dh = (rec as any).dailyHours as { [date: string]: { [hour: string]: number } } | undefined;
    if (dh) {
      for (const [date, hours] of Object.entries(dh)) {
        if (!last30Keys.has(date)) { continue; }
        for (const [hStr, sec] of Object.entries(hours)) {
          const h = Number(hStr);
          if (!Number.isInteger(h) || h < 0 || h > 23) { continue; }
          const val = typeof sec === 'number' && Number.isFinite(sec) ? sec : 0;
          hourTotals[h] += val;
        }
      }
    }

    lifetimeSecs += rec.total;

    if (!projectMap[project]) {
      projectMap[project] = { totalSecs: 0, todaySecs: 0, weekSecs: 0, monthSecs: 0, rolling30Secs: 0, last7Secs: 0, lastActive: 0 };
    }
    projectMap[project].totalSecs += rec.total;
    projectMap[project].todaySecs += todaySecs;
    projectMap[project].weekSecs  += weekSecs;
    projectMap[project].monthSecs += monthSecs;
    projectMap[project].rolling30Secs += last30WindowSecs;
    projectMap[project].last7Secs += last7SecsForProject;
    projectMap[project].lastActive = Math.max(projectMap[project].lastActive, rec.lastActive);
  }

  // hour of day — percent of that hour used on average (last 30 days)
  const hourBuckets: number[] = hourTotals.map(s =>
    Math.min(100, +((s / (last30DaysCount * 3600)) * 100).toFixed(1))
  );

  const folderRows = Object.entries(projectMap)
    .map(([name, v]) => ({ name, ...v }))
    .filter(r => r.totalSecs > 0)
    .sort((a, b) => b.totalSecs - a.totalSecs);

  for (const r of folderRows) {
    if (r.totalSecs > mostActiveProjSecs) { mostActiveProjSecs = r.totalSecs; mostActiveProj = r.name; }
  }

  const dirTotals: { [k: string]: number } = {};
  for (const [name, v] of Object.entries(projectMap)) { dirTotals[name] = v.totalSecs; }

  // last 7 stacked — projects that have weekSecs > 0
  const last7projects = folderRows
    .filter(r => (projectMap[r.name]?.last7Secs || 0) > 0)
    .map(r => r.name);
  const last7stacked: { [project: string]: { [date: string]: number } } = {};
  for (const proj of last7projects) { last7stacked[proj] = {}; }
  for (const [filePath, rec] of Object.entries(data.files)) {
    const project = fileProjectMap.get(filePath);
    if (!project || !last7stacked[project]) { continue; }
    for (const date of last7dates) {
      const s = rec.dailyTotal[date] || 0;
      if (s) { last7stacked[project][date] = (last7stacked[project][date] || 0) + s; }
    }
  }

  // top 5 this week
  const weekTop5 = [...folderRows].sort((a, b) => b.weekSecs - a.weekSecs).slice(0, 5);

  // last 30 stacked — rank by activity in the last 30 days (not lifetime) and roll the rest into “Others”
  const topProjectsByRolling30 = folderRows
    .map(r => ({ name: r.name, rolling: projectMap[r.name]?.rolling30Secs || 0 }))
    .filter(r => r.rolling > 0)
    .sort((a, b) => b.rolling - a.rolling);
  const primaryProjects = topProjectsByRolling30.slice(0, 6).map(r => r.name);

  const last30stacked: { [project: string]: { [date: string]: number } } = {};
  for (const proj of primaryProjects) { last30stacked[proj] = {}; }
  last30stacked['Others'] = {};

  for (const [filePath, rec] of Object.entries(data.files)) {
    const project = fileProjectMap.get(filePath);
    if (!project) { continue; }

    const bucket = primaryProjects.includes(project) ? project : 'Others';
    for (const date of last30Keys) {
      const s = rec.dailyTotal[date] || 0;
      if (s) { last30stacked[bucket][date] = (last30stacked[bucket][date] || 0) + s; }
    }
  }

  // Drop “Others” if it received no time to avoid a blank legend entry.
  if (!Object.keys(last30stacked['Others']).length) { delete last30stacked['Others']; }
  const top6projects = Object.keys(last30stacked);

  // language breakdown per project — file count by extension
  const langMap: { [project: string]: { [lang: string]: number } } = {};
  for (const [filePath, project] of fileProjectMap) {
    const ext = filePath.split('.').pop()?.toLowerCase() || 'other';
    const lang = ({'ts':'TypeScript','tsx':'TypeScript','js':'JavaScript','jsx':'JavaScript',
      'py':'Python','html':'HTML','css':'CSS','scss':'CSS','json':'JSON',
      'md':'Markdown','java':'Java','cpp':'C++','c':'C','cs':'C#','go':'Go',
      'rs':'Rust','rb':'Ruby','php':'PHP','sh':'Shell','sql':'SQL'})[ext] || ext.toUpperCase();
    if (!langMap[project]) { langMap[project] = {}; }
    langMap[project][lang] = (langMap[project][lang] || 0) + 1;
  }

  const todayTotal    = folderRows.reduce((s, r) => s + r.todaySecs, 0);
  const weekTotal     = folderRows.reduce((s, r) => s + r.weekSecs,  0);
  const monthTotal    = folderRows.reduce((s, r) => s + r.monthSecs, 0);
  const activeDays    = activeDaysSet.size;
  const avgPerDay     = activeDays > 0 ? Math.round(lifetimeSecs / activeDays) : 0;
  const totalProjects = folderRows.length;

  return {
    folderRows, dirTotals, langMap,
    last7, last7dates, last7stacked, last7projects,
    last30, last30stacked, top6projects,
    last6months, hourBuckets, weekTop5,
    todayTotal, weekTotal, monthTotal, lifetimeSecs,
    yesterdayTotal, prevWeekTotal, prevMonthTotal,
    activeDays, avgPerDay, totalProjects, mostActiveProj,
    currentProject: getCurrentProject() ?? null,
    currentFile: (() => {
      const f = getCurrentFile() ?? vscode.window.activeTextEditor?.document.uri.fsPath;
      if (!f || f.endsWith('__workspace__')) { return null; }
      return path.basename(f);
    })()
  };
}

export function show(context: vscode.ExtensionContext): void {
  if (panel) { panel.reveal(); return; }

  panel = vscode.window.createWebviewPanel(
    'timeTrackerDashboard', '⏱ Time Tracker', vscode.ViewColumn.One,
    { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))] }
  );

  const unsubTick = onTick(() => pushLiveData());
  panel.onDidDispose(() => { unsubTick(); panel = undefined; });

  // listen for settings save from webview
  panel.webview.onDidReceiveMessage(msg => {
    if (msg.command === 'saveSettings') {
      const settingsPath = require('path').join(require('os').homedir(), '.vscode-time-tracker', 'settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(msg.settings), 'utf8');
      return;
    }
    if (msg.command === 'shareCard') {
      vscode.commands.executeCommand('timetracker.shareCard');
      return;
    }
  });

  refreshPanel(context);
}

function pushLiveData(): void {
  if (!panel) { return; }
  panel.webview.postMessage({ command: 'liveUpdate', data: buildDashboardData() });
}

function refreshPanel(context: vscode.ExtensionContext): void {
  if (!panel) { return; }
  const dashData = buildDashboardData();
  const htmlPath = path.join(context.extensionPath, 'media', 'dashboard.html');
  const chartUri   = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'chart.min.js')));
  const treemapUri  = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'treemap.min.js')));
  const cssUri      = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'dashboard.css')));
  const jsUri       = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'media', 'dashboard.js')));

  // load persisted settings — strip devBar so it never starts visible
  const settingsPath = path.join(require('os').homedir(), '.vscode-time-tracker', 'settings.json');
  let settings: { hiddenSections?: { [k: string]: boolean } } = {};
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch { }
  if (settings.hiddenSections) { delete settings.hiddenSections['devBar']; }

  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html
    .replace('{{CHART_URI}}',   chartUri.toString())
    .replace('{{TREEMAP_URI}}', treemapUri.toString())
    .replace('{{CSS_URI}}',     cssUri.toString())
    .replace('{{JS_URI}}',      jsUri.toString())
    .replace('{{SETTINGS}}',    JSON.stringify(settings))
    .replace('{{DATA}}',        JSON.stringify(dashData));
  panel.webview.html = html;
}
