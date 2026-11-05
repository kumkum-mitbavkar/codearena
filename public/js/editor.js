// CodeMirror 6 set up for solving: syntax highlighting, auto-indent, bracket matching,
// autocomplete, search, and a theme read from CSS variables so light and dark both follow the app.
import {
  EditorView, EditorState, Compartment, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, highlightSpecialChars, rectangularSelection, crosshairCursor,
  defaultKeymap, history, historyKeymap, indentWithTab, indentOnInput, bracketMatching, foldGutter, foldKeymap,
  syntaxHighlighting, HighlightStyle, indentUnit, closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap,
  searchKeymap, highlightSelectionMatches, python, javascript, tags as t,
} from '/vendor/codemirror.js';

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: 'var(--tk-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--tk-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--tk-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--tk-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName))], color: 'var(--tk-fn)' },
  { tag: [t.definition(t.variableName), t.variableName], color: 'var(--tk-def)' },
  { tag: [t.className, t.typeName, t.standard(t.variableName), t.self], color: 'var(--tk-type)' },
  { tag: [t.propertyName], color: 'var(--tk-def)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--tk-op)' },
]);

const languages = { python: () => python(), javascript: () => javascript() };
const units = { python: '    ', javascript: '  ' };

export function createEditor(parent, { doc, lang, onChange, onRun, onSubmit, readOnly = false }) {
  const langSlot = new Compartment();
  const indentSlot = new Compartment();
  const runKeys = keymap.of([
    { key: 'Mod-Enter', run: () => { onRun?.(); return true; } },
    { key: 'Mod-Shift-Enter', run: () => { onSubmit?.(); return true; } },
  ]);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        runKeys,
        lineNumbers(), highlightActiveLineGutter(), foldGutter(), highlightSpecialChars(), history(), drawSelection(), dropCursor(),
        EditorState.allowMultipleSelections.of(true), indentOnInput(), bracketMatching(), closeBrackets(), autocompletion(),
        rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(),
        syntaxHighlighting(highlight),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
        langSlot.of(languages[lang]()),
        indentSlot.of(indentUnit.of(units[lang])),
        EditorState.tabSize.of(lang === 'python' ? 4 : 2),
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange?.(u.state.doc.toString()); }),
        EditorView.contentAttributes.of({ 'aria-label': 'Code editor', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
      ],
    }),
  });
  return {
    view,
    get value() { return view.state.doc.toString(); },
    set(doc, newLang) {
      const effects = [];
      if (newLang) {
        effects.push(langSlot.reconfigure(languages[newLang]()), indentSlot.reconfigure(indentUnit.of(units[newLang])));
      }
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc }, effects });
    },
    focus() { view.focus(); },
    destroy() { view.destroy(); },
  };
}

/** A small read-only viewer for past submissions. */
export function codeViewer(parent, code, lang) {
  return createEditor(parent, { doc: code, lang, readOnly: true });
}
