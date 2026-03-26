import * as vscode from 'vscode';
import * as tracker from './tracker';
import * as statusBar from './statusBar';
import * as dashboard from './dashboard';

export function activate(context: vscode.ExtensionContext): void {
  tracker.activate(context);
  statusBar.activate(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('timetracker.showDashboard', () => {
      dashboard.show(context);
    })
  );
}

export function deactivate(): void {
  tracker.deactivate();
  statusBar.deactivate();
}
