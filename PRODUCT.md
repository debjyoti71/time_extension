# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software developers using VS Code who need accurate, privacy-respecting tracking of active coding time across files, projects, daily trends, and hourly work patterns.

## Product Purpose

Dev Timekeeper provides an offline-first, local-only time tracking solution inside VS Code. It automatically logs active coding sessions without requiring accounts, remote servers, or telemetry, and presents comprehensive analytics through an 8-section interactive dashboard.

## Positioning

Unlike cloud-connected time trackers (e.g. WakaTime, Toggl), Dev Timekeeper is completely private and local-first. All activity data resides in `~/.vscode-time-tracker/data.json` with zero network overhead, using native Win32 system idle detection to ensure idle time is never miscounted as work.

## Operating Context

Runs continuously inside the VS Code Extension Host. A lightweight PowerShell process (`heartbeat.ps1`) monitors system idle status every 10s, while the tracker flushes accumulated active seconds to disk every 30s. The user interacts via a bottom status bar item and an on-demand VS Code Webview panel (`dashboard.html` / `dashboard.js`).

## Capabilities and Constraints

- **Local Storage**: Stores all records in `~/.vscode-time-tracker/data.json`.
- **System Idle Detection**: Automatically pauses active timer after 5 minutes of system-wide inactivity (Windows Win32 input monitoring).
- **Webview Dashboard**: 8 visual sections (live stats, lifetime insights, project charts, weekly stack, 30-day trends, 6-month view, hour-of-day heatmap, language bubble map, sortable data table).
- **Section Visibility Control**: Toggleable dashboard sections with preferences saved to `~/.vscode-time-tracker/settings.json`.
- **Multi-Repo Snapshots**: Exports 7-day, 30-day, or custom multi-repo summaries as `.json` and `.md`.
- **Date Handling**: Uses UTC dates (`YYYY-MM-DD`) for consistency across session logs.
- **No External Dependencies**: Bundled local Chart.js 4.4.0 and chartjs-chart-treemap scripts; operates entirely offline.

## Brand Commitments

- **Name**: Dev Timekeeper
- **Author**: Debjyoti Ghosh (https://debjyoti-ghosh.in/)
- **Visual Aesthetic**: Sleek, dark-themed, data-rich interface aligned with native VS Code developer tooling.

## Evidence on Hand

- `README.md` (Feature highlights, installation, usage, data privacy guarantees)
- `DEVELOPER.md` (Architecture breakdown, data flow, module contracts, build commands)
- `media/icon.png` (Extension branding icon)
- `src/` & `media/` (Full TypeScript extension source and Webview UI implementation)

## Product Principles

1. **Absolute Privacy**: Zero telemetry, zero external network calls, zero account registration. Data never leaves the local machine.
2. **Passive Accuracy**: Automatically detect active typing and browser testing while discounting system idle, sleep, or suspension.
3. **High Information Density**: Present comprehensive insights (hourly productivity distribution, multi-project stacks, language breakdown) cleanly without overwhelming the user.
4. **Non-Intrusive Workflow**: Provide passive status bar indicators that stay out of the way until detailed dashboard inspection is needed.

## Accessibility & Inclusion

- Responsive typography and high-contrast color palettes suitable for dark editor environments.
- Scalable chart labels and readable data tables for dense information display.
