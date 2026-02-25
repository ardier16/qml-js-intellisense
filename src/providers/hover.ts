import * as vscode from 'vscode';
import { LANGUAGE_IDS } from '../constants';
import { safeReadFile } from '../utils';
import {
  FunctionInfo,
  extractAliasAndFunction,
  findJsFileForAlias,
  parseJavaScriptFunctions
} from '../parser';

/**
 * Creates hover markdown for a function
 */
function createFunctionHoverMarkdown(func: FunctionInfo, alias: string): string {
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
 */
export function createHoverProvider(): vscode.Disposable {
  return vscode.languages.registerHoverProvider(
    { language: LANGUAGE_IDS.QML, scheme: 'file' },
    {
      provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
      ): vscode.Hover | undefined {
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
