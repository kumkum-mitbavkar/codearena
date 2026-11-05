// Owns one worker per language and enforces the time limit. A run that passes the limit is
// stopped by terminating its worker (the only way to stop an endless loop), and a fresh worker
// is started for the next run.
const SOURCES = {
  javascript: () => new Worker('/js/workers/js-runner.js'),
  python: () => new Worker('/js/workers/py-runner.js', { type: 'module' }),
};

class LangRunner {
  constructor(lang) {
    this.lang = lang;
    this.worker = null;
    this.ready = null;
    this.listeners = new Set();
  }

  onStatus(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  status(s) { this.state = s; this.listeners.forEach((fn) => fn(s)); }

  /** Starts the worker if needed; for Python this downloads and boots the interpreter. */
  warm() {
    if (this.ready) return this.ready;
    const worker = SOURCES[this.lang]();
    this.worker = worker;
    if (this.lang === 'javascript') {
      this.ready = Promise.resolve(worker);
      this.status('ready');
      return this.ready;
    }
    this.status('loading');
    this.ready = new Promise((resolve, reject) => {
      const onMessage = (e) => {
        if (e.data.type === 'ready') { worker.removeEventListener('message', onMessage); this.status('ready'); resolve(worker); }
        if (e.data.type === 'load-error') { this.status('failed'); this.ready = null; reject(new Error(e.data.error)); }
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', () => { this.status('failed'); this.ready = null; reject(new Error('Python could not start in this browser.')); });
    });
    return this.ready;
  }

  kill() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.ready = null;
  }

  /**
   * Runs the code on each input. Resolves with { results, stop } where stop is null (finished),
   * 'error' (an exception or a compile error) or 'tle' (killed at the time limit).
   */
  async run({ code, fnName, inputs, limitMs, onResult }) {
    const worker = await this.warm();
    return new Promise((resolve) => {
      const results = [];
      let stop = null;
      const finish = () => { clearTimeout(timer); worker.removeEventListener('message', onMessage); resolve({ results, stop }); };
      const timer = setTimeout(() => {
        stop = 'tle';
        worker.removeEventListener('message', onMessage);
        this.kill();
        resolve({ results, stop });
        this.warm().catch(() => {}); // have the next worker ready for the next run
      }, limitMs);
      const onMessage = (e) => {
        const m = e.data;
        if (m.type === 'result') {
          results[m.index] = { output: m.output, error: m.error, ms: m.ms, stdout: m.stdout };
          if (m.error) stop = 'error';
          onResult?.(m.index, results[m.index]);
        } else if (m.type === 'compile-error') {
          stop = 'error';
          results[0] = { error: m.error, ms: 0, compile: true };
          finish();
        } else if (m.type === 'done') {
          finish();
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ code, fnName, inputs });
    });
  }
}

const runners = {};
export const runnerFor = (lang) => (runners[lang] ||= new LangRunner(lang));

/** Compares a produced JSON string with an expected value, ignoring spacing and 1 vs 1.0. */
export function sameOutput(produced, expected) {
  try { return JSON.stringify(JSON.parse(produced)) === JSON.stringify(expected); } catch { return false; }
}
