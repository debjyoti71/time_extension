---
name: Dev Timekeeper
description: Private, offline-first active coding time tracker dashboard for VS Code
colors:
  primary: "#61afef"
  secondary: "#98c379"
  tertiary: "#e5c07b"
  purple: "#c678dd"
  red: "#e06c75"
  cyan: "#56b6c2"
  canvas-bg: "#0e0e10"
  surface-card: "#1a1a1e"
  surface-bubble: "#16161a"
  border-subtle: "#222226"
  border-interactive: "#2a2a2e"
  text-primary: "#ffffff"
  text-body: "#d4d4d4"
  text-muted: "#888888"
  text-subdued: "#444444"
typography:
  display:
    fontFamily: "'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: "1.2"
  headline:
    fontFamily: "'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 700
  body:
    fontFamily: "'Segoe UI', sans-serif"
    fontSize: "13px"
    lineHeight: "1.4"
  label:
    fontFamily: "'Segoe UI', sans-serif"
    fontSize: "10px"
    letterSpacing: "0.5px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.lg}"
    padding: "16px 12px"
  chart-box:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.lg}"
    padding: "16px"
  action-btn:
    backgroundColor: "#1e1e22"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "5px 10px"
  filter-input:
    backgroundColor: "{colors.canvas-bg}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.sm}"
    padding: "5px 10px"
---

# Design System: Dev Timekeeper

## Overview

**Creative North Star: "The One Dark Terminal"**

Dev Timekeeper's dashboard design system mimics the dark, high-density aesthetics of popular code editors like VS Code and One Dark Pro. Built as a native Webview extension interface, it prioritizes immediate scannability, dark canvas comfort, and clear visual hierarchy without distracting ornamentation.

The interface pairs a ultra-dark background (`#0e0e10`) with elevated dark card containers (`#1a1a1e`) bordered by crisp, low-contrast edges (`#222226`). High-value metrics are distinguished by a signature 6-tone syntax palette (Blue, Green, Yellow, Purple, Red, Cyan) that mirrors code syntax highlighting, making complex productivity trends instantly recognizable.

**Key Characteristics:**
- **Editor-Native Density**: Compact typography and multi-column grid layouts maximize data presentation within VS Code webview panels.
- **Syntax Accent System**: Distinct semantic colors dedicated to time horizons (Blue for Today, Green for This Week, Yellow for This Month, Purple for Lifetime).
- **Tonal Border Hierarchy**: Low-contrast borders (`#222226` structural, `#2a2a2e` interactive) define container boundaries without visual noise.

## Colors

The color system uses an editor-inspired palette against a deep dark gray canvas.

### Primary
- **One Dark Blue** (`#61afef`): Primary interactive accent used for active status indicators, "Today" metric values, input focus rings, hover borders, and active table headers.

### Secondary
- **One Dark Green** (`#98c379`): Secondary status accent used for "This Week" totals, positive delta indicators (`.delta-up`), bubble titles, and dev status badges.

### Tertiary
- **One Dark Yellow** (`#e5c07b`): Medium-horizon metric accent used for "This Month" totals and 30-day productivity highlights.

### Accent Roles
- **One Dark Purple** (`#c678dd`): Lifetime metrics accent used for "Lifetime Total" and long-term project statistics.
- **One Dark Red** (`#e06c75`): Negative delta indicator (`.delta-down`) and warning states.
- **One Dark Cyan** (`#56b6c2`): Special highlight accent for auxiliary charts and language badges.

### Neutral
- **Canvas Dark** (`#0e0e10`): Deep background for the main viewport and filter inputs.
- **Surface Dark** (`#1a1a1e`): Primary container background for cards, chart containers, and table wrapper boxes.
- **Bubble Surface** (`#16161a`): Subdued container background for secondary language bubble cards and table row hover states.
- **Subtle Border** (`#222226`): 1px structural container outline.
- **Interactive Border** (`#2a2a2e`): 1px outline for buttons, inputs, and dropdown boundaries.
- **Text Primary** (`#ffffff`): Main titles and high-value header metrics.
- **Text Body** (`#d4d4d4`): Readable body copy and standard table cell contents.
- **Text Muted** (`#888888` / `#aaaaaa`): Secondary labels and metadata text.
- **Text Subdued** (`#444444` / `#555555`): Section header labels and structural dividers.

### Named Rules
**The Metric Horizon Rule.** Accent colors strictly identify time scope: Blue = Today, Green = Week, Yellow = Month, Purple = Lifetime. Never swap or mix metric colors across different time horizons.

## Typography

**Display Font:** 'Segoe UI', sans-serif (system fallbacks: Arial, sans-serif)
**Body Font:** 'Segoe UI', sans-serif
**Label Font:** 'Segoe UI', sans-serif (uppercase, letter-spaced)

**Character:** Clean, sans-serif typography engineered for high-density dashboard layouts and numerical clarity.

### Hierarchy
- **Display / H1** (400, 20px, 1.2): Main dashboard title in pure white (`#ffffff`).
- **Headline / Card Value** (700, 20px, 1.2): Large numeric stat values colored by time horizon accent.
- **Title / Chart Header** (600, 10px, uppercase, 0.5px letter-spacing): Section sub-headers and chart box titles (`#555555`).
- **Body / Table Cell** (400, 12px-13px, 1.4): General tabular data (`#d4d4d4`) and menu options (`#aaaaaa`).
- **Label / Section Tag** (400, 10px, uppercase, 1px letter-spacing): Subdued category headers (`#444444`).
- **Dev Badge** (700, 9px, uppercase, 1.5px letter-spacing): Developer status indicator (`#98c379`).

