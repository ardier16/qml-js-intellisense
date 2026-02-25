# Change Log

All notable changes to the "QML JavaScript IntelliSense" extension will be documented in this file.

## [1.1.0] - 2026-02-25

### Added
- **Auto-Import Feature**: Type a capitalized identifier (e.g., `Utils`) and get automatic import suggestions
- Intelligent filename-to-alias conversion (e.g., `util.js` → `UtilJS`)
- Quick Fix code actions for adding missing imports (lightbulb icon)
- Support for up to 500 JS files in workspace for auto-import suggestions

## [1.0.0] - 2026-02-25

### Added
- Initial release
- IntelliSense and autocomplete for JavaScript imports in QML files
- Function signature hints with parameter information
- JSDoc documentation on hover
- Go to Definition support (F12 or Cmd+Click)
- Peek Definition support (Alt+F12)
- Find All References support (Shift+F12)
- Automatic parsing of JSDoc comments for type and documentation information
- Support for `import "file.js" as Name` pattern in QML files

### Features
- Real-time code completion for imported JavaScript modules
- Parameter type information from JSDoc @param tags
- Return type information from JSDoc @returns tags
- Bidirectional navigation between QML and JavaScript files
- Reference finding from JavaScript files to QML usages
