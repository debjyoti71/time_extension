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
      const confirm = await vscode.window.showInputBox({
        prompt: 'Type RESET to permanently delete all tracked time data',
        placeHolder: 'RESET',
        validateInput: v => (v === 'RESET' ? undefined : 'Type exactly RESET to confirm')
      });
      if (confirm !== 'RESET') { return; }
      storage.resetAll();
      statusBar.refresh();
      vscode.window.showInformationMessage('Time Tracker data reset.');
    })
  );
}

export function deactivate(): void {
  tracker.deactivate();
  statusBar.deactivate();
}
