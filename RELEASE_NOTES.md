# ⏱️ Dev Timekeeper v1.1.0

[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](https://github.com/debjyoti71/time_extension/releases/tag/v1.1.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/debjyoti71/time_extension/blob/main/LICENSE)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20offline-brightgreen.svg)](#)
[![Open VSX](https://img.shields.io/open-vsx/v/DebjyotiGhosh/dev-timekeeper.svg?color=blue)](https://open-vsx.org/extension/DebjyotiGhosh/dev-timekeeper)

> **Private, offline-first developer productivity extension for VS Code & VSCodium.**  
> Automatically records active coding time per file, folder, workspace, day, and hour with zero cloud dependencies and zero telemetry.

---

### 📦 Release Highlights & Changelog (v1.1.0)

#### 🚀 Major Architectural Milestone: Multi-Instance & Cross-Editor Coordination
- **Cross-Editor Synchronization**: Seamlessly track time across multiple VS Code windows, Antigravity IDE instances, and multi-root workspaces concurrently.
- **Active Instance Lease (`active_session.json`)**: Eliminates time inflation and double-counting. The actively focused editor claims tracking, while background windows yield. 1 real hour of work across multiple windows strictly counts as 1 hour.
- **Atomic Mutex & Deadlock Immunity (`withLock`)**: Non-blocking atomic OS lock on `data.json` with exponential backoff and 3-second auto-stale recovery. Stress-tested under 1,000 rapid concurrent operations across 10 processes with 100% data integrity and zero `EBUSY` crashes.
- **Singleton Heartbeat Manager**: Single active Win32 idle monitor daemon across all open windows, eliminating duplicate PowerShell processes and reducing background CPU usage.
- **Clock-Hour Boundary Clamping**: Strict physical 3,600s hourly boundary per day in dashboard aggregations, guaranteeing hourly heatmap bars never exceed 100% capacity.
- **Live Cross-Instance Dashboard Sync**: The dashboard panel actively watches the database file to trigger live updates whenever another IDE writes to disk.

#### 🗂️ Features from v1.0.38 Included:
- **Project Groups & Multi-Repo Aggregation**: Combine multi-repo codebases, microservices, and versioned iterations into unified tracked projects.
- **Accordion Project Details Table**: Toggle between Grouped and Individual views with sub-repo breakdown progress bars.
- **Modern Management Modal**: Redesigned UI/UX with Lucide vector icons, curated swatches, and delete confirmation safeguards.

---

### 💻 Installation Instructions

#### Option 1: Direct `.vsix` Package Install
1. Scroll down to the **Assets** section of this release and download `dev-timekeeper-1.1.0.vsix`.
2. In VS Code or VSCodium, press `Ctrl+Shift+X` (or `Cmd+Shift+X`) to open the **Extensions** view.
3. Click the `...` menu (top right corner of the Extensions panel) → select **Install from VSIX...**
4. Select the downloaded `dev-timekeeper-1.1.0.vsix` file.

#### Option 2: Command Line (CLI)
```bash
# VSCodium / Open VSX CLI
codium --install-extension DebjyotiGhosh.dev-timekeeper

# VS Code CLI
code --install-extension DebjyotiGhosh.dev-timekeeper
```

---
*Full source code & documentation available at [github.com/debjyoti71/time_extension](https://github.com/debjyoti71/time_extension).*
