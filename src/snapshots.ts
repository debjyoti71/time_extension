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

function buildCardData(range: number | 'lifetime', selectedProjects: string[] | null) {
  const data = storage.load();
  const now = new Date();
  const selectedSet = selectedProjects?.length ? new Set(selectedProjects) : null;
  const isLifetime = range === 'lifetime';

  let dateKeys: string[];
  if (isLifetime) {
    const allDays = new Set<string>();
    for (const [filePath, rec] of Object.entries(data.files)) {
      const project = getProjectFolder(filePath);
      if (isJunk(project, filePath)) { continue; }
      if (selectedSet && !selectedSet.has(project)) { continue; }
      for (const d of Object.keys(rec.dailyTotal)) { if (rec.dailyTotal[d] > 0) { allDays.add(d); } }
    }
    dateKeys = Array.from(allDays).sort();
  } else {
    dateKeys = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      dateKeys.push(isoDay(d));
    }
  }

  const from = dateKeys[0] ?? isoDay(now);
  const to = dateKeys[dateKeys.length - 1] ?? isoDay(now);
  const perProject: Record<string, number> = {};
  const perDay: Record<string, number> = {};
  for (const d of dateKeys) { perDay[d] = 0; }

  for (const [filePath, rec] of Object.entries(data.files)) {
    const project = getProjectFolder(filePath);
    if (isJunk(project, filePath)) { continue; }
    if (selectedSet && !selectedSet.has(project)) { continue; }
    for (const d of dateKeys) {
      const s = rec.dailyTotal[d] || 0;
      if (!s) { continue; }
      perDay[d] += s;
      perProject[project] = (perProject[project] || 0) + s;
    }
  }

  const totalSeconds = Object.values(perDay).reduce((a, b) => a + b, 0);
  const projects = Object.entries(perProject).sort((a, b) => b[1] - a[1]);
  const activeDays = Object.values(perDay).filter(v => v > 0).length;
  const avgPerDay = activeDays > 0 ? Math.round(totalSeconds / activeDays) : 0;

  let delta = 0;
  if (!isLifetime) {
    const days = range as number;
    let prevTotal = 0;
    for (let i = days * 2 - 1; i >= days; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dk = isoDay(d);
      for (const [filePath, rec] of Object.entries(data.files)) {
        const project = getProjectFolder(filePath);
        if (isJunk(project, filePath)) { continue; }
        if (selectedSet && !selectedSet.has(project)) { continue; }
        prevTotal += rec.dailyTotal[dk] || 0;
      }
    }
    delta = totalSeconds - prevTotal;
  }

  const chartKeys = isLifetime ? dateKeys.slice(-30) : dateKeys;
  const dailyValues = chartKeys.map(d => perDay[d] || 0);

  // Per-project daily breakdown for stacked chart (top 5 + Others)
  const topProjectNames = projects.slice(0, 5).map(p => p[0]);
  const projectDaily: Record<string, Record<string, number>> = {};
  topProjectNames.forEach(p => { projectDaily[p] = {}; });
  projectDaily['Others'] = {};

  for (const [filePath, rec] of Object.entries(data.files)) {
    const project = getProjectFolder(filePath);
    if (isJunk(project, filePath)) { continue; }
    if (selectedSet && !selectedSet.has(project)) { continue; }

    const bucket = topProjectNames.includes(project) ? project : 'Others';
    for (const d of chartKeys) {
      const s = rec.dailyTotal[d] || 0;
      if (s) { projectDaily[bucket][d] = (projectDaily[bucket][d] || 0) + s; }
    }
  }

  // Remove Others if empty
  const hasOthers = Object.keys(projectDaily['Others']).length > 0;
  if (!hasOthers) { delete projectDaily['Others']; }

  return { from, to, range, isLifetime, totalSeconds, avgPerDay, activeDays, projects, dailyValues, dateKeys: chartKeys, delta, projectDaily, hasOthers };
}

type CardData = ReturnType<typeof buildCardData>;

function buildWebviewHtml(cd: CardData): string {
  const payload = JSON.stringify(cd);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0f; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: 'Segoe UI', sans-serif; gap: 16px; padding: 24px; }
  canvas { border-radius: 16px; box-shadow: 0 24px 80px rgba(0,0,0,0.8); max-width: 100%; }
  #saveBtn { background: linear-gradient(135deg, #61afef, #c678dd); color: #fff; border: none; padding: 12px 36px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; transition: opacity 0.2s; }
  #saveBtn:hover { opacity: 0.85; }
  #saveBtn:disabled { opacity: 0.5; cursor: default; }
  #status { color: #555; font-size: 11px; }
