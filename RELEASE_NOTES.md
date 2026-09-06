# ⏱️ Dev Timekeeper v1.0.38

[![Version](https://img.shields.io/badge/version-1.0.38-green.svg)](https://github.com/debjyoti71/time_extension/releases/tag/v1.0.38)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/debjyoti71/time_extension/blob/main/LICENSE)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20offline-brightgreen.svg)](#)
[![Open VSX](https://img.shields.io/open-vsx/v/DebjyotiGhosh/dev-timekeeper.svg?color=blue)](https://open-vsx.org/extension/DebjyotiGhosh/dev-timekeeper)

> **Private, offline-first developer productivity extension for VS Code & VSCodium.**  
> Automatically records active coding time per file, folder, workspace, day, and hour with zero cloud dependencies and zero telemetry.

---

### 📦 Release Highlights & Changelog (v1.0.38)

#### 🚀 Major Feature: Project Groups & Multi-Repo Aggregation
- **Unified Project Tracking**: Combine multiple repos, microservices, and versioned iterations (e.g. `frontend`, `backend`, `v2`, `v3`) into a single tracked entity.
- **Aggregated Dashboard Analytics**: Lifetime bar charts, share pie charts, 7-day stacked activity, 30-day trends, and weekly top 5 metrics now aggregate grouped projects seamlessly.
- **Accordion Project Details Table**: View projects in grouped or individual mode with the new segmented toggle. Group rows expand to show sub-repo breakdowns with percentage progress bars.
- **Smart Group Detection**: Automatic stem-detection heuristic suggests group combinations for related projects with one-click acceptance.
- **Restructured Manage Groups Modal**: Modern UI/UX built with Lucide vector icons, segmented navigation tabs (`Active Groups` and `Create Group`), color palette presets with halos, and responsive folder cards.
- **Delete Confirmation Dialog**: Built-in safety confirmation modal ensuring raw tracking records remain safe upon group deletion.
- **Interactive Release Announcement Banner**: Top-docked notification bar with `!` badge, responsive centering, and an interactive spotlight tour guiding users directly to the feature.
- **Share Card Rollup**: Export share card graphics with consolidated project group metrics.

---

### 💻 Installation Instructions

#### Option 1: Direct `.vsix` Package Install
1. Scroll down to the **Assets** section of this release and download `dev-timekeeper-1.0.38.vsix`.
2. In VS Code or VSCodium, press `Ctrl+Shift+X` (or `Cmd+Shift+X`) to open the **Extensions** view.
3. Click the `...` menu (top right corner of the Extensions panel) → select **Install from VSIX...**
4. Select the downloaded `dev-timekeeper-1.0.38.vsix` file.

#### Option 2: Command Line (CLI)
```bash
# VSCodium / Open VSX CLI
codium --install-extension DebjyotiGhosh.dev-timekeeper

# VS Code CLI
code --install-extension DebjyotiGhosh.dev-timekeeper
```

---
*Full source code & documentation available at [github.com/debjyoti71/time_extension](https://github.com/debjyoti71/time_extension).*
