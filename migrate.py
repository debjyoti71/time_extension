import json, os, datetime

SRC = os.path.expandvars(r"%APPDATA%\Code\User\globalStorage\n3rds-inc.time\codingTimeData.json")
DST = os.path.expanduser(r"~\.vscode-time-tracker\data.json")

JUNK = {'unknown', 'downloads', 'temp', 'tmp', 'appdata', '.aws', 'rest_framework',
        'dotenv', 'modules', 'management', 'site-packages', 'programs'}

def is_junk(name):
    n = name.lower()
    return n in JUNK or '.zip' in n or len(n) == 36 and n[8] == '-'

with open(SRC, encoding='utf-8') as f:
    old = json.load(f)

# load existing data
with open(DST, encoding='utf-8') as f:
    result = json.load(f)

# collect dates already tracked by our extension (has real file data)
our_dates = set()
for rec in result['files'].values():
    for date, secs in rec.get('dailyTotal', {}).items():
        if secs > 0:
            our_dates.add(date)

print(f"Our tracker already has {len(our_dates)} dates — skipping those.")

added_secs = 0
added_dates = set()

for date, day in old.get('dailyData', {}).items():
    if date in our_dates:
        continue  # skip — our tracker has real data for this day

    repo_time = day.get('repoTime', {})
    for repo, secs in repo_time.items():
        if not secs or is_junk(repo):
            continue

        # synthetic file path so dashboard aggregates it under the right project
        fake_path = f"e:\\my_projects\\{repo}\\__migrated__.py"

        if fake_path not in result['files']:
            result['files'][fake_path] = {'total': 0, 'dailyTotal': {}, 'lastActive': 0}

        rec = result['files'][fake_path]
        rec['total'] += secs
        rec['dailyTotal'][date] = rec['dailyTotal'].get(date, 0) + secs
        ts = int(datetime.datetime.strptime(date, '%Y-%m-%d').timestamp() * 1000)
        rec['lastActive'] = max(rec['lastActive'], ts)
        added_secs += secs
        added_dates.add(date)

with open(DST, 'w', encoding='utf-8') as f:
    json.dump(result, f)

total_secs = sum(r['total'] for r in result['files'].values())
print(f"Added    : {added_secs // 3600}h {(added_secs % 3600) // 60}m from {len(added_dates)} new dates")
print(f"Lifetime : {total_secs // 3600}h {(total_secs % 3600) // 60}m")
print(f"Files    : {len(result['files'])}")
print(f"Saved to : {DST}")
