import * as vscode from 'vscode';
import * as path from 'path';
import { LANGUAGE_IDS } from '../constants';
import { findMatchingJsFiles, isAliasImported, getJsImportInsertionPoint } from '../parser';

/**
 * Creates a code action provider for auto-import suggestions
 */
export function createAutoImportCodeActionProvider(): vscode.Disposable {
  return vscode.languages.registerCodeActionsProvider(
    { language: LANGUAGE_IDS.QML, scheme: 'file' },
    {
      async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        _context: vscode.CodeActionContext
      ): Promise<vscode.CodeAction[]> {
        const wordRange = document.getWordRangeAtPosition(range.start);
        if (!wordRange) {
          return [];
        }

        const word = document.getText(wordRange);

        // Only suggest for capitalized identifiers
        if (!/^[A-Z]/.test(word)) {
          return [];
        }

        const qmlContent = document.getText();

        // Don't suggest if already imported
        if (isAliasImported(qmlContent, word)) {
          return [];
        }

        // Check if word is used with a dot (like Util.something)
        const line = document.lineAt(range.start.line).text;
        const wordIndex = line.indexOf(word);
        if (wordIndex >= 0 && line[wordIndex + word.length] === '.') {
          // Find matching JS files
          const matches = await findMatchingJsFiles(word, document.uri.fsPath);

          if (matches.length === 0) {
            return [];
          }

          // Create code actions for each match
          return matches.map(match => {
            const action = new vscode.CodeAction(
              `Import '${match.alias}' from ${path.basename(match.relativePath)}`,
              vscode.CodeActionKind.QuickFix
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

            const edit = new vscode.WorkspaceEdit();
            edit.insert(document.uri, insertPos, importStatement);

            action.edit = edit;
            action.isPreferred = matches.indexOf(match) === 0;

            return action;
          });
        }

        return [];
      }
    }
  );
}
