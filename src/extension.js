const { createCompletionProvider } = require('./providers/completion');
const { createAutoImportCodeActionProvider } = require('./providers/codeAction');
const { createHoverProvider } = require('./providers/hover');
const { createDefinitionProvider } = require('./providers/definition');
const { createReferenceProvider } = require('./providers/reference');

// ============================================================================
// Extension Lifecycle
// ============================================================================

/**
 * Activates the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('QML JavaScript IntelliSense extension is now active');

    // Cache for parsed JS files
    const jsFileCache = new Map();

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
function deactivate() {
    console.log('QML JavaScript IntelliSense extension is now deactivated');
}

module.exports = {
    activate,
    deactivate
};
