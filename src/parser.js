const vscode = require('vscode');
const path = require('path');
const { REGEX_PATTERNS, MAX_JS_FILES_TO_SEARCH } = require('./constants');
const { resolveJsFilePath } = require('./utils');

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
// Auto-Import Helpers
// ============================================================================

/**
 * Generates a suggested alias name from a filename
 * @param {string} filename - JS filename (e.g., "utils.js", "account-helper.js")
 * @returns {string} Suggested alias (e.g., "Utils", "AccountHelper")
 */
function generateAliasFromFilename(filename) {
    // Remove .js extension
    const baseName = filename.replace(/\.js$/, '');
    
    // Convert kebab-case or snake_case to PascalCase
    return baseName
        .split(/[-_]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('') + 'JS'; // Append 'JS' to avoid common names like "Util"
}

/**
 * Finds JS files in the workspace that might match a partial identifier
 * @param {string} partialIdentifier - The identifier being typed
 * @returns {Promise<Array<{path: string, alias: string, relativePath: string}>>}
 */
async function findMatchingJsFiles(partialIdentifier, documentPath) {
    // Exclude build directories, node_modules, and other generated/ignored directories
    const jsFiles = await vscode.workspace.findFiles(
        '**/*.js',
        '{**/node_modules/**,**/build/**,**/dist/**,**/out/**,**/.git/**,**/CMakeFiles/**,**/*build-*/**,**/build-*/**,**/.vscode/**,**/.idea/**,**/*~/**}',
        MAX_JS_FILES_TO_SEARCH
    );
    
    const matches = [];
    const documentDir = path.dirname(documentPath);
    
    for (const file of jsFiles) {
        const filename = path.basename(file.fsPath);
        const suggestedAlias = generateAliasFromFilename(filename);
        
        // Check if the suggested alias matches the partial identifier (case-insensitive)
        if (suggestedAlias.toLowerCase().startsWith(partialIdentifier.toLowerCase())) {
            const relativePath = path.relative(documentDir, file.fsPath);
            matches.push({
                path: file.fsPath,
                alias: suggestedAlias,
                relativePath: relativePath.startsWith('.') ? relativePath : './' + relativePath
            });
        }
    }
    
    return matches;
}

/**
 * Checks if an alias is already imported in the document
 * @param {string} qmlContent - QML document content
 * @param {string} alias - Alias to check
 * @returns {boolean}
 */
function isAliasImported(qmlContent, alias) {
    const imports = findJavaScriptImports(qmlContent);
    return imports.some(imp => imp.alias === alias);
}

/**
 * Gets the line number of the last QML import (non-JS)
 * @param {string} qmlContent - QML document content
 * @returns {number} Line number (0-indexed) or -1 if no imports
 */
function getLastQmlImportLine(qmlContent) {
    const lines = qmlContent.split('\n');
    let lastImportLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
        if (REGEX_PATTERNS.QML_IMPORT.test(lines[i])) {
            lastImportLine = i;
        }
    }
    
    return lastImportLine;
}

/**
 * Gets the line number of the last JS import statement
 * @param {string} qmlContent - QML document content
 * @returns {number} Line number (0-indexed) or -1 if no imports
 */
function getLastJsImportLine(qmlContent) {
    const lines = qmlContent.split('\n');
    let lastImportLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
        if (REGEX_PATTERNS.QML_JS_IMPORT.test(lines[i])) {
            lastImportLine = i;
        }
    }
    
    return lastImportLine;
}

/**
 * Calculates where to insert a JS import statement
 * JS imports should go after all QML imports, with a blank line separator
 * @param {string} qmlContent - QML document content
 * @returns {{line: number, needsBlankLine: boolean, needsTrailingBlankLine: boolean}}
 */
function getJsImportInsertionPoint(qmlContent) {
    const lines = qmlContent.split('\n');
    const lastJsImport = getLastJsImportLine(qmlContent);
    const lastQmlImport = getLastQmlImportLine(qmlContent);
    
    // If there are already JS imports, insert after the last one
    if (lastJsImport >= 0) {
        const insertLine = lastJsImport + 1;
        // Check if there's already a blank line after the last JS import
        const hasTrailingBlankLine = insertLine < lines.length && lines[insertLine].trim() === '';
        return { 
            line: insertLine, 
            needsBlankLine: false,
            needsTrailingBlankLine: !hasTrailingBlankLine
        };
    }
    
    // If there are QML imports but no JS imports, insert after QML imports with blank line
    if (lastQmlImport >= 0) {
        // Check if there's already a blank line after the last QML import
        const nextLine = lastQmlImport + 1;
        const hasBlankLine = nextLine < lines.length && lines[nextLine].trim() === '';
        return { 
            line: hasBlankLine ? lastQmlImport + 2 : lastQmlImport + 1, 
            needsBlankLine: !hasBlankLine,
            needsTrailingBlankLine: true
        };
    }
    
    // No imports at all, insert at the beginning
    // Check if first line has content
    const hasContent = lines.length > 0 && lines[0].trim() !== '';
    return { 
        line: 0, 
        needsBlankLine: false,
        needsTrailingBlankLine: hasContent
    };
}

module.exports = {
    findJavaScriptImports,
    extractJSDoc,
    parseJavaScriptFunctions,
    extractAliasAndFunction,
    findJsFileForAlias,
    generateAliasFromFilename,
    findMatchingJsFiles,
    isAliasImported,
    getLastQmlImportLine,
    getLastJsImportLine,
    getJsImportInsertionPoint
};
