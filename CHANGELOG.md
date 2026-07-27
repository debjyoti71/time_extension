# Changelog

All notable changes to **Dev Timekeeper** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
