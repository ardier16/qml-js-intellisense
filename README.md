# QML JavaScript IntelliSense

Enhanced IntelliSense, navigation, and code completion for JavaScript imports in QML files with JSDoc support.

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Extension-blue)](https://marketplace.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Perfect for Qt/QML developers working with JavaScript modules in their QML applications.

## Features

- ✅ **Auto-Import** - Type a capitalized identifier (e.g., `Utils`) and get automatic import suggestions
- ✅ Autocomplete for JavaScript functions imported with `import "file.js" as Name`
- ✅ Function signature hints
- ✅ JSDoc documentation on hover
- ✅ Parameter information from JSDoc comments
- ✅ Return type information
- ✅ **Go to Definition** - Click function name (or press F12) to jump to JS file
- ✅ **Peek Definition** - Press Alt+F12 to peek at function definition
- ✅ **Find All References** - From JS file, find all QML usages (Shift+F12)

## Usage

### Auto-Import

Start typing a capitalized identifier (like `Utils`, `AccountHelper`, etc.) and the extension will automatically suggest importing matching JavaScript files:

```qml
// Start typing "Util" and you'll see import suggestions
Util  // <-- Suggestions appear for utils.js, utility.js, etc.
```

When you select an import suggestion, it automatically adds the import statement:

```qml
import "./utils.js" as Utils  // <-- Auto-added

Utils.  // <-- Now get function completions
```

### Function Completion

When you import a JavaScript file in QML:

```qml
import "util.js" as UtilJS
```

Type `UtilJS.` and you'll see all available functions with:
- Function signatures
- Parameter names and types from JSDoc
- Documentation
- Return types

### Navigation:
- **Cmd+Click** (or F12) on `UtilJS.functionName` to jump to definition in JS file
- **Alt+F12** to peek at the definition inline
- In the JS file, right-click a function → **Find All References** to see all QML usages

## How it works

The extension:
1. Detects `import "*.js" as Name` patterns in QML files
2. Parses the JavaScript file to extract functions and JSDoc
3. Provides IntelliSense when you type the imported alias

## Requirements

Your JavaScript files should have JSDoc comments for best results:

```javascript
/**
 * Gets the display name for an account
 * @param {Object} account - Account object
 * @returns {string} Account display name
 */
function accountName(account) {
    // ...
}
```

## Installation

### From VSIX
1. Download the latest `.vsix` file
2. Open VS Code
3. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
4. Type "Install from VSIX" and select the file

### From Source
```bash
cd qml-js-intellisense
npm install -g vsce
vsce package
code --install-extension qml-js-intellisense-1.0.0.vsix
```

## Supported Features

| Feature | Supported |
|---------|-----------|
| Autocomplete | ✅ |
| Signature Help | ✅ |
| Hover Documentation | ✅ |
| Go to Definition | ✅ |
| Peek Definition | ✅ |
| Find All References | ✅ |
| JSDoc Parsing | ✅ |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the [MIT License](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details on changes and updates.