</style>
</head><body>
<canvas id="c"></canvas>
<button id="saveBtn">&#8681;&nbsp; Save as PNG</button>
<div id="status">Rendering card…</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const cd = ${payload};

  const W = 600, SCALE = 2;
  const COLORS = ['#61afef','#98c379','#e5c07b','#e06c75','#c678dd','#56b6c2'];
  const BG      = '#0d0d14';
  const CARD_BG = '#13131f';
  const BORDER  = '#1e1e30';
  const MUTED   = '#3a3a55';
  const DIM     = '#555570';

  function fmt(secs) {
    const s = Math.max(0, Math.floor(secs));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawGradientBg(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#0d0d14');
    g.addColorStop(1, '#111120');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 20);
    ctx.fill();
  }

  function drawCard(canvas) {
    const { isLifetime, range, from, to, totalSeconds, avgPerDay, activeDays, projects, dailyValues, dateKeys, delta, projectDaily, hasOthers } = cd;
    const topProjects = projects.slice(0, 5);
    const maxDay = Math.max.apply(null, dailyValues.concat([1]));
    const deltaSign = delta >= 0 ? '+' : '-';
    const deltaColor = delta >= 0 ? '#98c379' : '#e06c75';
    const dateLabel = isLifetime ? 'Lifetime' : (typeof range === 'number' && range <= 30) ? 'Last ' + range + ' days' : from + ' \u2192 ' + to;

    // --- compute dynamic height ---
    const PAD = 36;
    const statCount = isLifetime ? 2 : 3;
    const projH = topProjects.length * 44;
    const H = 88 + 56 + 32 + 80 + 28 + 110 + 28 + (topProjects.length ? 28 + projH + 16 : 0) + 56 + PAD;

    canvas.width  = W * SCALE;
    canvas.height = H * SCALE;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // background
    drawGradientBg(ctx, 0, 0, W, H);

    // subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }

    // top accent bar
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
    accentGrad.addColorStop(0, '#61afef');
    accentGrad.addColorStop(0.5, '#c678dd');
    accentGrad.addColorStop(1, '#e06c75');
    ctx.fillStyle = accentGrad;
    roundRect(ctx, 0, 0, W, 4, 0);
    ctx.fill();

    let y = PAD;

    // --- HEADER ---
    // Extension logo (clock icon)
    ctx.beginPath();
    ctx.arc(PAD + 10, y + 10, 12, 0, Math.PI * 2);
    ctx.strokeStyle = '#61afef';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PAD + 10, y + 5); ctx.lineTo(PAD + 10, y + 10);
    ctx.moveTo(PAD + 10, y + 10); ctx.lineTo(PAD + 15, y + 13);
    ctx.strokeStyle = '#61afef';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Extension name
    ctx.font = '700 13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.letterSpacing = '1px';
    ctx.fillText('DEV TIMEKEEPER', PAD + 32, y + 14);
    ctx.letterSpacing = '0px';

    // range badge (right side)
    const badgeText = dateLabel;
    ctx.font = '600 11px "Segoe UI", sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 20;
    const badgeX = W - PAD - badgeW;
    roundRect(ctx, badgeX, y, badgeW, 22, 11);
    ctx.fillStyle = 'rgba(97,175,239,0.12)';
    ctx.fill();
    roundRect(ctx, badgeX, y, badgeW, 22, 11);
    ctx.strokeStyle = 'rgba(97,175,239,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#61afef';
    ctx.fillText(badgeText, badgeX + 10, y + 15);

    y += 44;

    // --- TOTAL TIME ---
    const totalStr = fmt(totalSeconds);
    ctx.font = '800 52px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(totalStr, PAD, y + 48);

    // glow under total
    const glowGrad = ctx.createLinearGradient(PAD, y + 50, PAD + 300, y + 50);
    glowGrad.addColorStop(0, 'rgba(97,175,239,0.15)');
    glowGrad.addColorStop(1, 'rgba(97,175,239,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(PAD, y + 52, 300, 6);

    ctx.font = '500 11px "Segoe UI", sans-serif';
    ctx.fillStyle = DIM;
    ctx.fillText('TOTAL CODING TIME', PAD, y + 68);

    y += 88;

    // --- STAT CARDS ---
    const statW = (W - PAD * 2 - (statCount - 1) * 12) / statCount;
    const stats = [
      { val: fmt(avgPerDay), label: 'AVG / ACTIVE DAY', color: '#98c379' },
      { val: String(activeDays), label: 'ACTIVE DAYS', color: '#e5c07b' },
    ];
    if (!isLifetime) {
      stats.push({ val: deltaSign + fmt(Math.abs(delta)), label: 'VS PREV PERIOD', color: deltaColor });
    }

    stats.forEach(function(stat, i) {
      const sx = PAD + i * (statW + 12);
      roundRect(ctx, sx, y, statW, 72, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fill();
      roundRect(ctx, sx, y, statW, 72, 10);
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '700 20px "Segoe UI", sans-serif';
      ctx.fillStyle = stat.color;
      ctx.textAlign = 'center';
      ctx.fillText(stat.val, sx + statW / 2, y + 30);

      ctx.font = '500 9px "Segoe UI", sans-serif';
      ctx.fillStyle = DIM;
      ctx.fillText(stat.label, sx + statW / 2, y + 52);
      ctx.textAlign = 'left';
    });

    y += 84;

    // --- BAR CHART (stacked by project) ---
    ctx.font = '500 9px "Segoe UI", sans-serif';
    ctx.fillStyle = DIM;
    ctx.fillText(isLifetime ? 'LAST 30 ACTIVE DAYS' : 'DAILY ACTIVITY', PAD, y + 10);
    y += 22;

    const chartH = 80;
    const barCount = dailyValues.length;
    const barW = Math.max(4, Math.floor((W - PAD * 2) / barCount) - 2);
    const barGap = Math.floor((W - PAD * 2 - barW * barCount) / Math.max(barCount - 1, 1));

    // Draw stacked bars
    dailyValues.forEach(function(totalV, i) {
      const bx = PAD + i * (barW + barGap);
      let stackY = y + chartH;
      const dk = dateKeys[i];

      // Draw top 5 projects
      topProjects.forEach(function(entry, pIdx) {
        const pName = entry[0];
        const pVal = projectDaily[pName][dk] || 0;
        if (pVal === 0) { return; }

        const segH = Math.max(2, Math.round((pVal / maxDay) * chartH));
        stackY -= segH;

        const color = COLORS[pIdx % COLORS.length];
        const segGrad = ctx.createLinearGradient(bx, stackY, bx, stackY + segH);
        segGrad.addColorStop(0, color);
        segGrad.addColorStop(1, color + '66');
        roundRect(ctx, bx, stackY, barW, segH, 2);
        ctx.fillStyle = segGrad;
        ctx.fill();
      });

      // Draw Others if exists
      if (hasOthers) {
        const othersVal = projectDaily['Others'][dk] || 0;
        if (othersVal > 0) {
          const segH = Math.max(2, Math.round((othersVal / maxDay) * chartH));
          stackY -= segH;

          const othersColor = '#555570';
          const segGrad = ctx.createLinearGradient(bx, stackY, bx, stackY + segH);
          segGrad.addColorStop(0, othersColor);
          segGrad.addColorStop(1, othersColor + '66');
          roundRect(ctx, bx, stackY, barW, segH, 2);
          ctx.fillStyle = segGrad;
          ctx.fill();
        }
      }
    });

    // x-axis labels
    const step = Math.ceil(barCount / 8);
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.fillStyle = DIM;
    ctx.textAlign = 'center';
    dateKeys.forEach(function(dk, i) {
      if (i % step !== 0 && i !== barCount - 1) { return; }
      const bx = PAD + i * (barW + barGap) + barW / 2;
      ctx.fillText(dk.slice(5), bx, y + chartH + 14);
    });
    ctx.textAlign = 'left';

    y += chartH + 22;

    // --- TOP PROJECTS ---
    if (topProjects.length) {
      ctx.font = '500 9px "Segoe UI", sans-serif';
      ctx.fillStyle = DIM;
      ctx.fillText('TOP PROJECTS', PAD, y + 10);
      y += 22;

      topProjects.forEach(function(entry, i) {
        const name = entry[0], secs = entry[1];
        const pct = totalSeconds > 0 ? secs / totalSeconds : 0;
        const color = COLORS[i % COLORS.length];
        const rowY = y + i * 44;

        // color dot
        ctx.beginPath();
        ctx.arc(PAD + 6, rowY + 10, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // project name
        ctx.font = '500 12px "Segoe UI", sans-serif';
        ctx.fillStyle = '#c8ccd4';
        const maxNameW = W - PAD * 2 - 80;
        let displayName = name;
        while (ctx.measureText(displayName).width > maxNameW && displayName.length > 4) {
          displayName = displayName.slice(0, -1);
        }
        if (displayName !== name) { displayName += '…'; }
        ctx.fillText(displayName, PAD + 18, rowY + 14);

        // time (right)
        ctx.font = '700 12px "Segoe UI", sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(fmt(secs), W - PAD, rowY + 14);
        ctx.textAlign = 'left';

        // progress bar
        const trackY = rowY + 22;
        roundRect(ctx, PAD, trackY, W - PAD * 2, 4, 2);
        ctx.fillStyle = BORDER;
        ctx.fill();
        if (pct > 0) {
          const fillW = Math.max(4, Math.round(pct * (W - PAD * 2)));
          const fillGrad = ctx.createLinearGradient(PAD, 0, PAD + fillW, 0);
          fillGrad.addColorStop(0, color);
          fillGrad.addColorStop(1, color + '88');
          roundRect(ctx, PAD, trackY, fillW, 4, 2);
          ctx.fillStyle = fillGrad;
          ctx.fill();
        }
      });

      y += topProjects.length * 44 + 8;
    }

    // --- FOOTER ---
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 14;

    ctx.font = '500 10px "Segoe UI", sans-serif';
    ctx.fillStyle = MUTED;
    ctx.fillText('Generated ' + new Date().toLocaleDateString(), PAD, y + 10);
  }

  const canvas = document.getElementById('c');
  try {
    drawCard(canvas);
    document.getElementById('status').textContent = 'Card ready';
    document.getElementById('saveBtn').disabled = false;
  } catch(e) {
    document.getElementById('status').textContent = 'Render error: ' + e.message;
  }

  document.getElementById('saveBtn').addEventListener('click', function() {
    document.getElementById('saveBtn').disabled = true;
    document.getElementById('status').textContent = 'Saving…';
    const png = canvas.toDataURL('image/png');
    vscode.postMessage({ command: 'saveCard', data: png });
  });

  window.addEventListener('message', function(e) {
    if (e.data.command === 'saved') {
      document.getElementById('status').textContent = 'Saved!';
    }
  });
})();
</script>
</body></html>`;
}

async function pickRangeDays(): Promise<number | 'lifetime' | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'Last 7 days',  days: 7 },
      { label: 'Last 30 days', days: 30 },
      { label: 'Lifetime',     days: -1 },
      { label: 'Custom…',      days: 0 }
    ],
    { placeHolder: 'Select range for share card' }
  );
  if (!choice) { return undefined; }
  if (choice.days === -1) { return 'lifetime'; }
  if (choice.days) { return choice.days; }
  const raw = await vscode.window.showInputBox({
    prompt: 'Number of days (1–3650)',
    validateInput: v => {
      const n = Number(v);
      return (!Number.isInteger(n) || n < 1 || n > 3650) ? 'Enter a whole number 1–3650' : undefined;
    }
  });
  return raw !== undefined ? Number(raw) : undefined;
}

async function pickProjects(range: number | 'lifetime'): Promise<string[] | null | undefined> {
  const data = storage.load();
  const now = new Date();
  const perProject: Record<string, number> = {};

  for (const [filePath, rec] of Object.entries(data.files)) {
    const project = getProjectFolder(filePath);
    if (isJunk(project, filePath)) { continue; }
    let s = 0;
    if (range === 'lifetime') {
      s = rec.total || 0;
    } else {
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        s += rec.dailyTotal[isoDay(d)] || 0;
      }
    }
    if (s) { perProject[project] = (perProject[project] || 0) + s; }
  }

  const projects = Object.entries(perProject).sort((a, b) => b[1] - a[1]);
  if (!projects.length) { return []; }

  const items: (vscode.QuickPickItem & { project?: string; isAll?: boolean })[] = [
    { label: 'All repos', isAll: true },
    ...projects.map(([p, s]) => ({ label: p, description: fmt(s), project: p }))
  ];
  const picked = await vscode.window.showQuickPick(items, { canPickMany: true, placeHolder: 'Select repos (or All)' });
  if (picked === undefined) { return undefined; }
  if (!picked.length || picked.some(p => (p as any).isAll)) { return null; }
  return picked.map(p => (p as any).project).filter(Boolean);
}

export async function generateShareCard(context: vscode.ExtensionContext): Promise<void> {
  const range = await pickRangeDays();
  if (!range) { return; }

  const projects = await pickProjects(range);
  if (projects === undefined) { return; }

  const cardData = buildCardData(range, projects);
  if (cardData.totalSeconds === 0) {
    vscode.window.showInformationMessage('No coding time recorded for this range.');
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'timekeeperCard', '⏱ Share Card', vscode.ViewColumn.One,
    { enableScripts: true }
  );
  panel.webview.html = buildWebviewHtml(cardData);

  panel.webview.onDidReceiveMessage(async msg => {
    if (msg.command !== 'saveCard') { return; }

    const base64 = (msg.data as string).replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(base64, 'base64');

    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS
    const defaultUri = vscode.Uri.file(
      path.join(fs.existsSync(downloadsDir) ? downloadsDir : os.homedir(), `timekeeper-${stamp}.png`)
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
