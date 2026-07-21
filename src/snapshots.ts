import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as storage from './storage';
import { getProjectFolder, isJunk } from './projectUtils';

function isoDay(d: Date): string { return d.toISOString().slice(0, 10); }

function fmt(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function buildAllCardData() {
  const data = storage.load();
  const now  = new Date();

  // Last 30 days list
  const l30dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    l30dates.push(isoDay(d));
  }
  const l30set = new Set(l30dates);

  const projects: Record<string, { dates: Record<string, number>, hours: Record<string, number> }> = {};

  for (const [filePath, rec] of Object.entries(data.files)) {
    const project = getProjectFolder(filePath);
    if (isJunk(project, filePath)) { continue; }
    
    if (!projects[project]) {
      projects[project] = { dates: {}, hours: {} };
    }
    const p = projects[project];

    // Dates
    for (const [d, s] of Object.entries(rec.dailyTotal)) {
      if (s > 0) { p.dates[d] = (p.dates[d] || 0) + s; }
    }

    // Hour of day (last 30 days only)
    const dh = (rec as any).dailyHours as Record<string, Record<string, number>> | undefined;
    if (dh) {
      for (const [date, hours] of Object.entries(dh)) {
        if (!l30set.has(date)) { continue; }
        for (const [hStr, sec] of Object.entries(hours)) {
          const h = Number(hStr);
          if (Number.isInteger(h) && h >= 0 && h <= 23) { 
            p.hours[h] = (p.hours[h] || 0) + (sec || 0); 
          }
        }
      }
    }
  }

  // Icon data URL (SVG → base64)
  let iconDataUrl: string | null = null;
  try {
    const iconPath = path.join(__dirname, '..', 'media', 'icon.svg');
    if (fs.existsSync(iconPath)) {
      iconDataUrl = 'data:image/svg+xml;base64,' +
        Buffer.from(fs.readFileSync(iconPath)).toString('base64');
    }
  } catch { /* no icon */ }

  return {
    generatedAt: now.toISOString(),
    l30dates,
    projects,
    iconDataUrl
  };
}

export async function generateShareCard(context: vscode.ExtensionContext): Promise<void> {
  const cardData = buildAllCardData();

  if (Object.keys(cardData.projects).length === 0) {
    vscode.window.showInformationMessage('No coding time recorded yet.');
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'timekeeperCardBuilder',
    '⏱ Card Builder',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
    }
  );

  const cssUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'media', 'card-builder.css'))
  );
  const jsUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'media', 'card-builder.js'))
  );

  const htmlPath = path.join(context.extensionPath, 'media', 'card-builder.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html
    .replace('{{CSS_URI}}', cssUri.toString())
    .replace('{{JS_URI}}',  jsUri.toString())
    .replace('{{DATA}}',    JSON.stringify(cardData));
  panel.webview.html = html;

  panel.webview.onDidReceiveMessage(async msg => {
    if (msg.command !== 'saveCard') { return; }

    const base64 = (msg.data as string).replace(/^data:image\/png;base64,/, '');
    const buf    = Buffer.from(base64, 'base64');

    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultUri = vscode.Uri.file(
      path.join(
        fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(),
        `timekeeper-card-${stamp}.png`
      )
    );

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'PNG Image': ['png'] },
      title: 'Save Share Card'
    });

    if (!saveUri) {
      panel.webview.postMessage({ command: 'saved' });
      return;
    }

    fs.writeFileSync(saveUri.fsPath, buf);
    panel.webview.postMessage({ command: 'saved' });

    const action = await vscode.window.showInformationMessage(
      `Card saved: ${path.basename(saveUri.fsPath)}`,
      'Show in Folder'
    );
    if (action === 'Show in Folder') {
      vscode.commands.executeCommand('revealFileInOS', saveUri);
    }
    panel.dispose();
  });
}
