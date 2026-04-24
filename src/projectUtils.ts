import * as vscode from 'vscode';
import * as storage from './storage';

let cachedData: storage.TrackingData | null = null;
let cacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

function getCachedData(): storage.TrackingData {
  const now = Date.now();
  if (!cachedData || now - cacheTime > CACHE_TTL) {
    cachedData = storage.load();
    cacheTime = now;
  }
  return cachedData;
}

function getWorkspaceProject(filePath: string): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) { return undefined; }

  const target = filePath.replace(/\\/g, '/').toLowerCase();
  let best: { name: string; path: string } | undefined;

  for (const folder of folders) {
    const wsPath = folder.uri.fsPath.replace(/\\/g, '/').toLowerCase();
    if (target.startsWith(wsPath + '/')) {
      if (!best || wsPath.length > best.path.length) {
        best = { name: folder.name, path: wsPath };
      }
    }
  }

  if (!best) {
    const ws = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (ws) { return ws.name; }
  }

  return best?.name;
}

export function getProjectFolder(filePath: string): string {
  // 1. Use the project name stored at tracking time (most reliable)
  const stored = getCachedData().files[filePath]?.project;
  if (stored) { return stored; }

  // 2. Match against currently open workspace folders
  const workspaceName = getWorkspaceProject(filePath);
  if (workspaceName) { return workspaceName; }

  // 3. Legacy fallback: heuristic from path segments only (no cwd/PWD)
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);

  const rootIdx = parts.findIndex(p =>
    p.toLowerCase() === 'my_projects' ||
    p.toLowerCase() === 'projects' ||
    p.toLowerCase() === 'repos' ||
    p.toLowerCase() === 'workspace'
  );
  if (rootIdx !== -1 && parts[rootIdx + 1]) { return parts[rootIdx + 1]; }

  if (parts.length >= 2 && /^[a-z]:$/i.test(parts[0])) { return parts[1]; }

  if (parts.length >= 2) { return parts[parts.length - 2]; }
  return parts[0] || filePath;
}

const JUNK = new Set([
  'downloads', 'temp', 'tmp', 'appdata', '.aws', 'rest_framework',
  'dotenv', 'modules', 'management', 'site-packages', 'python313', 'python312',
  'python311', 'python310', 'programs'
]);

export function isJunk(project: string, filePath: string): boolean {
  const lower = project.toLowerCase();
  if (lower.includes('.zip') || lower.includes('attachments') || lower.includes('combined.json')) { return true; }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(project)) { return true; }
  if (JUNK.has(lower)) { return true; }
  const fp = filePath.toLowerCase();
  if (fp.includes('appdata') || fp.includes('site-packages') || fp.includes('\\programs\\')) { return true; }
  return false;
}

