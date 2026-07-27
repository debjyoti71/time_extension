# ⏱️ Dev Timekeeper

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/debjyoti-ghosh/time-tracker.svg)](https://github.com/debjyoti-ghosh/time-tracker/issues)
[![Version](https://img.shields.io/badge/version-1.0.33-green.svg)](package.json)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20offline-brightgreen.svg)](#privacy--data-control)

Private, offline-first coding time tracker for VS Code. Records how long you work per file, project, day, and hour—no cloud, no accounts, and zero telemetry.

---

## 🚀 Highlights
- **100% Local & Offline**: All data lives locally in `~/.vscode-time-tracker/` (JSON format).
- **Accurate Active Time**: Pauses after 5 minutes of system idle; ignores sleep gaps; counts terminal/browser activity while actively interacting.
- **At-a-Glance Status Bar**: Displays real-time status (e.g., `Today: 4h 23m`) with one-click access to the full dashboard.
- **Rich Interactive Dashboard** (8 Sections): Live stats, lifetime insights, per-project charts, weekly stack, 30-day trends, 6-month bar chart, hour-of-day activity map, language bubble chart, and full sortable details table.
- **Hour-of-Day Insights**: Reveals percentage of each clock hour you code on average over the last 30 days.
- **Customizable Dashboard**: Toggle any dashboard section on/off and persist your display preferences.

---

## ⚡ How Tracking Works

| Situation                          | Counted?       |
|-----------------------------------|----------------|
| Typing/clicking in VS Code        | ✅ Yes         |
| Testing in browser or terminal    | ✅ Yes         |
| No input for 5+ minutes           | ❌ Paused       |
| Laptop asleep / VS Code suspended | ❌ Not counted |
| VS Code closed                    | ❌ No           |

**Data Model (Per File)**:
- `total`: Total active seconds.
- `dailyTotal[YYYY-MM-DD]`: Total seconds per calendar date.
- `dailyHours[YYYY-MM-DD][hour]`: Hourly active seconds (for peak productivity insights).

---

## 📦 Installation

1. Download the latest `.vsix` package from [Releases](https://github.com/debjyoti-ghosh/time-tracker/releases).  
2. In VS Code, open Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`).  
3. Click the `...` menu (top-right of Extensions panel) → **Install from VSIX...**  
4. Select the downloaded `.vsix` file.  
5. Restart VS Code to complete initialization.

---

## 📊 Using the Dashboard

- **Open Dashboard**: Click the status bar item or open Command Palette (`Ctrl+Shift+P`) and type `Time Tracker: Show Dashboard`.
- **Live Updates**: Metrics update automatically every 30 seconds with active working ticks.
- **Customize View**: Click the `⋮` settings menu in the top right to hide or reveal sections. Your choices are automatically saved to `~/.vscode-time-tracker/settings.json`.

---

## 📸 Snapshots (Multi-Repo Summaries)

Generate shareable markdown/JSON summary reports for single or multiple repositories:
1. Open Command Palette (`Ctrl+Shift+P`).
2. Search for **Time Tracker: Save Snapshot (7/30/Custom, Multi-Repo)**.
3. Snapshots are saved locally under `~/.vscode-time-tracker/snapshots/` as both structured `.json` and human-readable `.md` files.

---

## 🐞 Raising Issues & Feedback

Found a bug or have a feature idea? Contributions and community feedback are warmly welcomed!

### 📥 Submit an Issue
- 🐛 **[Report a Bug](https://github.com/debjyoti-ghosh/time-tracker/issues/new?assignees=&labels=bug&projects=&template=bug_report.md&title=%5BBug%5D+)**: Describe what happened, steps to reproduce, and expected behavior.
- 💡 **[Request a Feature](https://github.com/debjyoti-ghosh/time-tracker/issues/new?assignees=&labels=enhancement&projects=&template=feature_request.md&title=%5BFeature%5D+)**: Suggest new dashboard sections, tracking capabilities, or UX improvements.
- 💬 **[General Discussions / Questions](https://github.com/debjyoti-ghosh/time-tracker/issues)**: Ask questions or discuss ideas with the maintainer.

Before submitting an issue, please check existing [Open Issues](https://github.com/debjyoti-ghosh/time-tracker/issues) to avoid duplicates.

---

## 🔒 Privacy & Data Control

- **Zero Telemetry**: No tracking scripts, analytics, or external network requests.
- **Full Ownership**: All your data is stored locally in `~/.vscode-time-tracker/`.
- **Data Erasure**: To reset or wipe all stored history, simply delete the `~/.vscode-time-tracker/` directory or run the command `Time Tracker: Reset All Data`.

---

## 📚 Documentation

Detailed architectural and design guides are available in the [`docs/`](docs) folder:
- 📖 [Product Specification](docs/PRODUCT.md)
- 📐 [Design Document](docs/DESIGN.md)
- 🛠️ [Developer Guide](docs/DEVELOPER.md)

---

## 📄 License & Author

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

Developed by **Debjyoti Ghosh** — [https://debjyoti-ghosh.in/](https://debjyoti-ghosh.in/)
