// Runs a Python solution with Pyodide (CPython compiled to WebAssembly), entirely in the browser.
// Loaded as a module worker; the page kills it when a run passes the time limit.
import { loadPyodide } from '/vendor/pyodide/pyodide.mjs';

const HARNESS = `
import json, sys, io, time, traceback

_ca_fn = None

def _ca_where(tb):
    frames = [f for f in traceback.extract_tb(tb) if f.filename == 'solution.py']
    return f" (line {frames[-1].lineno})" if frames else ""

def _ca_load(code, name):
    global _ca_fn
    ns = {'__name__': '__main__'}
    try:
        exec(compile(code, 'solution.py', 'exec'), ns)
    except SyntaxError as e:
        return f"SyntaxError: {e.msg} (line {e.lineno})"
    except Exception as e:
        return f"{type(e).__name__}: {e}{_ca_where(e.__traceback__)}"
    _ca_fn = ns.get(name)
    if not callable(_ca_fn):
        return f"NameError: name '{name}' is not defined. Keep the function name from the starter code."
    return ""

def _ca_run(args_json):
    args = json.loads(args_json)
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    t0 = time.perf_counter()
    try:
        value = _ca_fn(*args)
        ms = (time.perf_counter() - t0) * 1000
        try:
            out = json.dumps(value, separators=(',', ':'), ensure_ascii=False)
        except (TypeError, ValueError):
            return json.dumps({'error': f"TypeError: the function returned a {type(value).__name__}. Return a list, number, string or bool.", 'ms': ms, 'stdout': buf.getvalue()[-4000:]})
        return json.dumps({'output': out, 'ms': ms, 'stdout': buf.getvalue()[-4000:]})
    except RecursionError:
        ms = (time.perf_counter() - t0) * 1000
        return json.dumps({'error': 'RecursionError: maximum recursion depth exceeded', 'ms': ms, 'stdout': buf.getvalue()[-4000:]})
    except Exception as e:
        ms = (time.perf_counter() - t0) * 1000
        return json.dumps({'error': f"{type(e).__name__}: {e}{_ca_where(e.__traceback__)}", 'ms': ms, 'stdout': buf.getvalue()[-4000:]})
    finally:
        sys.stdout = old
`;

const ready = loadPyodide({ indexURL: '/vendor/pyodide/' }).then((py) => {
  py.runPython(HARNESS);
  self.postMessage({ type: 'ready' });
  return py;
}).catch((err) => {
  self.postMessage({ type: 'load-error', error: String(err && err.message || err) });
});

self.onmessage = async (event) => {
  const py = await ready;
  if (!py) return;
  const { code, fnName, inputs } = event.data;
  const problem = py.globals.get('_ca_load')(code, fnName);
  if (problem) {
    self.postMessage({ type: 'compile-error', error: problem });
    return;
  }
  const run = py.globals.get('_ca_run');
  for (let i = 0; i < inputs.length; i++) {
    const payload = JSON.stringify(inputs[i]);
    const t0 = performance.now();
    const r = JSON.parse(run(payload));
    // the browser clock is finer than Python's inside WebAssembly, so time the call from here
    const elapsed = performance.now() - t0;
    self.postMessage({ type: 'result', index: i, ...r, ms: Math.max(r.ms, elapsed) });
    if (r.error) break;
  }
  self.postMessage({ type: 'done' });
};
