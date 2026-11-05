// Everything the app needs from CodeMirror 6, bundled once into public/vendor/codemirror.js
export { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
export { EditorState, Compartment } from '@codemirror/state';
export { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
export { indentOnInput, bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language';
export { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
export { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
export { python } from '@codemirror/lang-python';
export { javascript } from '@codemirror/lang-javascript';
export { tags } from '@lezer/highlight';
