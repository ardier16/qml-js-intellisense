import * as fs from 'fs';
import * as path from 'path';
import { TYPE_MAP } from './constants';

/**
 * Maps JSDoc types to TypeScript types
 */
export function mapTypeToTS(jsdocType: string): string {
  return TYPE_MAP[jsdocType] || 'any';
}

/**
 * Resolves a JS file path relative to a document directory
 */
export function resolveJsFilePath(documentPath: string, jsImportPath: string): string {
  const documentDir = path.dirname(documentPath);
  return path.resolve(documentDir, jsImportPath);
}

/**
 * Safely reads a file and returns its content
 */
export function safeReadFile(filePath: string): string | null {
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
 */
export function getPositionFromIndex(
  content: string,
  index: number
): { line: number; character: number } {
  const beforeMatch = content.substring(0, index);
  const lines = beforeMatch.split('\n');
  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length
  };
}
