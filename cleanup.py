import json
import os
import re

DST = os.path.expanduser(r"~\.vscode-time-tracker\data.json")

with open(DST, "r", encoding="utf-8") as f:
    data = json.load(f)

before = len(data["files"])

REMOVE_PROJECTS = {
    "modules", "management", "dotenv", ".aws",
    "ai-repair-suggestion-system", "rest_framework", "aidverify_0"
}

JUNK_SUBSTRINGS = [
    ".zip", "attachments", "combined.json",
    "appdata", "site-packages", "programs"
]

def get_project(fp):
    parts = fp.replace("\\", "/").split("/")
    idx = next((i for i, p in enumerate(parts)
                if p.lower() in ("my_projects", "projects", "repos", "workspace")), -1)
    if idx != -1 and len(parts) > idx + 1:
        return parts[idx + 1].lower()
    return parts[-2].lower() if len(parts) >= 2 else ""

def is_junk(fp):
    proj = get_project(fp)
    if proj in REMOVE_PROJECTS:
        return True
    fp_lower = fp.lower()
    if any(x in fp_lower for x in JUNK_SUBSTRINGS):
        return True
    if re.match(r"^[0-9a-f]{8}-", proj):
        return True
    return False

data["files"] = {fp: rec for fp, rec in data["files"].items() if not is_junk(fp)}
after = len(data["files"])

with open(DST, "w", encoding="utf-8") as f:
    json.dump(data, f)

print(f"Removed : {before - after} junk entries")
print(f"Remaining: {after} files")
total = sum(r["total"] for r in data["files"].values())
print(f"Lifetime : {total // 3600}h {(total % 3600) // 60}m")
