const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Constants
// ============================================================================

const LANGUAGE_IDS = {
    QML: 'qml',
    JAVASCRIPT: 'javascript'
};

const REGEX_PATTERNS = {
    QML_JS_IMPORT: /import\s+"([^"]+\.js)"\s+as\s+(\w+)/g,
    ALIAS_DOT_PREFIX: /(\w+)\.(\w*)$/,
    ALIAS_DOT_FUNCTION: /(\w+)\.(\w+)/,
    FUNCTION_DECLARATION: /^function\s+(\w+)\s*\((.*?)\)/,
    JSDOC_START: /\/\*\*/,
    JSDOC_END: /\*\//,
    JSDOC_DESCRIPTION: /\/\*\*\s*\n?\s*\*\s*(.+?)(?=\n\s*\*\s*@|$)/s,
    JSDOC_PARAM: /@param\s+(?:\{([^}]+)\}\s+)?(\S+)(?:\s+-\s+(.+?))?(?=\n|$)/g,
    JSDOC_RETURN: /@returns?\s+(?:\{([^}]+)\}\s+)?(.+?)(?=\n\s*\*\s*@|\*\/|$)/s
};

const TYPE_MAP = {
    'string': 'string',
    'number': 'number',
    'int': 'number',
    'double': 'number',
    'boolean': 'boolean',
    'bool': 'boolean',
    'Object': 'any',
    'Array': 'any[]',
    'Function': 'Function',
    'color': 'string',
    'var': 'any',
    'any': 'any'
};

const MAX_QML_FILES_TO_SEARCH = 1000;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Maps JSDoc types to TypeScript types
 * @param {string} jsdocType - JSDoc type string
 * @returns {string} Corresponding TypeScript type
 */
function mapTypeToTS(jsdocType) {
    return TYPE_MAP[jsdocType] || 'any';
}

/**
 * Resolves a JS file path relative to a document directory
 * @param {string} documentPath - The QML document path
 * @param {string} jsImportPath - The relative JS import path
 * @returns {string} Absolute path to the JS file
 */
function resolveJsFilePath(documentPath, jsImportPath) {
    const documentDir = path.dirname(documentPath);
    return path.resolve(documentDir, jsImportPath);
}

/**
 * Safely reads a file and returns its content
 * @param {string} filePath - Path to the file
 * @returns {string|null} File content or null if error
 */
function safeReadFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return null;
    }
}

/**
 * Calculates line and character position from string index
 * @param {string} content - File content
 * @param {number} index - Character index
 * @returns {{line: number, character: number}}
 */
function getPositionFromIndex(content, index) {
    const beforeMatch = content.substring(0, index);
    const lines = beforeMatch.split('\n');
    return {
        line: lines.length - 1,
        character: lines[lines.length - 1].length
    };
}

// ============================================================================
// QML/JavaScript Parsing
// ============================================================================

/**
 * Finds JavaScript imports in QML file content
 * @param {string} qmlContent - Content of the QML file
 * @returns {Array<{alias: string, file: string}>} Array of import objects
 */
function findJavaScriptImports(qmlContent) {
    const imports = [];
    const matches = qmlContent.matchAll(REGEX_PATTERNS.QML_JS_IMPORT);
    
    for (const match of matches) {
        imports.push({
            file: match[1],
            alias: match[2]
        });
    }
    
    return imports;
}

/**
 * Extracts JSDoc information from lines preceding a function
 * @param {string[]} lines - All file lines
 * @param {number} functionLineIndex - Index of the function declaration line
 * @returns {{documentation: string, returnType: string, paramDocs: Array}}
 */
function extractJSDoc(lines, functionLineIndex) {
    const result = {
        documentation: '',
        returnType: 'any',
        paramDocs: []
    };
    
    const jsdocLines = [];
    
    // Scan backwards to find JSDoc end
    let j = functionLineIndex - 1;
    while (j >= 0 && lines[j].trim() !== '' && !REGEX_PATTERNS.JSDOC_END.test(lines[j])) {
        j--;
    }
    
    // Collect JSDoc lines if found
    if (j >= 0 && REGEX_PATTERNS.JSDOC_END.test(lines[j])) {
        let k = j;
        while (k >= 0 && !REGEX_PATTERNS.JSDOC_START.test(lines[k])) {
            jsdocLines.unshift(lines[k]);
            k--;
        }
        if (k >= 0 && REGEX_PATTERNS.JSDOC_START.test(lines[k])) {
            jsdocLines.unshift(lines[k]);
        }
        
        const jsdocContent = jsdocLines.join('\n');
        
        // Extract description
        const descMatch = jsdocContent.match(REGEX_PATTERNS.JSDOC_DESCRIPTION);
        if (descMatch) {
            result.documentation = descMatch[1].replace(/\n\s*\*\s*/g, ' ').trim();
        }
        
        // Extract @param tags
        const paramMatches = jsdocContent.matchAll(REGEX_PATTERNS.JSDOC_PARAM);
        for (const match of paramMatches) {
            result.paramDocs.push({
                type: match[1] || 'any',
                name: match[2],
                description: match[3] || ''
            });
        }
        
        // Extract @returns/@return tag
        const returnMatch = jsdocContent.match(REGEX_PATTERNS.JSDOC_RETURN);
        if (returnMatch) {
            result.returnType = returnMatch[1] || 'any';
        }
    }
    
    return result;
}

