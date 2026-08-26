# ⏱️ Dev Timekeeper v1.0.36

[![Version](https://img.shields.io/badge/version-1.0.36-green.svg)](https://github.com/debjyoti71/time_extension/releases/tag/v1.0.36)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/debjyoti71/time_extension/blob/main/LICENSE)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20offline-brightgreen.svg)](#)
[![Open VSX](https://img.shields.io/open-vsx/v/DebjyotiGhosh/dev-timekeeper.svg?color=blue)](https://open-vsx.org/extension/DebjyotiGhosh/dev-timekeeper)

> **Private, offline-first developer productivity extension for VS Code & VSCodium.**  
> Automatically records active coding time per file, folder, workspace, day, and hour with zero cloud dependencies and zero telemetry.

---

### 📦 Release Highlights & Changelog

### ⚡ Changed & Enhancements
- **Polished Stacked Bar Charts**: Redesigned dashboard stacked bar charts (weekly activity and 30-day trends) with rounded corners (`borderRadius: 2`), customized point style circles for legend items, and optimized spacing (`barPercentage`/`categoryPercentage`).
- **Adaptive Chart Scaling**: Removed hardcoded aspect ratio constraint on the 30-day trend chart for adaptive scaling across editor heights.
- **Axis Layout Improvements**: Enforced `beginAtZero: true` on chart y-axes to ensure proper zero baseline starting point, and scaled down font sizes for a cleaner look.

---

### 💻 Installation Instructions

#### Option 1: Direct `.vsix` Package Install
1. Scroll down to the **Assets** section of this release and download `dev-timekeeper-1.0.36.vsix`.
2. In VS Code or VSCodium, press `Ctrl+Shift+X` (or `Cmd+Shift+X`) to open the **Extensions** view.
3. Click the `...` menu (top right corner of the Extensions panel) → select **Install from VSIX...**
4. Select the downloaded `dev-timekeeper-1.0.36.vsix` file.

#### Option 2: Command Line (CLI)
```bash
# VSCodium / Open VSX CLI
codium --install-extension DebjyotiGhosh.dev-timekeeper

# VS Code CLI
code --install-extension DebjyotiGhosh.dev-timekeeper
```

---
*Full source code & documentation available at [github.com/debjyoti71/time_extension](https://github.com/debjyoti71/time_extension).*
