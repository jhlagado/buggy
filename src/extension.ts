import * as vscode from 'vscode';
import { Z80DebugAdapterFactory } from './adapter';

export function activate(context: vscode.ExtensionContext): void {
  const factory = new Z80DebugAdapterFactory();

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory('z80', factory)
  );
}

export function deactivate(): void {
  // Nothing to clean up
}