/**
 * Parses a JavaScript file to extract function names and JSDoc comments
 * @param {string} jsContent - Content of the JS file
 * @returns {Array<{name: string, params: Array<string>, paramDocs: Array, returnType: string, documentation: string}>}
 */
function parseJavaScriptFunctions(jsContent) {
    const functions = [];
    const lines = jsContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match function declarations
        const functionMatch = line.match(REGEX_PATTERNS.FUNCTION_DECLARATION);
        if (!functionMatch) continue;
        
        const functionName = functionMatch[1];
        const params = functionMatch[2]
            .split(',')
            .map(p => p.trim())
            .filter(p => p);
        
        // Extract JSDoc information
        const jsdoc = extractJSDoc(lines, i);
        
        functions.push({
            name: functionName,
            params: params,
            paramDocs: jsdoc.paramDocs,
            returnType: jsdoc.returnType,
            documentation: jsdoc.documentation
        });
    }
    
    return functions;
}

/**
 * Extracts alias and function name from a qualified function call
 * @param {vscode.TextDocument} document - The document
 * @param {vscode.Position} position - The cursor position
 * @returns {{alias: string, functionName: string}|null}
 */
function extractAliasAndFunction(document, position) {
    const wordRange = document.getWordRangeAtPosition(position, REGEX_PATTERNS.ALIAS_DOT_FUNCTION);
    if (!wordRange) {
        return null;
    }
    
    const fullWord = document.getText(wordRange);
    const match = fullWord.match(REGEX_PATTERNS.ALIAS_DOT_FUNCTION);
    
    if (!match) {
        return null;
    }
    
    return {
        alias: match[1],
        functionName: match[2]
    };
}

/**
 * Finds the JavaScript file path for a given alias in a QML document
 * @param {vscode.TextDocument} document - The QML document
 * @param {string} alias - The import alias
 * @returns {string|null} Absolute path to JS file or null
 */
function findJsFileForAlias(document, alias) {
    const qmlContent = document.getText();
    const imports = findJavaScriptImports(qmlContent);
    const jsImport = imports.find(imp => imp.alias === alias);
    
    if (!jsImport) {
        return null;
    }
    
    return resolveJsFilePath(document.uri.fsPath, jsImport.file);
}

// ============================================================================
// Completion Item Helpers
// ============================================================================

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
 * Creates hover markdown for a function
 * @param {Object} func - Function object
 * @param {string} alias - The import alias
 * @returns {string} Markdown string
 */
function createFunctionHoverMarkdown(func, alias) {
    const paramSignature = func.params.join(', ');
    let markdown = `**${alias}.${func.name}**(${paramSignature}): ${func.returnType}\n\n`;
    
    if (func.documentation) {
        markdown += func.documentation + '\n\n';
    }
    
    if (func.paramDocs.length > 0) {
        markdown += '**Parameters:**\n';
        func.paramDocs.forEach(param => {
            markdown += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
        });
    }
    
    return markdown;
}

// ============================================================================
// Language Feature Providers
// ============================================================================

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
            provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);
                
                // Check if we're typing after an identifier followed by a dot
                const match = linePrefix.match(REGEX_PATTERNS.ALIAS_DOT_PREFIX);
                if (!match) {
                    return undefined;
                }
                
                const alias = match[1];
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
        },
        '.' // Trigger completion on dot
    );
}

/**
 * Creates a hover provider for QML files
 * @returns {vscode.Disposable}
 */