### Named Rules
**The Uppercase Metadata Rule.** All container titles, metric labels, and section headings must be set in 10px uppercase with tracking (0.5px to 1px) in subdued gray (`#444` or `#555`).

## Layout

The dashboard layout utilizes a responsive multi-column CSS grid system designed for VS Code side-by-side editor panels.

- **Viewport Container**: Padded at 20px around the perimeter (`padding: 20px`).
- **Header Section**: Flexbox row with space-between alignment separating title from global action buttons.
- **Stats Card Grid**: 4-column CSS grid (`grid-template-columns: repeat(4, 1fr)`) with a 12px gap.
- **Charts Row**: 2-column equal grid (`grid-template-columns: 1fr 1fr`) with 12px gap for dual-chart comparison.
- **Full-Width Containers**: Single column full-width containers for wide charts (e.g., Hourly Coding heatmap, Language breakdown).
- **Responsive Adaptability**: Flexbox wrap for compact viewports; tables scroll horizontally (`overflow-x: auto`).

## Elevation & Depth

Dev Timekeeper uses flat tonal surface layering without ambient drop shadows on resting elements, mirroring code editor UI conventions.

- **Base Layer** (`#0e0e10`): Main webview canvas.
- **Elevated Layer** (`#1a1a1e`): Stat cards, chart containers, table wrappers.
- **Floating Overlays** (`#1a1a1e` with `0 8px 24px rgba(0,0,0,0.5)`): Dropdown menus and context overlays.

### Shadow Vocabulary
- **Overlay Drop Shadow** (`0 8px 24px rgba(0,0,0,0.5)`): Reserved exclusively for floating popovers, context menus, and modal dropdowns (`.menu-dropdown`).

### Named Rules
**The Flat Canvas Rule.** Cards and charts sit flat on the dark canvas using tonal contrast (`#1a1a1e` on `#0e0e10`) and crisp 1px borders (`#222226`). Drop shadows are forbidden on inline containers.

## Shapes

Forms are structured with soft, consistent rounded corners:

- **Small Radius** (`4px`): Text inputs (`#filterInput`) and dev mode badges.
- **Medium Radius** (`6px`): Action buttons (`.action-btn`), menu buttons (`.menu-btn`), and dev bar panels.
- **Large Radius** (`8px`): Content cards (`.card`), chart boxes (`.chart-box`), table containers (`.table-box`), dropdown menus (`.menu-dropdown`), and bubble containers.
- **Full Radius** (`50%`): Circular nodes in the language bubble map.

## Components

### Stat Cards
- **Shape:** Rounded container (8px radius)
- **Background:** `#1a1a1e` with 1px border (`#222226`)
- **Padding:** `16px 12px`
- **Internal Layout:** Vertical stack centered (10px uppercase label, 20px bold value with time horizon accent color, 11px delta status).

### Chart Containers (`.chart-box`)
- **Shape:** Rounded container (8px radius)
- **Background:** `#1a1a1e` with 1px border (`#222226`)
- **Padding:** `16px`
- **Header:** Uppercase 10px title (`#555555`) with 14px bottom margin.

### Action Buttons (`.action-btn`)
- **Shape:** Soft rounded button (6px radius)
- **Background:** `#1e1e22` with 1px border (`#2a2a2e`)
- **Typography:** 11px One Dark Blue (`#61afef`), line-height 1.2
- **Padding:** `5px 10px`
- **Hover:** Border shifts to One Dark Blue (`#61afef`).

### Text Filter Input (`#filterInput`)
- **Shape:** Compact rounded field (4px radius)
- **Background:** `#0e0e10` with 1px border (`#2a2a2e`)
- **Typography:** 12px body text (`#d4d4d4`)
- **Padding:** `5px 10px`
- **Focus State:** Border shifts to One Dark Blue (`#61afef`) with outline removed.

### Dropdown Menu (`.menu-dropdown`)
- **Shape:** Floating panel (8px radius)
- **Background:** `#1a1a1e` with 1px border (`#2a2a2e`) and `0 8px 24px rgba(0,0,0,0.5)` drop shadow
- **Padding:** `10px 0`
- **Item Hover:** `#222228` background highlight with white text (`#ffffff`).

### Data Table (`.table-box`)
- **Header Row:** 10px uppercase columns (`#444444`) with bottom border (`#222226`). Sorted header turns One Dark Blue (`#61afef`).
- **Body Rows:** 8px 10px padding, 1px bottom border (`#16161a`). Row hover highlights with `#1e1e24`.
- **First Column:** Highlighted in One Dark Green (`#98c379`) for project name identification.

## Do's and Don'ts

### Do:
- **Do** maintain the 6-tone syntax palette for metric horizons (Blue=Today, Green=Week, Yellow=Month, Purple=Lifetime).
- **Do** use `#0e0e10` for canvas background and `#1a1a1e` for container surfaces.
- **Do** keep section labels and chart titles in 10px uppercase letter-spaced text (`#444` / `#555`).
- **Do** use crisp 1px borders (`#222226` / `#2a2a2e`) for surface separation.

### Don't:
- **Don't** use bright white or light backgrounds that clash with dark editor themes.
- **Don't** apply drop shadows to resting cards or inline chart containers.
- **Don't** mix accent colors arbitrarily across metric cards.
- **Don't** remove the 8px border radius on cards and chart boxes.
