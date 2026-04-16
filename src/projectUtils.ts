import * as vscode from 'vscode';

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

  // Fallback: ask VS Code which workspace owns the file (helps when casing differs).
  if (!best) {
    const ws = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (ws) { return ws.name; }
  }

  return best?.name;
}

export function getProjectFolder(filePath: string): string {
  const workspaceName = getWorkspaceProject(filePath);
  if (workspaceName) { return workspaceName; }

  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);

  // Use current working directory ("pwd") to avoid sticking to a stale root when switching folders.
  const pwd = (process.env.PWD || process.cwd() || '').replace(/\\/g, '/');
  if (pwd && normalized.startsWith(pwd)) {
    const rel = normalized.slice(pwd.length).split('/').filter(Boolean);
    if (rel[0]) { return rel[0]; }
    const base = pwd.split('/').filter(Boolean).pop();
    if (base) { return base; }
  }

  // Heuristic folder names
  const rootIdx = parts.findIndex(p =>
    p.toLowerCase() === 'my_projects' ||
    p.toLowerCase() === 'projects' ||
    p.toLowerCase() === 'repos' ||
    p.toLowerCase() === 'workspace'
  );
  if (rootIdx !== -1 && parts[rootIdx + 1]) { return parts[rootIdx + 1]; }

  // If path is drive-rooted like "E:/proj/src/file", pick the first folder after the drive.
  if (parts.length >= 2 && /^[a-z]:$/i.test(parts[0])) { return parts[1]; }

  // Fallback: parent directory, else the path itself.
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