function createHoverProvider() {
    return vscode.languages.registerHoverProvider(
        { language: LANGUAGE_IDS.QML, scheme: 'file' },
        {
            provideHover(document, position) {
                const extracted = extractAliasAndFunction(document, position);
                if (!extracted) {
                    return undefined;
                }
                
                const { alias, functionName } = extracted;
                const jsFilePath = findJsFileForAlias(document, alias);
                
                if (!jsFilePath) {
                    return undefined;
                }
                
                const jsContent = safeReadFile(jsFilePath);
                if (!jsContent) {
                    return undefined;
                }
                
                const functions = parseJavaScriptFunctions(jsContent);
                const func = functions.find(f => f.name === functionName);
                
                if (!func) {
                    return undefined;
                }
                
                const markdown = createFunctionHoverMarkdown(func, alias);
                return new vscode.Hover(new vscode.MarkdownString(markdown));
            }
        }
    );
}

/**
 * Creates a definition provider for QML files
 * @returns {vscode.Disposable}
 */
function createDefinitionProvider() {
    return vscode.languages.registerDefinitionProvider(
        { language: LANGUAGE_IDS.QML, scheme: 'file' },
        {
            provideDefinition(document, position) {
                const extracted = extractAliasAndFunction(document, position);
                if (!extracted) {
                    return undefined;
                }
                
                const { alias, functionName } = extracted;
                const jsFilePath = findJsFileForAlias(document, alias);
                
                if (!jsFilePath) {
                    return undefined;
                }
                
                const jsContent = safeReadFile(jsFilePath);
                if (!jsContent) {
                    return undefined;
                }
                
                // Find the function definition in the JS file
                const functionRegex = new RegExp(`function\\s+${functionName}\\s*\\(`, 'g');
                const funcMatch = functionRegex.exec(jsContent);
                
                if (!funcMatch) {
                    return undefined;
                }
                
                // Calculate the position
                const pos = getPositionFromIndex(jsContent, funcMatch.index);
                const targetUri = vscode.Uri.file(jsFilePath);
                const targetPosition = new vscode.Position(pos.line, pos.character);
                
                return new vscode.Location(targetUri, targetPosition);
            }
        }
    );
}

/**
 * Creates a reference provider for JavaScript files
 * @returns {vscode.Disposable}
 */
function createReferenceProvider() {
    return vscode.languages.registerReferenceProvider(
        { language: LANGUAGE_IDS.QML, scheme: 'file' },
        {
            async provideReferences(document, position, context) {
                // Check if we're in a JS file at a function definition
                if (document.languageId !== LANGUAGE_IDS.JAVASCRIPT && !document.fileName.endsWith('.js')) {
                    return undefined;
                }
                
                const wordRange = document.getWordRangeAtPosition(position);
                if (!wordRange) {
                    return undefined;
                }
                
                const functionName = document.getText(wordRange);
                const line = document.lineAt(position.line).text;
                
                // Check if this is a function definition
                if (!line.match(new RegExp(`function\\s+${functionName}\\s*\\(`))) {
                    return undefined;
                }
                
                const locations = [];
                
                // Search for references in QML files
                const qmlFiles = await vscode.workspace.findFiles(
                    '**/*.qml',
                    '**/node_modules/**',
                    MAX_QML_FILES_TO_SEARCH
                );
                
                for (const qmlFile of qmlFiles) {
                    try {
                        const qmlDoc = await vscode.workspace.openTextDocument(qmlFile);
                        const qmlContent = qmlDoc.getText();
                        
                        // Find imports that reference this JS file
                        const imports = findJavaScriptImports(qmlContent);
                        const relevantImport = imports.find(imp => {
                            const importPath = resolveJsFilePath(qmlFile.fsPath, imp.file);
                            return importPath === document.fileName;
                        });
                        
                        if (relevantImport) {
                            // Find all usages of alias.functionName
                            const usageRegex = new RegExp(
                                `${relevantImport.alias}\\.${functionName}\\b`,
                                'g'
                            );
                            const lines = qmlContent.split('\n');
                            
                            lines.forEach((lineText, lineIndex) => {
                                let match;
                                while ((match = usageRegex.exec(lineText)) !== null) {
                                    const startPos = new vscode.Position(
                                        lineIndex,
                                        match.index + relevantImport.alias.length + 1
                                    );
                                    const endPos = new vscode.Position(
                                        lineIndex,
                                        match.index + match[0].length
                                    );
                                    const range = new vscode.Range(startPos, endPos);
                                    locations.push(new vscode.Location(qmlFile, range));
                                }
                            });
                        }
                    } catch (error) {
                        // Skip files that can't be read
                        console.error(`Error processing QML file ${qmlFile.fsPath}:`, error);
                    }
                }
                
                return locations;
            }
        }
    );
}

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
