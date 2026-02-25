const vscode = require('vscode');
const { LANGUAGE_IDS } = require('../constants');
const { safeReadFile } = require('../utils');
const { extractAliasAndFunction, findJsFileForAlias, parseJavaScriptFunctions } = require('../parser');

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

module.exports = {
    createHoverProvider
};
