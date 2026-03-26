import json
import os
from collections import defaultdict
from datetime import datetime, timedelta

DATA_FILE = os.path.expanduser(r'~\.vscode-time-tracker\data.json')
SETTINGS_FILE = os.path.expanduser(r'~\.vscode-time-tracker\settings.json')
HEARTBEAT_FILE = os.path.expanduser(r'~\.vscode-time-tracker\heartbeat.json')

def fmt(secs):
    h, m, s = secs // 3600, (secs % 3600) // 60, secs % 60
    if h > 0: return f"{h}h {m}m {s}s"
    if m > 0: return f"{m}m {s}s"
    return f"{s}s"

def get_project(fp):
    parts = fp.replace('\\', '/').split('/')
    for i, p in enumerate(parts):
        if p.lower() in ('my_projects', 'projects', 'repos', 'workspace'):
            if i + 1 < len(parts): return parts[i + 1]
    return parts[-2] if len(parts) >= 3 else parts[-1]

# ── Load data ──────────────────────────────────────────────────────────────────
d = json.load(open(DATA_FILE, encoding='utf-8'))
files = d['files']

print("=" * 60)
print("  TIME TRACKER — FULL DATA REPORT")
print(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 60)

# ── File sizes ─────────────────────────────────────────────────────────────────
print("\n[ FILE SIZES ]")
for f in [DATA_FILE, SETTINGS_FILE, HEARTBEAT_FILE]:
    if os.path.exists(f):
        size = os.path.getsize(f)
        print(f"  {os.path.basename(f):<20} {size/1024:.1f} KB")

# ── Overall stats ──────────────────────────────────────────────────────────────
total_secs = sum(r['total'] for r in files.values())
all_dates = set()
for r in files.values():
    all_dates.update(r.get('dailyTotal', {}).keys())

print(f"\n[ OVERALL STATS ]")
print(f"  Total files tracked : {len(files)}")
print(f"  Lifetime time       : {fmt(total_secs)}")
print(f"  Active days         : {len(all_dates)}")
if all_dates:
    print(f"  First active day    : {min(all_dates)}")
    print(f"  Last active day     : {max(all_dates)}")

# ── Per project ────────────────────────────────────────────────────────────────
proj_totals = defaultdict(int)
proj_files  = defaultdict(int)
for fp, rec in files.items():
    proj = get_project(fp)
    proj_totals[proj] += rec['total']
    proj_files[proj]  += 1

print(f"\n[ TOP 20 PROJECTS ]")
print(f"  {'Project':<35} {'Time':>12}  {'Files':>6}")
print(f"  {'-'*35} {'-'*12}  {'-'*6}")
for proj, secs in sorted(proj_totals.items(), key=lambda x: -x[1])[:20]:
    print(f"  {proj:<35} {fmt(secs):>12}  {proj_files[proj]:>6}")

# ── Per day (last 30) ──────────────────────────────────────────────────────────
day_totals = defaultdict(int)
for rec in files.values():
    for date, secs in rec.get('dailyTotal', {}).items():
        day_totals[date] += secs

print(f"\n[ LAST 30 DAYS ]")
print(f"  {'Date':<12} {'Time':>12}  Bar")
print(f"  {'-'*12} {'-'*12}  {'-'*20}")
for date in sorted(day_totals.keys())[-30:]:
    secs = day_totals[date]
    bar = '#' * min(40, int(secs / 3600 * 4))
    print(f"  {date:<12} {fmt(secs):>12}  {bar}")

# ── Hour of day ────────────────────────────────────────────────────────────────
last30 = {(datetime.now().date() - timedelta(days=i)).isoformat() for i in range(30)}
hour_totals = defaultdict(float)  # seconds per hour bucket (last 30 days)

for rec in files.values():
    dh = rec.get('dailyHours', {})
    dt = rec.get('dailyTotal', {})
    for date, hours in dh.items():
        if date not in last30:
            continue
        day_secs = dt.get(date, 0)
        if isinstance(hours, list):
            hrs = []
            for h in hours:
                try:
                    hi = int(h)
                except Exception:
                    continue
                if 0 <= hi < 24:
                    hrs.append(hi)
            share = day_secs / len(hrs) if hrs else 0
            for h in hrs:
                hour_totals[h] += share
        elif isinstance(hours, dict):
            for h, secs in hours.items():
                try:
                    hi = int(h)
                except Exception:
                    continue
                if hi < 0 or hi > 23:
                    continue
                val = secs if isinstance(secs, (int, float)) else 0
                hour_totals[hi] += val

max_secs = max(hour_totals.values()) if hour_totals else 0
print(f"\n[ CODING PATTERNS — HOUR OF DAY (LAST 30 DAYS) ]")
print(f"  (total coding time in each hour bucket)")
print(f"  {'Hour':<8} {'Time':>12}  Bar")
print(f"  {'-'*8} {'-'*12}  {'-'*20}")
for h in range(24):
    label = '12am' if h == 0 else '12pm' if h == 12 else f"{h}am" if h < 12 else f"{h-12}pm"
    secs = int(round(hour_totals.get(h, 0)))
    bar_len = 0 if max_secs == 0 else int(secs / max_secs * 20)
    bar = '#' * bar_len
    print(f"  {label:<8} {fmt(secs):>12}  {bar}")

# ── Language breakdown ─────────────────────────────────────────────────────────
EXT_MAP = {
    'ts':'TypeScript','tsx':'TypeScript','js':'JavaScript','jsx':'JavaScript',
    'py':'Python','html':'HTML','css':'CSS','scss':'CSS','json':'JSON',
    'md':'Markdown','java':'Java','cpp':'C++','c':'C','cs':'C#','go':'Go',
    'rs':'Rust','rb':'Ruby','php':'PHP','sh':'Shell','sql':'SQL'
}
lang_counts = defaultdict(int)
for fp in files:
    ext = fp.rsplit('.', 1)[-1].lower() if '.' in fp else 'other'
    lang = EXT_MAP.get(ext, ext.upper())
    lang_counts[lang] += 1

print(f"\n[ LANGUAGE BREAKDOWN — FILE COUNT ]")
print(f"  {'Language':<15} {'Files':>6}  {'%':>5}")
print(f"  {'-'*15} {'-'*6}  {'-'*5}")
total_files = sum(lang_counts.values())
for lang, count in sorted(lang_counts.items(), key=lambda x: -x[1])[:15]:
    pct = round(count / total_files * 100, 1)
    print(f"  {lang:<15} {count:>6}  {pct:>4}%")

# ── Settings ───────────────────────────────────────────────────────────────────
if os.path.exists(SETTINGS_FILE):
    settings = json.load(open(SETTINGS_FILE, encoding='utf-8'))
    hidden = settings.get('hiddenSections', {})
    print(f"\n[ DASHBOARD SETTINGS ]")
    if hidden:
        print(f"  Hidden sections: {', '.join(hidden.keys())}")
    else:
        print(f"  All sections visible")

# ── Heartbeat ──────────────────────────────────────────────────────────────────
if os.path.exists(HEARTBEAT_FILE):
    hb = json.load(open(HEARTBEAT_FILE, encoding='utf-8'))
    idle_ms = hb.get('idleMs', 0)
    print(f"\n[ HEARTBEAT ]")
    print(f"  System idle: {idle_ms/1000:.1f}s  ({'IDLE' if idle_ms > 300000 else 'ACTIVE'})")

print("\n" + "=" * 60)
