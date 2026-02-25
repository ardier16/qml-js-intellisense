const vscode = require('vscode');
const { LANGUAGE_IDS } = require('../constants');
const { safeReadFile, getPositionFromIndex } = require('../utils');
const { extractAliasAndFunction, findJsFileForAlias } = require('../parser');

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

module.exports = {
    createDefinitionProvider
};
