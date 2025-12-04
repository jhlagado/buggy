import * as vscode from 'vscode';
import { TinyCpuDebugAdapterFactory } from './adapter';

export function activate(context: vscode.ExtensionContext): void {
  const factory = new TinyCpuDebugAdapterFactory();

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory('tinycpu', factory)
  );
}

export function deactivate(): void {
  // Nothing to clean up
}
