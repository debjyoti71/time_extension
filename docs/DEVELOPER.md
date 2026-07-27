# ⏱ Time Tracker — Developer Documentation

> Built by [Debjyoti Ghosh](https://debjyoti-ghosh.in/)

---

## Overview

Time Tracker is a VS Code extension that tracks coding time locally. It uses a PowerShell heartbeat process for system-wide idle detection, stores all data in a local JSON file, and renders a rich dashboard via a VS Code Webview using Chart.js.

---

## Project Structure

```
time-tracker/
├── src/
│   ├── extension.ts       # Entry point — activates all modules
│   ├── tracker.ts         # Core tracking logic + heartbeat process
│   ├── storage.ts         # Read/write ~/.vscode-time-tracker/data.json
│   ├── statusBar.ts       # Status bar item (bottom-right)
│   └── dashboard.ts       # Data aggregation + webview panel
├── media/
│   ├── dashboard.html     # Webview HTML template
│   ├── dashboard.css      # Dark theme styles
│   ├── dashboard.js       # Chart.js rendering + UI logic
│   ├── chart.min.js       # Chart.js 4.4.0 (bundled locally)
│   └── treemap.min.js     # chartjs-chart-treemap 3.1.0 (bundled locally)
├── heartbeat.ps1          # PowerShell system idle monitor (Windows)
├── migrate.py             # One-time migration from n3rds-inc.time format
├── cleanup.py             # Remove junk entries from data.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   VS Code Extension Host             │
│                                                      │
│  extension.ts                                        │
│       │                                              │
│       ├── tracker.ts ──── heartbeat.ps1 (child proc) │
│       │       │                                      │
│       │       └── storage.ts ── data.json            │
│       │                                              │
│       ├── statusBar.ts                               │
│       │                                              │
│       └── dashboard.ts ── settings.json              │
│               │                                      │
└───────────────┼─────────────────────────────────────┘
                │ Webview (iframe)
┌───────────────┼─────────────────────────────────────┐
│               │                                      │
│  dashboard.html + dashboard.js + Chart.js            │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### `extension.ts`
Entry point. Activates `tracker`, `statusBar`, and registers the `timetracker.showDashboard` command.

```ts
export function activate(context: vscode.ExtensionContext): void {
  tracker.activate(context);
  statusBar.activate(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('timetracker.showDashboard', () => dashboard.show(context))
  );
}
```

---

### `tracker.ts`
Core tracking logic. Responsible for:
- Spawning `heartbeat.ps1` as a child process on activation
- Reading `heartbeat.json` every 30s to check system idle state
- Maintaining `currentFile`, `sessionStart`, `pendingSeconds`
- Flushing accumulated seconds to `storage.addTime()` every 30s
- Exposing `getElapsedToday()` for the status bar
- Exposing `onTick(cb)` — fires after every flush (used by statusBar and dashboard)

**Key variables:**
```
currentFile     — last active file path (or __workspace__ fallback)
sessionStart    — timestamp when current session started
pendingSeconds  — accumulated seconds not yet written to disk
```

**Flush cycle (every 30s):**
```
if system idle → pauseCurrent() + flushPending()
else           → pauseCurrent() + flushPending() + resumeCurrent()
```

**Idle detection:**
Reads `~/.vscode-time-tracker/heartbeat.json` written by `heartbeat.ps1`. If `idleMs > 300000` (5 min), considered idle.

**Workspace fallback:**
If no file is open but a workspace folder exists, `currentFile` is set to `{workspaceRoot}/__workspace__` so terminal/browser time is still credited to the project.

---

### `storage.ts`
Simple read/write wrapper for `~/.vscode-time-tracker/data.json`.

**Data structure:**
```json
{
  "files": {
    "e:\\my_projects\\my_app\\src\\main.py": {
      "total": 3600,
      "dailyTotal": {
        "2026-03-25": 1800,
        "2026-03-24": 1800
      },
      "lastActive": 1742900000000
    }
  }
}
```

**Key function:**
```ts
addTime(filePath: string, seconds: number): void
// loads data.json → adds seconds to total + dailyTotal[today] → saves
```

All dates use `new Date().toISOString().slice(0, 10)` — **UTC dates**. This is consistent across reads and writes so there's no timezone mismatch.

---

### `statusBar.ts`
Creates a `vscode.StatusBarItem` in the bottom-right. Updates every 30s via `setInterval` and on every tracker flush via `onTick`. Calls `tracker.getElapsedToday()` which reads disk + adds live unsaved session.

---

### `dashboard.ts`
Two responsibilities:

**1. Data aggregation (`buildDashboardData`)**
Reads all file records from `data.json` and computes:
- `folderRows` — per-project totals (today/week/month/lifetime)
- `last7` / `last7stacked` / `last7projects` — 7-day data per project
- `last30` / `last30stacked` / `top6projects` — 30-day data
- `last6months` — monthly totals
- `hourBuckets` — percentage of each hour used on average across the last 30 days (`secondsInHour / (30 * 3600) * 100`)
- `weekTop5` — top 5 projects this week
- `langMap` — file count by language per project
- `dirTotals` — lifetime seconds per project

**Project folder detection (`getProjectFolder`):**
Looks for `my_projects`, `projects`, `repos`, `workspace` in the path and returns the next segment. Falls back to parent directory name.

**Junk filter (`isJunk`):**
Filters out zip artifacts, GUIDs, AppData paths, site-packages, and known junk folder names.

**2. Webview panel management**
- Creates a `vscode.WebviewPanel` on `show()`
- Reads `dashboard.html`, replaces `{{DATA}}`, `{{SETTINGS}}`, `{{CHART_URI}}`, `{{CSS_URI}}`, `{{JS_URI}}`, `{{TREEMAP_URI}}`
- Subscribes to `onTick` → sends `liveUpdate` postMessage every 30s
- Listens for `saveSettings` message from webview → writes to `settings.json`
- Unsubscribes tick listener on panel dispose

---

### `heartbeat.ps1`
Background PowerShell process spawned by `tracker.ts` on extension activation. Uses Win32 `GetLastInputInfo` to get system-wide last input time. Writes every 10s:

```json
{ "lastInputMs": 1742900000000, "idleMs": 4200 }
```

`idleMs` = milliseconds since last mouse/keyboard input anywhere on the system.

---

### `dashboard.html`
Webview HTML template. Placeholders replaced at render time:
- `{{CSS_URI}}` — webview URI for dashboard.css
- `{{CHART_URI}}` — webview URI for chart.min.js
- `{{TREEMAP_URI}}` — webview URI for treemap.min.js
- `{{JS_URI}}` — webview URI for dashboard.js
- `{{DATA}}` — JSON stringified dashboard data
- `{{SETTINGS}}` — JSON stringified settings (hidden sections)

Each dashboard section is wrapped in `<div data-section="sectionName">` for the toggle menu.

---

### `dashboard.js`
Runs inside the webview. Responsibilities:
- Renders all 7 Chart.js charts on load via `drawCharts()`
- Renders SVG force-directed bubble chart via `drawBubbles()`
- Updates cards + table on `liveUpdate` postMessage
- Updates chart data in-place via `chart.update('none')` (no animation)
- Manages 3-dot menu toggle with `__settings` from injected data
- Sends `saveSettings` postMessage when sections are toggled
- Uses `vscode.postMessage` for extension communication

**Chart instances** are stored in a `charts` registry object. `makeChart(id, config)` destroys existing instance before creating new one.

---

## Data Flow

```
User types in VS Code
        │
        ▼
tracker.ts marks activity (lastActivity = Date.now())
        │
        ▼ every 30s
flushTimer fires
        │
        ├── reads heartbeat.json → checks idleMs
        │
        ├── if active: pauseCurrent() → pendingSeconds += elapsed
        │                flushPending() → storage.addTime(file, secs)
        │                resumeCurrent() → sessionStart = now
        │
        └── fireTick() → statusBar.update() + dashboard.pushLiveData()
                                                      │
                                                      ▼
                                          postMessage('liveUpdate', data)
                                                      │
                                                      ▼
                                          dashboard.js updates cards + charts
```

---

## Dev Setup

```bash
# Install dependencies
npm install

# Compile TypeScript
npx tsc -p ./

# Watch mode (auto-recompile on save)
npx tsc -watch -p ./

# Run in Extension Development Host
# Open folder in VS Code → F5
# Then Ctrl+R in the Extension Host window to reload after changes

# Package VSIX
npx vsce package

# Install packaged VSIX
# Ctrl+Shift+X → ... → Install from VSIX
```

---

## Build & Release

```bash
# Bump version in package.json, then:
npx vsce package

# Remove old installed version
rmdir /s /q C:\Users\{user}\.vscode\extensions\local-dev.time-tracker-{old-version}

# Install new VSIX and fully restart VS Code
```

Always **fully restart VS Code** after installing — not just reload window. This ensures the old extension process is killed and the new one starts fresh.

---

## Known Limitations

- **UTC dates** — all daily totals use UTC date keys. Users in UTC+5:30 (IST) will see the date roll over at 5:30 AM local time, not midnight. This is consistent across all reads/writes so totals are always correct.
- **Hour-of-day chart** — uses `lastActive` timestamp per file as a proxy for when that file was worked on. Files with midnight `lastActive` (migrated data) are excluded. Not perfectly accurate but gives a reasonable pattern.
- **Windows only** for system-wide idle detection. macOS/Linux falls back to VS Code-only activity.
- **Single `lastActive` per file** — we don't store per-session timestamps, so the hour chart can only use the most recent active hour per file.

---

## Migration from n3rds-inc.time

```bash
python migrate.py
```

Reads `%APPDATA%\Code\User\globalStorage\n3rds-inc.time\codingTimeData.json`, extracts `repoTime` per day, creates synthetic `__migrated__.py` file entries per project, and merges into `data.json`. Skips dates already covered by our tracker.

---

## Author

**Debjyoti Ghosh**
[https://debjyoti-ghosh.in/](https://debjyoti-ghosh.in/)
