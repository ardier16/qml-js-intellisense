# Source Code Structure

This directory contains the refactored source code for the QML JavaScript IntelliSense extension.

## File Organization

### Core Modules

- **constants.js** - Exports all constants used throughout the extension:
  - `LANGUAGE_IDS` - Language identifiers for QML and JavaScript
  - `REGEX_PATTERNS` - Regular expressions for parsing QML/JS code
  - `TYPE_MAP` - JSDoc to TypeScript type mappings
  - `MAX_QML_FILES_TO_SEARCH`, `MAX_JS_FILES_TO_SEARCH` - Search limits

- **utils.js** - Utility functions:
  - `mapTypeToTS()` - Maps JSDoc types to TypeScript types
  - `resolveJsFilePath()` - Resolves relative JS file paths
  - `safeReadFile()` - Safely reads files with error handling
  - `getPositionFromIndex()` - Converts string index to line/character position

- **parser.js** - Parsing and import management:
  - `findJavaScriptImports()` - Extracts JS imports from QML content
  - `extractJSDoc()` - Parses JSDoc comments
  - `parseJavaScriptFunctions()` - Extracts function definitions from JS files
  - `extractAliasAndFunction()` - Parses alias.function patterns
  - `findJsFileForAlias()` - Resolves JS file path from import alias
  - `generateAliasFromFilename()` - Generates import alias suggestions
  - `findMatchingJsFiles()` - Searches workspace for matching JS files
  - `isAliasImported()` - Checks if an alias is already imported
  - `getLastQmlImportLine()`, `getLastJsImportLine()` - Finds last import lines
  - `getJsImportInsertionPoint()` - Calculates where to insert new imports

### Provider Modules (`providers/`)

- **completion.js** - Auto-completion provider:
  - Provides function completions after typing `Alias.`
  - Suggests auto-imports for capitalized identifiers
  - Shows JSDoc documentation and parameter info

- **codeAction.js** - Quick fix code action provider:
  - Suggests auto-imports when using undefined aliases
  - Automatically inserts import statements

- **hover.js** - Hover information provider:
  - Shows function signature and documentation on hover
  - Displays JSDoc parameter and return type information

- **definition.js** - Go-to-definition provider:
  - Navigates from `Alias.functionName` to function definition in JS file

- **reference.js** - Find-all-references provider:
  - Finds all usages of a JS function across QML files

### Entry Point

- **extension.js** - Main extension entry point:
  - Exports `activate()` and `deactivate()` functions
  - Registers all language feature providers
  - Manages JS file cache for performance

## Module Dependencies

```
extension.js
├── providers/completion.js
│   ├── constants.js
│   ├── utils.js
│   └── parser.js
├── providers/codeAction.js
│   ├── constants.js
│   └── parser.js
├── providers/hover.js
│   ├── constants.js
│   ├── utils.js
│   └── parser.js
├── providers/definition.js
│   ├── constants.js
│   ├── utils.js
│   └── parser.js
└── providers/reference.js
    ├── constants.js
    ├── utils.js
    └── parser.js

parser.js
├── constants.js
└── utils.js

utils.js
└── constants.js
```

## Design Principles

1. **Separation of Concerns** - Each module has a single, well-defined responsibility
2. **Reusability** - Common utilities and parsers are shared across providers
3. **Maintainability** - Clear module boundaries make it easy to locate and modify code
4. **Testability** - Pure functions are easy to unit test in isolation
