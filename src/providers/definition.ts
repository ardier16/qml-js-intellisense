import * as vscode from 'vscode';
import { LANGUAGE_IDS } from '../constants';
import { safeReadFile, getPositionFromIndex } from '../utils';
import { extractAliasAndFunction, findJsFileForAlias } from '../parser';

/**
 * Creates a definition provider for QML files
 */
export function createDefinitionProvider(): vscode.Disposable {
    return vscode.languages.registerDefinitionProvider(
        { language: LANGUAGE_IDS.QML, scheme: 'file' },
        {
            provideDefinition(
                document: vscode.TextDocument,
                position: vscode.Position
            ): vscode.Location | undefined {
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
