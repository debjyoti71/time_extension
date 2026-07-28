# ⏱️ Dev Timekeeper v1.0.35

[![Version](https://img.shields.io/badge/version-1.0.35-green.svg)](https://github.com/debjyoti71/time_extension/releases/tag/v1.0.35)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/debjyoti71/time_extension/blob/main/LICENSE)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20offline-brightgreen.svg)](#)
[![Open VSX](https://img.shields.io/open-vsx/v/DebjyotiGhosh/dev-timekeeper.svg?color=blue)](https://open-vsx.org/extension/DebjyotiGhosh/dev-timekeeper)

> **Private, offline-first developer productivity extension for VS Code & VSCodium.**  
> Automatically records active coding time per file, folder, workspace, day, and hour with zero cloud dependencies and zero telemetry.

---

### 📦 Release Highlights & Changelog

### ⚡ Changed & Enhancements
- **Fluid Container-Query Dashboard Layout**: Implemented CSS Container Queries (`@container dashboard`) so stat cards, chart rows, pie chart legends, and tabular data dynamically reflow when VS Code sidebars or split editor windows are resized.

### 🐞 Fixed & Bug Fixes
- **Narrow Viewport & Mobile Overflow**: Resolved fixed 4-column card grid and side-by-side chart squishing by introducing responsive 2-column/1-column breakpoints and flexible flex wrapping.
- **SVG Language Map Resizing**: Added debounced window resize handler in `dashboard.js` to automatically recalculate SVG language bubble map bounds on window or webview resize.
- **Touch Target & Accessibility Hardening**: Increased hit targets to 44px minimum for touch pointers and added full WCAG AA contrast & `prefers-reduced-motion` animation compliance.

---

### 💻 Installation Instructions

#### Option 1: Direct `.vsix` Package Install
1. Scroll down to the **Assets** section of this release and download `dev-timekeeper-1.0.35.vsix`.
2. In VS Code or VSCodium, press `Ctrl+Shift+X` (or `Cmd+Shift+X`) to open the **Extensions** view.
3. Click the `...` menu (top right corner of the Extensions panel) → select **Install from VSIX...**
4. Select the downloaded `dev-timekeeper-1.0.35.vsix` file.

#### Option 2: Command Line (CLI)
```bash
# VSCodium / Open VSX CLI
codium --install-extension DebjyotiGhosh.dev-timekeeper

# VS Code CLI
code --install-extension DebjyotiGhosh.dev-timekeeper
```

---
*Full source code & documentation available at [github.com/debjyoti71/time_extension](https://github.com/debjyoti71/time_extension).*
