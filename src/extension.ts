import * as vscode from 'vscode';
import * as tracker from './tracker';
import * as statusBar from './statusBar';
import * as dashboard from './dashboard';
import * as snapshots from './snapshots';
import * as storage from './storage';

export function activate(context: vscode.ExtensionContext): void {
  tracker.activate(context);
  statusBar.activate(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('timetracker.showDashboard', () => {
      dashboard.show(context);
    }),
    vscode.commands.registerCommand('timetracker.shareCard', () => snapshots.generateShareCard(context)),
    vscode.commands.registerCommand('timetracker.reset', async () => {
      const ok = await vscode.window.showWarningMessage(
        'Reset all tracked time data? This deletes your local data.json.',
        { modal: true },
        'Reset'
      );
      if (ok === 'Reset') {
        storage.resetAll();
        statusBar.refresh();
        vscode.window.showInformationMessage('Time Tracker data reset.');
      }
    })
  );
}

export function deactivate(): void {
  tracker.deactivate();
  statusBar.deactivate();
}
