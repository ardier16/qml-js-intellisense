import * as vscode from 'vscode';
import { createCompletionProvider } from './providers/completion';
import { createAutoImportCodeActionProvider } from './providers/codeAction';
import { createHoverProvider } from './providers/hover';
import { createDefinitionProvider } from './providers/definition';
import { createReferenceProvider } from './providers/reference';
import { FunctionInfo } from './parser';

// ============================================================================
// Extension Lifecycle
// ============================================================================

/**
 * Activates the extension
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('QML JavaScript IntelliSense extension is now active');

    // Cache for parsed JS files
    const jsFileCache = new Map<string, FunctionInfo[]>();

    // Register all providers
    const providers = [
        createCompletionProvider(jsFileCache, context),
        createAutoImportCodeActionProvider(),
        createHoverProvider(),
        createDefinitionProvider(),
        createReferenceProvider()
    ];

    context.subscriptions.push(...providers);
}

/**
 * Deactivates the extension
 */
export function deactivate(): void {
    console.log('QML JavaScript IntelliSense extension is now deactivated');
}
