import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as storage from './storage';
import { onTick, getCurrentProject, getCurrentFile } from './tracker';
import { getProjectFolder, isJunk } from './projectUtils';
import * as statusBar from './statusBar';
import { loadGroups, saveGroups as persistGroups, getFolderToGroupMap, suggestGroups, ProjectGroup, GroupsData } from './groups';

let extensionContext: vscode.ExtensionContext | undefined;

let panel: vscode.WebviewPanel | undefined;

function buildDashboardData() {
  const data = storage.load();
  const now = new Date();
  const feedbackOpened = extensionContext ? extensionContext.globalState.get<boolean>('feedbackOpened', false) : false;
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
  const dateHourMap: { [date: string]: { [hour: number]: number } } = {};
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
        if (!dateHourMap[date]) { dateHourMap[date] = {}; }
        for (const [hStr, sec] of Object.entries(hours)) {
          const h = Number(hStr);
          if (!Number.isInteger(h) || h < 0 || h > 23) { continue; }
          const val = typeof sec === 'number' && Number.isFinite(sec) ? sec : 0;
          dateHourMap[date][h] = (dateHourMap[date][h] || 0) + val;
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

  // Enforce strict physical boundary: at most 3,600 seconds can occur in any clock hour per day
  for (const hours of Object.values(dateHourMap)) {
    for (const [hStr, sec] of Object.entries(hours)) {
      const h = Number(hStr);
      const clamped = Math.min(3600, sec);
      hourTotals[h] += clamped;
    }
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
    if (filePath.includes('__workspace__')) { continue; }
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

  // --- Streak Calculation ---
  let currentStreak = 0;
  let bestStreak = 0;
  const sortedActiveDates = Array.from(activeDaysSet).sort();
  if (sortedActiveDates.length > 0) {
    let checkDate = new Date(now);
    let checkDateStr = checkDate.toISOString().slice(0, 10);
    if (!activeDaysSet.has(checkDateStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
      checkDateStr = checkDate.toISOString().slice(0, 10);
    }
    while (activeDaysSet.has(checkDateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
      checkDateStr = checkDate.toISOString().slice(0, 10);
    }
    let tempStreak = 0;
    let prevTimestamp: number | null = null;
    for (const dStr of sortedActiveDates) {
      const ts = new Date(dStr + 'T00:00:00Z').getTime();
      if (prevTimestamp === null) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((ts - prevTimestamp) / (24 * 3600 * 1000));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      prevTimestamp = ts;
      if (tempStreak > bestStreak) { bestStreak = tempStreak; }
    }
  }

  // --- Weekday Coding Rhythm (Mon - Sun) ---
  const weekdaySecs = [0, 0, 0, 0, 0, 0, 0]; // 0=Mon ... 6=Sun
  const weekdayActiveDays = [0, 0, 0, 0, 0, 0, 0];
  const weekdayDaySet = new Set<string>();
  for (const rec of Object.values(data.files)) {
    for (const [dateStr, secs] of Object.entries(rec.dailyTotal || {})) {
      if (secs <= 0) { continue; }
      const d = new Date(dateStr + 'T00:00:00Z');
      const jsDay = d.getUTCDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
      weekdaySecs[dayIdx] += secs;
      if (!weekdayDaySet.has(`${dateStr}_${dayIdx}`)) {
        weekdayDaySet.add(`${dateStr}_${dayIdx}`);
        weekdayActiveDays[dayIdx]++;
      }
    }
  }
  const weekdayHours = weekdaySecs.map((s, idx) => +(s / 3600).toFixed(1));
  const weekdayAverages = weekdaySecs.map((s, idx) => {
    const days = Math.max(1, weekdayActiveDays[idx]);
    return +(s / 3600 / days).toFixed(1);
  });

  // --- Project Groups Integration ---
  const groupsData = loadGroups();
  const folderToGroup = getFolderToGroupMap(groupsData.groups);

  const groupRowMap = new Map<string, any>();
  for (const g of groupsData.groups) {
    groupRowMap.set(g.id, {
      isGroup: true,
      id: g.id,
      name: g.name,
      color: g.color || '#6366f1',
      totalSecs: 0,
      todaySecs: 0,
      weekSecs: 0,
      monthSecs: 0,
      rolling30Secs: 0,
      last7Secs: 0,
      lastActive: 0,
      subProjects: [] as any[]
    });
  }

  const groupedFolderRows: any[] = [];
  for (const r of folderRows) {
    const grp = folderToGroup.get(r.name.toLowerCase());
    if (grp && groupRowMap.has(grp.id)) {
      const gRow = groupRowMap.get(grp.id);
      gRow.totalSecs += r.totalSecs;
      gRow.todaySecs += r.todaySecs;
      gRow.weekSecs += r.weekSecs;
      gRow.monthSecs += r.monthSecs;
      gRow.rolling30Secs += r.rolling30Secs;
      gRow.last7Secs += r.last7Secs;
      gRow.lastActive = Math.max(gRow.lastActive, r.lastActive);
      gRow.subProjects.push(r);
    } else {
      groupedFolderRows.push({
        isGroup: false,
        name: r.name,
        totalSecs: r.totalSecs,
        todaySecs: r.todaySecs,
        weekSecs: r.weekSecs,
        monthSecs: r.monthSecs,
        rolling30Secs: r.rolling30Secs,
        last7Secs: r.last7Secs,
        lastActive: r.lastActive,
        subProjects: []
      });
    }
  }

  for (const gRow of groupRowMap.values()) {
    if (gRow.totalSecs > 0 || gRow.subProjects.length > 0) {
      gRow.subProjects.sort((a: any, b: any) => b.totalSecs - a.totalSecs);
      groupedFolderRows.push(gRow);
    }
  }
  groupedFolderRows.sort((a, b) => b.totalSecs - a.totalSecs);

  // Grouped dirTotals
  const groupedDirTotals: { [k: string]: number } = {};
  for (const r of groupedFolderRows) {
    groupedDirTotals[r.name] = r.totalSecs;
  }

  // Grouped last 7 stacked
  const groupedLast7projects = groupedFolderRows
    .filter(r => (r.last7Secs || 0) > 0)
    .map(r => r.name);
  const groupedLast7stacked: { [proj: string]: { [date: string]: number } } = {};
  for (const proj of groupedLast7projects) { groupedLast7stacked[proj] = {}; }

  for (const [filePath, rec] of Object.entries(data.files)) {
    const rawProject = fileProjectMap.get(filePath);
    if (!rawProject) { continue; }
    const grp = folderToGroup.get(rawProject.toLowerCase());
    const effectiveProject = grp ? grp.name : rawProject;
    if (!groupedLast7stacked[effectiveProject]) { continue; }
    for (const date of last7dates) {
      const s = rec.dailyTotal[date] || 0;
      if (s) {
        groupedLast7stacked[effectiveProject][date] = (groupedLast7stacked[effectiveProject][date] || 0) + s;
      }
    }
  }

  // Grouped last 30 stacked
  const topGroupedByRolling30 = groupedFolderRows
    .map(r => ({ name: r.name, rolling: r.rolling30Secs || 0 }))
    .filter(r => r.rolling > 0)
    .sort((a, b) => b.rolling - a.rolling);
  const primaryGroupedProjects = topGroupedByRolling30.slice(0, 6).map(r => r.name);

  const groupedLast30stacked: { [proj: string]: { [date: string]: number } } = {};
  for (const proj of primaryGroupedProjects) { groupedLast30stacked[proj] = {}; }
  groupedLast30stacked['Others'] = {};

  for (const [filePath, rec] of Object.entries(data.files)) {
    const rawProject = fileProjectMap.get(filePath);
    if (!rawProject) { continue; }
    const grp = folderToGroup.get(rawProject.toLowerCase());
    const effectiveProject = grp ? grp.name : rawProject;
    const bucket = primaryGroupedProjects.includes(effectiveProject) ? effectiveProject : 'Others';
    for (const date of last30Keys) {
      const s = rec.dailyTotal[date] || 0;
      if (s) {
        groupedLast30stacked[bucket][date] = (groupedLast30stacked[bucket][date] || 0) + s;
      }
    }
  }
  if (!Object.keys(groupedLast30stacked['Others']).length) { delete groupedLast30stacked['Others']; }
  const groupedTop6projects = Object.keys(groupedLast30stacked);
  const groupedWeekTop5 = [...groupedFolderRows].sort((a, b) => b.weekSecs - a.weekSecs).slice(0, 5);

  const allProjectNames = folderRows.map(r => r.name);
  const suggestedGroups = suggestGroups(allProjectNames, groupsData.groups, groupsData.dismissedSuggestions);

  return {
    folderRows, dirTotals, langMap,
    groupedFolderRows, groupedDirTotals,
    groupedLast7stacked, groupedLast7projects,
    groupedLast30stacked, groupedTop6projects, groupedWeekTop5,
    groupsData, suggestedGroups, allProjectNames,
    last7, last7dates, last7stacked, last7projects,
    last30, last30stacked, top6projects,
    last6months, hourBuckets, weekTop5,
    todayTotal, weekTotal, monthTotal, lifetimeSecs,
    yesterdayTotal, prevWeekTotal, prevMonthTotal,
    activeDays, avgPerDay, totalProjects, mostActiveProj,
    streak: { current: currentStreak, best: bestStreak, totalActive: activeDays },
    weekdayAverages, weekdayHours,
    currentProject: getCurrentProject() ?? null,
    currentFile: (() => {
      const f = getCurrentFile() ?? vscode.window.activeTextEditor?.document.uri.fsPath;
      if (!f || f.endsWith('__workspace__')) { return null; }
      return path.basename(f);
    })(),
    showFeedbackBadge: !feedbackOpened
  };
}

export function show(context: vscode.ExtensionContext): void {
  extensionContext = context;
  if (panel) { panel.reveal(); return; }

  panel = vscode.window.createWebviewPanel(
    'timeTrackerDashboard', '⏱ Time Tracker', vscode.ViewColumn.One,
    { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))] }
  );

  let liveUpdateDebounce: NodeJS.Timeout | undefined;
  const schedulePushLiveData = () => {
    if (liveUpdateDebounce) { clearTimeout(liveUpdateDebounce); }
    liveUpdateDebounce = setTimeout(() => {
      pushLiveData();
    }, 400);
  };

  let fileWatcher: fs.FSWatcher | undefined;
  try {
    const dataDir = path.dirname(storage.DATA_FILE);
    if (fs.existsSync(dataDir)) {
      fileWatcher = fs.watch(dataDir, (eventType, filename) => {
        if (filename === 'data.json') {
          schedulePushLiveData();
        }
      });
    }
  } catch {}

  const unsubTick = onTick(() => pushLiveData());
  panel.onDidDispose(() => {
    unsubTick();
    if (fileWatcher) { fileWatcher.close(); }
    if (liveUpdateDebounce) { clearTimeout(liveUpdateDebounce); }
    panel = undefined;
  });

  // listen for messages from webview
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
    if (msg.command === 'openFeedback') {
      vscode.env.openExternal(vscode.Uri.parse('https://docs.google.com/forms/d/e/1FAIpQLScgCyUCmDnw5eu6uGiBiXaoW30mgd0kb6YDs_dcGdEvlWoPkQ/viewform?usp=dialog'));
      if (extensionContext) {
        extensionContext.globalState.update('feedbackOpened', true);
      }
      statusBar.refresh();
      pushLiveData();
      return;
    }
    if (msg.command === 'saveGroups') {
      persistGroups(msg.groupsData);
      pushLiveData();
      return;
    }
    if (msg.command === 'dismissSuggestion') {
      const gd = loadGroups();
      if (!gd.dismissedSuggestions) { gd.dismissedSuggestions = []; }
      if (!gd.dismissedSuggestions.includes(msg.suggestionId)) {
        gd.dismissedSuggestions.push(msg.suggestionId);
        persistGroups(gd);
        pushLiveData();
      }
      return;
    }
    if (msg.command === 'applySuggestion') {
      const gd = loadGroups();
      const newGroup: ProjectGroup = {
        id: 'grp_' + Date.now(),
        name: msg.name,
        color: msg.color || '#6366f1',
        projects: msg.projects
      };
      gd.groups.push(newGroup);
      if (!gd.dismissedSuggestions) { gd.dismissedSuggestions = []; }
      if (msg.suggestionId && !gd.dismissedSuggestions.includes(msg.suggestionId)) {
        gd.dismissedSuggestions.push(msg.suggestionId);
      }
      persistGroups(gd);
      pushLiveData();
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
