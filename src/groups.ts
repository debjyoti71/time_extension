import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProjectGroup {
  id: string;
  name: string;
  color?: string;
  projects: string[];
}

export interface GroupsData {
  groups: ProjectGroup[];
  dismissedSuggestions?: string[];
}

const DATA_DIR = path.join(os.homedir(), '.vscode-time-tracker');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadGroups(): GroupsData {
  ensureDir();
  if (!fs.existsSync(GROUPS_FILE)) {
    return { groups: [], dismissedSuggestions: [] };
  }
  try {
    const raw = fs.readFileSync(GROUPS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.groups)) {
      return { groups: [], dismissedSuggestions: [] };
    }
    return {
      groups: parsed.groups,
      dismissedSuggestions: Array.isArray(parsed.dismissedSuggestions) ? parsed.dismissedSuggestions : []
    };
  } catch {
    return { groups: [], dismissedSuggestions: [] };
  }
}

export function saveGroups(data: GroupsData): void {
  ensureDir();
  const tmp = GROUPS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, GROUPS_FILE);
}

export function getFolderToGroupMap(groups: ProjectGroup[]): Map<string, ProjectGroup> {
  const map = new Map<string, ProjectGroup>();
  for (const g of groups) {
    for (const proj of g.projects) {
      if (proj && typeof proj === 'string') {
        map.set(proj.toLowerCase(), g);
      }
    }
  }
  return map;
}

export interface SuggestedGroup {
  id: string;
  name: string;
  projects: string[];
}

/**
 * Strips common project suffixes like -backend, _frontend, _v2, -api, etc.
 */
function cleanStem(name: string): string {
  let s = name.trim();
  // Remove version tags: _v1, -v2, .v3, v2, etc. at the end
  s = s.replace(/[-_. ]*v\d+$/i, '');
  // Remove numbers at the end like _2, -2
  s = s.replace(/[-_. ]+\d+$/, '');
  // Remove role/component suffixes
  s = s.replace(/[-_. ]+(frontend|backend|client|server|ui|web|api|core|docs|service|infra|mobile|desktop|electron)$/i, '');
  return s.trim();
}

/**
 * Convert snake_case or kebab-case or camelCase into a readable Title Case
 */
export function formatGroupName(raw: string): string {
  const parts = raw.split(/[-_.\s]+/).filter(Boolean);
  if (parts.length === 0) { return raw; }
  return parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function suggestGroups(
  allProjects: string[],
  existingGroups: ProjectGroup[],
  dismissed: string[] = []
): SuggestedGroup[] {
  const assigned = new Set<string>();
  for (const g of existingGroups) {
    for (const p of g.projects) {
      assigned.add(p.toLowerCase());
    }
  }

  const dismissedSet = new Set(dismissed.map(d => d.toLowerCase()));
  const unassigned = allProjects.filter(p => !assigned.has(p.toLowerCase()));

  const stemMap = new Map<string, string[]>();

  for (const proj of unassigned) {
    const stem = cleanStem(proj).toLowerCase();
    if (stem.length >= 3) {
      const list = stemMap.get(stem) || [];
      list.push(proj);
      stemMap.set(stem, list);
    }
  }

  const suggestions: SuggestedGroup[] = [];

  for (const [stem, projects] of stemMap.entries()) {
    if (projects.length >= 2) {
      const id = `sug_${stem}`;
      if (dismissedSet.has(id.toLowerCase())) {
        continue;
      }
      suggestions.push({
        id,
        name: formatGroupName(stem),
        projects: projects.sort()
      });
    }
  }

  return suggestions;
}
