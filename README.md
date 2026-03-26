# ⏱ Time Tracker

**Track your coding time locally — like WakaTime, but 100% private, no subscription, no internet.**

> Built by [Debjyoti Ghosh](https://debjyoti-ghosh.in/)

---

## What is this?

Time Tracker automatically records how long you spend coding in VS Code — per file, per project, per day. Everything stays on your machine. No cloud, no accounts, no telemetry.

It even tracks time when you're **testing in the browser**, running commands in the **terminal**, or working in **any other app** — as long as your mouse or keyboard is active.

---

## Features

### Status Bar
Always visible in the bottom-right corner — shows today's total coding time at a glance.

```
⏱ Today: 4h 23m
```

Click it to open the full dashboard.

---

### Dashboard — 8 Sections

**Live Stats**
Today / This Week / This Month / Lifetime totals — updates every 30 seconds automatically.

**Lifetime Insights**
Active coding days, average per day, total projects tracked, your most worked-on project.

**Projects Overview**
- Bar chart — top 10 projects by lifetime hours
- Donut chart — share of time per project

**This Week**
- Stacked area chart — daily coding time broken down by project (last 7 days)
- Horizontal bar — top 5 projects this week

**Trends**
- Stacked bar — last 30 days activity by project
- Bar chart — last 6 months overview (current month highlighted)

**Coding Patterns**
Hour-of-day bar chart — see exactly when during the day you code most.

**Language Breakdown**
Force-directed bubble chart — languages used across your top projects, sized by file count.

**All Projects**
Full sortable, filterable table with Today / This Week / This Month / Lifetime / Last Active per project.

---

### Smart Idle Detection
If you haven't touched your mouse or keyboard for 5 minutes, the clock pauses automatically. It resumes the moment you're back.

### Toggle Sections
Click the **⋯** button in the top-right of the dashboard to show/hide any section. Your preferences are saved and remembered.

---

## How Time is Counted

| Situation | Counted? |
|---|---|
| Typing / clicking in VS Code | ✅ Yes |
| Testing in browser | ✅ Yes |
| Running commands in terminal | ✅ Yes |
| Switching between files | ✅ Yes |
| No input for 5+ minutes | ❌ Paused |
| VS Code closed | ❌ No |

---

## Installation

1. Download the latest `.vsix` from [Releases](https://github.com/debjyoti-ghosh/time-tracker/releases)
2. Open VS Code → `Ctrl+Shift+X` → click `...` → **Install from VSIX**
3. Select the downloaded file
4. **Fully restart VS Code**

---

## Privacy

- All data stored locally on your machine
- No internet connection ever used
- No analytics, no telemetry, no accounts
- Delete `~/.vscode-time-tracker/` to remove all data

---

## Author

**Debjyoti Ghosh**
[https://debjyoti-ghosh.in/](https://debjyoti-ghosh.in/)
