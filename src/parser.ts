import * as vscode from 'vscode';
import * as path from 'path';
import { REGEX_PATTERNS, MAX_JS_FILES_TO_SEARCH } from './constants';
import { resolveJsFilePath } from './utils';

export interface Import {
  file: string;
  alias: string;
}

export interface ParamDoc {
  type: string;
  name: string;
  description: string;
}

export interface JSDocInfo {
  documentation: string;
  returnType: string;
  paramDocs: ParamDoc[];
}

export interface FunctionInfo {
  name: string;
  params: string[];
  paramDocs: ParamDoc[];
  returnType: string;
  documentation: string;
}

export interface JsFileMatch {
  path: string;
  alias: string;
  relativePath: string;
}

export interface ImportInsertionPoint {
  line: number;
  needsBlankLine: boolean;
  needsTrailingBlankLine: boolean;
}

/**
 * Finds JavaScript imports in QML file content
 */
export function findJavaScriptImports(qmlContent: string): Import[] {
  const imports: Import[] = [];
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
 */
export function extractJSDoc(lines: string[], functionLineIndex: number): JSDocInfo {
  const result: JSDocInfo = {
    documentation: '',
    returnType: 'any',
    paramDocs: []
  };

  const jsdocLines: string[] = [];

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
 */
export function parseJavaScriptFunctions(jsContent: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
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
 */
export function extractAliasAndFunction(
  document: vscode.TextDocument,
  position: vscode.Position
): { alias: string; functionName: string } | null {
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
 */
export function findJsFileForAlias(document: vscode.TextDocument, alias: string): string | null {
  const qmlContent = document.getText();
  const imports = findJavaScriptImports(qmlContent);
  const jsImport = imports.find(imp => imp.alias === alias);

  if (!jsImport) {
    return null;
  }

  return resolveJsFilePath(document.uri.fsPath, jsImport.file);
}

/**
 * Generates a suggested alias name from a filename
 */
export function generateAliasFromFilename(filename: string): string {
  // Remove .js extension
  const baseName = filename.replace(/\.js$/, '');

  // Convert kebab-case or snake_case to PascalCase
  return (
    baseName
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') + 'JS'
  ); // Append 'JS' to avoid common names like "Util"
}

/**
 * Finds JS files in the workspace that might match a partial identifier
 */
export async function findMatchingJsFiles(
  partialIdentifier: string,
  documentPath: string
): Promise<JsFileMatch[]> {
  // Exclude build directories, node_modules, and other generated/ignored directories
  const jsFiles = await vscode.workspace.findFiles(
    '**/*.js',
    '{**/node_modules/**,**/build/**,**/dist/**,**/out/**,**/.git/**,**/CMakeFiles/**,**/*build-*/**,**/build-*/**,**/.vscode/**,**/.idea/**,**/*~/**}',
    MAX_JS_FILES_TO_SEARCH
  );

  const matches: JsFileMatch[] = [];
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
 */
export function isAliasImported(qmlContent: string, alias: string): boolean {
  const imports = findJavaScriptImports(qmlContent);
  return imports.some(imp => imp.alias === alias);
}

/**
 * Gets the line number of the last QML import (non-JS)
 */
export function getLastQmlImportLine(qmlContent: string): number {
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
 */
export function getLastJsImportLine(qmlContent: string): number {
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
 */
export function getJsImportInsertionPoint(qmlContent: string): ImportInsertionPoint {
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
