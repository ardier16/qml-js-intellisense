export const LANGUAGE_IDS = {
  QML: 'qml',
  JAVASCRIPT: 'javascript'
} as const;

export const REGEX_PATTERNS = {
  QML_JS_IMPORT: /import\s+"([^"]+\.js)"\s+as\s+(\w+)/g,
  QML_IMPORT: /^\s*import\s+(?!".*\.js")[^\n]+/,
  ALIAS_DOT_PREFIX: /(\w+)\.(\w*)$/,
  ALIAS_DOT_FUNCTION: /(\w+)\.(\w+)/,
  FUNCTION_DECLARATION: /^function\s+(\w+)\s*\((.*?)\)/,
  JSDOC_START: /\/\*\*/,
  JSDOC_END: /\*\//,
  JSDOC_DESCRIPTION: /\/\*\*\s*\n?\s*\*\s*(.+?)(?=\n\s*\*\s*@|$)/s,
  JSDOC_PARAM: /@param\s+(?:\{([^}]+)\}\s+)?(\S+)(?:\s+-\s+(.+?))?(?=\n|$)/g,
  JSDOC_RETURN: /@returns?\s+(?:\{([^}]+)\}\s+)?(.+?)(?=\n\s*\*\s*@|\*\/|$)/s
} as const;

export const TYPE_MAP: Record<string, string> = {
  string: 'string',
  number: 'number',
  int: 'number',
  double: 'number',
  boolean: 'boolean',
  bool: 'boolean',
  Object: 'any',
  Array: 'any[]',
  Function: 'Function',
  color: 'string',
  var: 'any',
  any: 'any'
};

export const MAX_QML_FILES_TO_SEARCH = 1000;
export const MAX_JS_FILES_TO_SEARCH = 500;
