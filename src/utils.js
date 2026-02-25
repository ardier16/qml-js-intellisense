const fs = require('fs');
const path = require('path');
const { TYPE_MAP } = require('./constants');

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

module.exports = {
    mapTypeToTS,
    resolveJsFilePath,
    safeReadFile,
    getPositionFromIndex
};
