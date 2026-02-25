const vscode = require('vscode');
const { LANGUAGE_IDS, REGEX_PATTERNS } = require('../constants');
const { mapTypeToTS, safeReadFile } = require('../utils');
const { 
    findJsFileForAlias, 
    parseJavaScriptFunctions, 
    findMatchingJsFiles, 
    isAliasImported,
    getJsImportInsertionPoint
} = require('../parser');

/**
 * Creates a completion item for a function
 * @param {Object} func - Function object with name, params, paramDocs, returnType, documentation
 * @param {string} alias - The import alias
 * @returns {vscode.CompletionItem}
 */
function createFunctionCompletionItem(func, alias) {
    const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Method);
    
    const returnTypeTS = mapTypeToTS(func.returnType);
    const paramSignature = func.paramDocs.length > 0
        ? func.paramDocs.map(p => `${p.name}: ${mapTypeToTS(p.type)}`).join(', ')
        : func.params.join(', ');
    
    // Set detail (shown next to item in list)
    item.detail = `(${paramSignature}): ${returnTypeTS}`;
    
    // Build documentation
    const docParts = [];
    if (func.returnType && func.returnType !== 'any') {
        docParts.push(`**→ Returns ${func.returnType}**\n`);
    }
    if (func.documentation) {
        docParts.push(func.documentation);
    }
    if (func.paramDocs.length > 0) {
        docParts.push('\n\n**Parameters:**');
        func.paramDocs.forEach(param => {
            docParts.push(`\n- \`${param.name}\` (${param.type}): ${param.description}`);
        });
    }
    item.documentation = new vscode.MarkdownString(docParts.join(''));
    
    // Set insert text with snippet
    item.insertText = new vscode.SnippetString(`${func.name}($0)`);
    
    // Set label with additional info
    item.label = {
        label: func.name,
        description: `→ ${func.returnType}`,
        detail: ` ${alias}`
    };
    
    return item;
}

/**
 * Creates a completion provider for QML files
 * @param {Map} jsFileCache - Cache for parsed JS files
 * @param {vscode.ExtensionContext} context - Extension context
 * @returns {vscode.Disposable}
 */
function createCompletionProvider(jsFileCache, context) {
    return vscode.languages.registerCompletionItemProvider(
        { language: LANGUAGE_IDS.QML, scheme: 'file' },
        {
            async provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                
                // Check if we're typing after an identifier followed by a dot
                const dotMatch = linePrefix.match(REGEX_PATTERNS.ALIAS_DOT_PREFIX);
                if (dotMatch) {
                    const alias = dotMatch[1];
                    const jsFilePath = findJsFileForAlias(document, alias);
                    
                    if (!jsFilePath) {
                        return undefined;
                    }
                    
                    // Check cache first
                    let functions = jsFileCache.get(jsFilePath);
                    
                    if (!functions) {
                        const jsContent = safeReadFile(jsFilePath);
                        if (!jsContent) {
                            return undefined;
                        }
                        
                        functions = parseJavaScriptFunctions(jsContent);
                        jsFileCache.set(jsFilePath, functions);
                        
                        // Watch for changes to invalidate cache
                        const watcher = vscode.workspace.createFileSystemWatcher(jsFilePath);
                        watcher.onDidChange(() => jsFileCache.delete(jsFilePath));
                        context.subscriptions.push(watcher);
                    }
                    
                    // Create completion items for each function
                    return functions.map(func => createFunctionCompletionItem(func, alias));
                }
                
                // Check if we're typing a potential import alias (not after a dot)
                const wordRange = document.getWordRangeAtPosition(position);
                if (wordRange) {
                    const word = document.getText(wordRange);
                    
                    // Only suggest imports if word is capitalized and at least 2 chars
                    if (word.length >= 2 && /^[A-Z]/.test(word)) {
                        const qmlContent = document.getText();
                        
                        // Don't suggest if already imported
                        if (isAliasImported(qmlContent, word)) {
                            return undefined;
                        }
                        
                        // Find matching JS files
                        const matches = await findMatchingJsFiles(word, document.uri.fsPath);
                        
                        if (matches.length === 0) {
                            return undefined;
                        }
                        
                        // Create completion items for import suggestions
                        return matches.map(match => {
                            const item = new vscode.CompletionItem(
                                match.alias,
                                vscode.CompletionItemKind.Module
                            );
                            
                            item.detail = `Auto-import: ${match.relativePath}`;
                            item.documentation = new vscode.MarkdownString(
                                `Import \`${match.alias}\` from \`${match.relativePath}\`\n\n` +
                                'This will add the import statement automatically.'
                            );
                            
                            // Calculate where to insert the import
                            const insertPoint = getJsImportInsertionPoint(qmlContent);
                            const insertPos = new vscode.Position(insertPoint.line, 0);
                            
                            // Create the import statement with blank lines as needed
                            let importStatement = insertPoint.needsBlankLine ? '\n' : '';
                            importStatement += `import "${match.relativePath}" as ${match.alias}\n`;
                            if (insertPoint.needsTrailingBlankLine) {
                                importStatement += '\n';
                            }
                            
                            // Use additional text edits to add the import
                            item.additionalTextEdits = [
                                vscode.TextEdit.insert(insertPos, importStatement)
                            ];
                            
                            // Replace the typed word with the alias
                            item.insertText = match.alias;
                            item.sortText = '0' + match.alias; // Sort to top
                            item.preselect = true;
                            
                            return item;
                        });
                    }
                }
                
                return undefined;
            }
        },
        '.', // Trigger completion on dot
        ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)) // A-Z
    );
}

module.exports = {
    createCompletionProvider
};
