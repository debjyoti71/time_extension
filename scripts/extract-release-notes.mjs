import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = process.argv[2] || pkg.version;

let changelog = '';
if (fs.existsSync(changelogPath)) {
  changelog = fs.readFileSync(changelogPath, 'utf8');
}

function extractVersionNotes(changelogText, ver) {
  const escapedVer = ver.replace(/\./g, '\\.');
  const regex = new RegExp(`##\\s+\\[${escapedVer}\\][^\n]*\\n([\\s\\S]*?)(?=\\n##\\s+\\[|\\n---|$)`, 'i');
  const match = changelogText.match(regex);
  if (!match) {
    return '*(No specific changelog entry found for this release version)*';
  }
  let notes = match[1].trim();

  // Enhance section headers with badges
  notes = notes.replace(/^###\s+Added/gmi, '### 🚀 Added & New Features');
  notes = notes.replace(/^###\s+Changed/gmi, '### ⚡ Changed & Enhancements');
  notes = notes.replace(/^###\s+Fixed/gmi, '### 🐞 Fixed & Bug Fixes');
  notes = notes.replace(/^###\s+Security/gmi, '### 🔒 Security');

  return notes;
}

const versionNotes = extractVersionNotes(changelog, version);

const fullReleaseBody = `# ⏱️ Dev Timekeeper v${version}

[![Version](https://img.shields.io/badge/version-${version}-green.svg)](https://github.com/debjyoti71/time_extension/releases/tag/v${version})
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/debjyoti71/time_extension/blob/main/LICENSE)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20offline-brightgreen.svg)](#)
[![Open VSX](https://img.shields.io/open-vsx/v/DebjyotiGhosh/dev-timekeeper.svg?color=blue)](https://open-vsx.org/extension/DebjyotiGhosh/dev-timekeeper)

> **Private, offline-first developer productivity extension for VS Code & VSCodium.**  
> Automatically records active coding time per file, folder, workspace, day, and hour with zero cloud dependencies and zero telemetry.

---

### 📦 Release Highlights & Changelog

${versionNotes}

---

### 💻 Installation Instructions

#### Option 1: Direct \`.vsix\` Package Install
1. Scroll down to the **Assets** section of this release and download \`dev-timekeeper-${version}.vsix\`.
2. In VS Code or VSCodium, press \`Ctrl+Shift+X\` (or \`Cmd+Shift+X\`) to open the **Extensions** view.
3. Click the \`...\` menu (top right corner of the Extensions panel) → select **Install from VSIX...**
4. Select the downloaded \`dev-timekeeper-${version}.vsix\` file.

#### Option 2: Command Line (CLI)
\`\`\`bash
# VSCodium / Open VSX CLI
codium --install-extension DebjyotiGhosh.dev-timekeeper

# VS Code CLI
code --install-extension DebjyotiGhosh.dev-timekeeper
\`\`\`

---
*Full source code & documentation available at [github.com/debjyoti71/time_extension](https://github.com/debjyoti71/time_extension).*
`;

const outputPath = process.argv[3] || path.join(rootDir, 'RELEASE_NOTES.md');
fs.writeFileSync(outputPath, fullReleaseBody, 'utf8');
console.log(`Successfully generated release notes for v${version} at ${outputPath}`);
