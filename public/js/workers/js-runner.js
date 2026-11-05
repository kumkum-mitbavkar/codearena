// Runs a JavaScript solution against a list of inputs, one test at a time, and reports each
// result as it finishes. The page kills this worker if the time limit passes.
const show = (v) => {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
};

self.onmessage = (event) => {
  const { code, fnName, inputs } = event.data;
  const logs = [];
  const fakeConsole = {};
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) fakeConsole[k] = (...a) => { if (logs.length < 200) logs.push(a.map(show).join(' ')); };

  let fn;
  try {
    fn = new Function('console', `${code}\n;return typeof ${fnName} === 'function' ? ${fnName} : undefined;`)(fakeConsole);
  } catch (err) {
    self.postMessage({ type: 'compile-error', error: `${err.name}: ${err.message}` });
    return;
  }
  if (!fn) {
    self.postMessage({ type: 'compile-error', error: `ReferenceError: ${fnName} is not defined. Keep the function name from the starter code.` });
    return;
  }

  for (let i = 0; i < inputs.length; i++) {
    logs.length = 0;
    const args = structuredClone(inputs[i]);
    const t0 = performance.now();
    try {
      const value = fn(...args);
      const ms = performance.now() - t0;
      self.postMessage({ type: 'result', index: i, output: JSON.stringify(value === undefined ? null : value), ms, stdout: logs.join('\n') });
    } catch (err) {
      const ms = performance.now() - t0;
      const message = err && err.message ? `${err.name || 'Error'}: ${err.message}` : String(err);
      self.postMessage({ type: 'result', index: i, error: message, ms, stdout: logs.join('\n') });
      break;
    }
  }
  self.postMessage({ type: 'done' });
};
