# Changelog

All notable changes to **Dev Timekeeper** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.38] - 2026-09-06

### Added
- **Project Groups & Multi-Repo Unification**: Group multi-repo codebases, microservices, and versioned iterations (e.g., `frontend`, `backend`, `v2`, `v3`) into single tracked projects.
- **Grouped Dashboard Charts**: Lifetime bar charts, share pie distributions, 7-day stacked activity, 30-day trends, and weekly top 5 metrics now seamlessly aggregate grouped projects.
- **Accordion Project Details Table**: Added a segmented view toggle (`[ Grouped ] [ Individual ]`). Group rows expand/collapse with percentage progress bars showing each sub-repo's contribution to the total group time.
- **Smart Group Suggestions**: Automatic stem-detection heuristic scans folder names to identify related project components and presents one-click grouping suggestions.
- **Restructured Manage Groups Modal**: Redesigned modal with Lucide vector SVG icons, segmented navigation tabs (`Active Groups` and `Create Group`), curated glowing color swatches, card-based folder selector with search, and select-all/clear quick actions.
- **Delete Confirmation Modal**: Added safe confirmation modal preventing accidental deletions while preserving raw tracking data on individual folders.
- **Release Announcement Banner**: Docked top announcement bar with `!` info badge, responsive spotlight scroll, and persistent glowing spotlight tour.
- **Share Card Rollup**: Project grouping support integrated into the Share Card generator.

---

## [1.0.37] - 2026-08-28

### Added
- **Share Card Customizations**: Added support for custom username handles and developer avatar selections directly from the sidebar.
- **Custom Time Ranges**: Added a "Custom Range" picker under the Time Range selector to define flexible Start and End dates for share card aggregation.
- **Preset Color Accents**: Added preset theme colors (Purple, Cyan, Orange, Green, Blue, Rose) to colorize the card builder layout elements dynamically.

### Changed
- **Rounded Milestone Clubs**: Milestone labels are now rounded down to clean round intervals (100h, 50h, 10h clubs) instead of exact raw hour values.
- **Simplified Card Builder Layout**: Streamlined the layout builder, consolidated the default dark glass design, and removed aspect ratio constraints.
- **Overflow containment**: Disabled canvas scrolling inside the preview pane, ensuring cards fit on one screen page without scrollbars.

---

## [1.0.36] - 2026-08-26

### Changed
- **Polished Stacked Bar Charts**: Redesigned dashboard stacked bar charts (weekly activity and 30-day trends) with rounded corners (`borderRadius: 2`), customized point style circles for legend items, and optimized spacing (`barPercentage`/`categoryPercentage`).
- **Adaptive Chart Scaling**: Removed hardcoded aspect ratio constraint on the 30-day trend chart for adaptive scaling across editor heights.
- **Axis Layout Improvements**: Enforced `beginAtZero: true` on chart y-axes to ensure proper zero baseline starting point, and scaled down font sizes for a cleaner look.

---

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
