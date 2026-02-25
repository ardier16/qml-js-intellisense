import * as vscode from 'vscode';
import { LANGUAGE_IDS, MAX_QML_FILES_TO_SEARCH } from '../constants';
import { resolveJsFilePath } from '../utils';
import { findJavaScriptImports } from '../parser';

/**
 * Creates a reference provider for JavaScript files
 */
export function createReferenceProvider(): vscode.Disposable {
    return vscode.languages.registerReferenceProvider(
        { language: LANGUAGE_IDS.QML, scheme: 'file' },
        {
            async provideReferences(
                document: vscode.TextDocument,
                position: vscode.Position,
                _context: vscode.ReferenceContext
            ): Promise<vscode.Location[] | undefined> {
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
                
                const locations: vscode.Location[] = [];
                
                // Search for references in QML files
                // Exclude build directories, node_modules, and other generated/ignored directories
                const qmlFiles = await vscode.workspace.findFiles(
                    '**/*.qml',
                    '{**/node_modules/**,**/build/**,**/dist/**,**/out/**,**/.git/**,**/CMakeFiles/**,**/*build-*/**,**/build-*/**,**/.vscode/**,**/.idea/**}',
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
