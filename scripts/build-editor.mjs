// Bundles CodeMirror into one ES module and copies the Pyodide runtime next to it,
// so the deployed site has no build step and no CDN dependency.
//   npm run build:editor
import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

await build({
  entryPoints: ['scripts/editor-entry.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  outfile: 'public/vendor/codemirror.js',
  legalComments: 'none',
});

const files = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
await mkdir('public/vendor/pyodide', { recursive: true });
for (const f of files) await cp(`node_modules/pyodide/${f}`, `public/vendor/pyodide/${f}`);
console.log('editor bundle and pyodide copied');
