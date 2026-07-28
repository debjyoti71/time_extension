# Changelog

All notable changes to **Dev Timekeeper** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.35] - 2026-07-28

### Changed
- **Fluid Container-Query Dashboard Layout**: Implemented CSS Container Queries (`@container dashboard`) so stat cards, chart rows, pie chart legends, and tabular data dynamically reflow when VS Code sidebars or split editor windows are resized.

### Fixed
- **Narrow Viewport & Mobile Overflow**: Resolved fixed 4-column card grid and side-by-side chart squishing by introducing responsive 2-column/1-column breakpoints and flexible flex wrapping.
- **SVG Language Map Resizing**: Added debounced window resize handler in `dashboard.js` to automatically recalculate SVG language bubble map bounds on window or webview resize.
- **Touch Target & Accessibility Hardening**: Increased hit targets to 44px minimum for touch pointers and added full WCAG AA contrast & `prefers-reduced-motion` animation compliance.

---

## [1.0.34] - 2026-07-27

### Fixed
- **Sleep & Minimization Time Bug**: Resolved issue where minimizing VS Code or putting laptop to sleep could continuously accumulate time due to unresolved PowerShell script path and unhandled window state.
- **PowerShell Heartbeat Resolution**: Fixed helper script execution path (`scripts/heartbeat.ps1`) to restore OS-level input idle detection.

### Added
- **20-Minute VS Code Inactivity Limit**: Implemented interaction monitoring for keystrokes, editor edits, tab switches, and file updates. Allows up to 20 minutes of external browser testing grace period before automatically pausing tracking.

---

## [1.0.33] - 2026-07-27

### Added
- **Automated GitHub Release Pipeline**: Added GitHub Actions workflow for automatic `.vsix` packaging and release generation upon version bump.
- **Enhanced Documentation Hub**: Restructured documentation into `docs/` (`docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/DEVELOPER.md`) and added responsive Mermaid architecture diagrams.
- **Marketplace Metadata**: Configured search keywords, gallery banner theme, categories, homepage, and issue tracking links.

### Changed
- **Packaging Rules**: Refined `.vscodeignore` to exclude local agent configs and development scripts while preserving webview assets.
- **Git Tracking Cleanup**: Untracked local workbench files and build artifacts from Git while retaining local copies safely.

---

## [1.0.0] - 2026-03-01

### Added
- Initial release of **Dev Timekeeper**.
- **Active Idle Detection**: Background PowerShell heartbeat monitoring for OS-level input idle detection (5-minute threshold).
- **Sleep & Suspension Rejection**: Automatic calculation and rejection of laptop sleep gaps.
- **Interactive Webview Dashboard**: 8 visual analytics sections (KPI overview, 24-hour heatmap, 30-day trends, weekly stack, quarterly comparison, language breakdown, sortable table).
- **Visual Share Card Generator**: Exportable summary graphics with base64 PNG export and OS file manager integration.
- **100% Offline Storage**: Zero telemetry, local JSON storage under `~/.vscode-time-tracker/`.
