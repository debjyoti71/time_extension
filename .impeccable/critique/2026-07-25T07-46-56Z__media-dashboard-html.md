---
target: media/dashboard.html
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-07-25T07-46-56Z
slug: media-dashboard-html
---
# Critique Report: media/dashboard.html

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Generic `--` placeholders during initial chart render |
| 2 | Match System / Real World | 3 | Header title uses "Time Tracker" instead of "Dev Timekeeper" |
| 3 | User Control and Freedom | 3 | 3-dot section toggle works well; lacks quick filter reset |
| 4 | Consistency and Standards | 2 | Heavy inline CSS in HTML; inconsistent button styling |
| 5 | Error Prevention | 3 | View-only dashboard; filter input lacks instant clear button |
| 6 | Recognition Rather Than Recall | 3 | Clear section headers, but low label contrast hampers scannability |
| 7 | Flexibility and Efficiency of Use | 2 | No keyboard shortcuts for search input (`/`) or quick jump menu |
| 8 | Aesthetic and Minimalist Design | 3 | Clean dark aesthetic, but muted text (`#444`/`#555`) fails WCAG AA |
| 9 | Error Recovery | 3 | Empty table filter state lacks explicit "No matching projects" prompt |
| 10 | Help and Documentation | 2 | Missing tooltips explaining calculation rules (e.g., idle thresholds) |
| **Total** | | **27/40** | **Acceptable** |

#### Design Specificity Verdict

**LLM assessment**: The interface successfully captures the dark code editor atmosphere with effective use of One Dark syntax accents. However, it suffers from structural clutter in code (excessive inline CSS styling in HTML) and accessibility flaws (subdued gray text failing WCAG AA contrast).

**Deterministic scan**: Detector found 1 advisory finding: `font-size: 15px` at line 91 in `media/dashboard.html` (`#pieCenterValue` inline style) which deviates from the `DESIGN.md` type ramp.

#### Overall Impression
A solid, high-density dark UI that feels native to VS Code, but hampered by low label contrast and inline style drift.

#### What's Working
1. **Time Horizon Color Encoding**: Blue/Green/Yellow/Purple metric hierarchy makes dashboard metrics scannable at a glance.
2. **Modular Section Architecture**: 3-dot toggle menu empowers developers to customize their visible telemetry cards.
3. **Multi-Chart Analytics Layout**: Clean grid grouping of line, bar, pie, and treemap charts.

#### Priority Issues

- **[P1] WCAG AA Contrast Failures on Labels**: Section headings (`#444`), card titles (`#555`), and table headers (`#444`) fall below the 4.5:1 minimum contrast threshold on dark backgrounds (`#0e0e10` / `#1a1a1e`).
  - *Why it matters*: Hard to read in ambient light or on low-brightness screens.
  - *Fix*: Elevate label text colors to `#888888` / `#999999` (~5.5:1 ratio).
  - *Suggested command*: `$impeccable polish media/dashboard.css`

- **[P1] Scattered Inline Styling**: `media/dashboard.html` relies on inline `style="..."` attributes for container dimensions, flex alignments, and typographic rules.
  - *Why it matters*: Violates design system separation of concerns and breaks token maintenance.
  - *Fix*: Move all inline styles into CSS classes in `media/dashboard.css`.
  - *Suggested command*: `$impeccable layout media/dashboard.html`

- **[P2] Brand Title Mismatch**: Main dashboard header H1 displays "Time Tracker" instead of official brand name "Dev Timekeeper".
  - *Why it matters*: Brand inconsistency across extension artifacts.
  - *Fix*: Update H1 header text to "Dev Timekeeper".
  - *Suggested command*: `$impeccable clarify media/dashboard.html`

- **[P2] Lack of Keyboard Shortcuts & Accessibility Focus**: Filter input and section toggles lack keyboard navigation (`/` to focus search) and visible focus rings.
  - *Why it matters*: Power users and keyboard-only developers experience friction.
  - *Fix*: Implement `/` shortcut listener and `:focus-visible` styling.
  - *Suggested command*: `$impeccable harden media/dashboard.html`

#### Persona Red Flags

- **Alex (Power User)**: No keyboard shortcuts (e.g. `/` to focus filter, `Esc` to close menu). Scrolling through 8 sections without a quick navigation sticky index.
- **Jordan (First-Timer)**: Low-contrast `#444` sub-labels are difficult to discern on dark monitors.
- **Sam (Accessibility-Dependent User)**: Contrast ratios of 2.2:1 on labels fail WCAG AA. Menu labels lack `aria-expanded` and semantic menu roles.

#### Minor Observations
- Table `#toggleRows` button uses generic styling instead of `.action-btn`.
- Pie chart overlay uses absolute positioning with hardcoded `180px` dimensions.

#### Questions to Consider
- Should we add a sticky section navbar for instant jump access across the 8 dashboard panels?
- Could the filter input feature an instant clear button (`×`) when text is typed?
