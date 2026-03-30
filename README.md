# ⏱️ Dev Timekeeper

Private, offline-first coding time tracker for VS Code. Records how long you work per file, project, day, and hour—no cloud, no accounts.

---

## Highlights
- Local only: data lives in `~/.vscode-time-tracker/` (JSON). Zero telemetry.
- Accurate active time: pauses after 5 minutes of system idle; ignores sleep gaps; counts terminal/browser activity while you’re interacting.
- At-a-glance status bar: “Today: 4h 23m” with one-click dashboard.
- Rich dashboard (8 sections): live stats, lifetime insights, per-project charts, weekly stack, 30-day trends, 6-month bar, hour-of-day pattern, language bubble map, full sortable table.
- Hour-of-day insight: shows % of each clock hour you code on average over the last 30 days.
- Flexible visibility: toggle any dashboard section and persist your preferences.

---

## How tracking works

| Situation                          | Counted? |
|-----------------------------------|----------|
| Typing/clicking in VS Code        | ✅ Yes   |
| Testing in browser or terminal    | ✅ Yes   |
| No input for 5+ minutes           | ❌ Paused |
| Laptop asleep / VS Code suspended | ❌ Not counted |
| VS Code closed                    | ❌ No     |

Data model (per file):
- `total` seconds
- `dailyTotal[YYYY-MM-DD]` seconds
- `dailyHours[YYYY-MM-DD][hour]` seconds (used for hour-of-day %)

---

## Installation
1) Download the latest `.vsix` from Releases.  
2) VS Code → `Ctrl+Shift+X` → `...` → **Install from VSIX** → pick the file.  
3) Restart VS Code once after install.

---

## Using the dashboard
- Click the status bar item to open.
- Sections update every 30s; live tick while you work.
- Use the ⋮ menu to hide/show sections; choices are saved in `~/.vscode-time-tracker/settings.json`.

---

## Privacy & data control
- Everything is local. Delete the folder `~/.vscode-time-tracker/` to remove all data.
- No network calls, no telemetry, no accounts.

---

## Author
**Debjyoti Ghosh** — https://debjyoti-ghosh.in/
