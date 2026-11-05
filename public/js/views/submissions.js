// Your submission history, filterable by verdict, with the code one tap away.
import { api, session } from '../api.js';
import { esc, when, fullTime, verdictClass, modal, diffPill, $, $$ } from '../ui.js';
import { codeViewer } from '../editor.js';
import { needsLogin } from './needs-login.js';

const LANGS = { python: 'Python', javascript: 'JavaScript' };
const VERDICTS = ['All', 'Accepted', 'Wrong Answer', 'Runtime Error', 'Time Limit Exceeded'];

export async function render(app) {
  if (!session.user) return needsLogin(app, 'your submissions');
  app.innerHTML = `<div class="page"><div class="empty">Loading…</div></div>`;
  const { submissions } = await api('submissions');
  let filter = 'All';

  app.innerHTML = `<div class="page">
    <div class="page-head"><div><h1>Submissions</h1><p>${submissions.length} in total · ${submissions.filter((s) => s.verdict === 'Accepted').length} accepted</p></div>
      <select class="select" id="verdict-filter" aria-label="Filter by verdict">${VERDICTS.map((v) => `<option>${v}</option>`).join('')}</select></div>
    <div class="card table-wrap"><table class="table">
      <thead><tr><th>When</th><th>Problem</th><th>Verdict</th><th class="hide-sm">Language</th><th class="hide-sm">Runtime</th><th class="hide-sm">Tests</th></tr></thead>
      <tbody id="sub-rows"></tbody></table></div>
  </div>`;

  const draw = () => {
    const rows = submissions.filter((s) => filter === 'All' || s.verdict === filter);
    $('#sub-rows').innerHTML = rows.length ? rows.map((s) => `<tr class="${s.hasCode ? 'click' : ''}" data-id="${s.id}">
      <td class="muted" title="${esc(fullTime(s.at))}" style="white-space:nowrap">${when(s.at)}</td>
      <td><a href="/problems/${s.problemId}" data-link style="font-weight:550">${esc(s.title || s.problemId)}</a>
        <div class="phone-sub">${LANGS[s.lang]}${s.runtimeMs != null ? ` · ${s.runtimeMs} ms` : ''}</div></td>
      <td class="v ${verdictClass(s.verdict)}">${esc(s.verdict)}${s.sample ? ' <span class="sample">Sample</span>' : ''}${s.contest ? ' <span class="tag">Sprint</span>' : ''}</td>
      <td class="hide-sm">${LANGS[s.lang]}</td>
      <td class="hide-sm num">${s.runtimeMs == null ? '–' : s.runtimeMs + ' ms'}</td>
      <td class="hide-sm num muted">${s.total ? `${s.passed}/${s.total}` : '–'}</td>
    </tr>`).join('') : `<tr><td colspan="6" class="empty">No ${filter === 'All' ? '' : filter.toLowerCase() + ' '}submissions yet.</td></tr>`;
    $$('#sub-rows tr.click').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      open(tr.dataset.id);
    }));
  };
  $('#verdict-filter').addEventListener('change', (e) => { filter = e.target.value; draw(); });
  draw();
  return null;
}

export async function open(id) {
  const { submission: s } = await api(`submissions?id=${encodeURIComponent(id)}`);
  const holder = document.createElement('div');
  const info = document.createElement('div');
  info.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);font-size:13px';
  info.innerHTML = `<b class="${verdictClass(s.verdict)}">${esc(s.verdict)}</b>${diffPill(s.difficulty)}<span class="muted">${LANGS[s.lang]} · ${s.total ? `${s.passed}/${s.total} tests` : ''}${s.runtimeMs != null ? ` · ${s.runtimeMs} ms` : ''} · ${esc(fullTime(s.at))}</span>`;
  const wrap = document.createElement('div');
  wrap.append(info, holder);
  modal({ title: s.title, body: wrap });
  codeViewer(holder, s.code || '', s.lang);
}
