// Admin home: numbers, the problem bank and the latest submissions from every account.
import { api, session } from '../api.js';
import { esc, when, verdictClass, toast, icons, $, $$ } from '../ui.js';
import { needsLogin } from './needs-login.js';
import { open as openSubmission } from './submissions.js';
import { navigate } from '../app.js';

const LANGS = { python: 'Python', javascript: 'JavaScript' };

export async function render(app, _p, query) {
  if (!session.user) return needsLogin(app, 'the admin panel');
  if (session.user.role !== 'admin') {
    app.innerHTML = `<div class="page"><div class="card empty">The admin panel is for the admin account (admin@codearena.in).</div></div>`;
    return null;
  }
  app.innerHTML = `<div class="page"><div class="empty">Loading…</div></div>`;
  const d = await api('admin');
  let tab = query.get('tab') === 'submissions' ? 'submissions' : 'problems';

  app.innerHTML = `<div class="page">
    <div class="page-head"><div><h1>Admin</h1><p>Manage the problem bank and watch submissions come in.</p></div>
      <div style="display:flex;gap:8px"><button class="btn" id="reset-data">${icons.reset}Reset demo data</button><a class="btn btn-primary" href="/admin/problems/new" data-link>${icons.plus}New problem</a></div></div>
    <div class="kpis">
      <div class="card kpi"><span>Problems</span><b>${d.problems.length}</b></div>
      <div class="card kpi"><span>Submissions</span><b>${d.totals.submissions}</b></div>
      <div class="card kpi"><span>Last 24 hours</span><b>${d.totals.today}</b></div>
      <div class="card kpi"><span>Accepted</span><b>${d.totals.submissions ? Math.round((d.totals.accepted / d.totals.submissions) * 100) : 0}%</b></div>
    </div>
    <div class="seg" style="margin-bottom:14px" role="tablist"><button data-tab="problems">Problems</button><button data-tab="submissions">Recent submissions</button></div>
    <div id="admin-body"></div>
  </div>`;

  const draw = () => {
    $$('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const body = $('#admin-body');
    if (tab === 'problems') {
      body.innerHTML = `<div class="card table-wrap"><table class="table">
        <thead><tr><th>#</th><th>Title</th><th>Difficulty</th><th class="hide-sm">Topics</th><th class="hide-sm">Tests</th><th></th></tr></thead>
        <tbody>${d.problems.map((p) => `<tr>
          <td class="num muted">${p.number}</td>
          <td><a href="/problems/${p.id}" data-link style="font-weight:550">${esc(p.title)}</a>${p.edited ? ' <span class="tag">Edited</span>' : ''}${p.contest ? ' <span class="tag">Sprint</span>' : ''}
            <div class="phone-sub">${p.samples} sample · ${p.hidden} hidden</div></td>
          <td><span class="diff diff-${p.difficulty}">${p.difficulty}</span></td>
          <td class="hide-sm muted">${esc(p.tags.join(', '))}</td>
          <td class="hide-sm num muted">${p.samples} sample · ${p.hidden} hidden</td>
          <td style="text-align:right"><a class="btn btn-sm" href="/admin/problems/${p.id}" data-link>Edit</a></td>
        </tr>`).join('')}</tbody></table></div>`;
    } else {
      body.innerHTML = `<div class="card table-wrap"><table class="table">
        <thead><tr><th>When</th><th>Student</th><th>Problem</th><th>Verdict</th><th class="hide-sm">Language</th><th class="hide-sm">Tests</th><th class="hide-sm">Checked</th></tr></thead>
        <tbody>${d.submissions.length ? d.submissions.map((s) => `<tr class="click" data-id="${s.id}">
          <td class="muted" style="white-space:nowrap">${when(s.at)}</td><td>${esc(s.user)}</td>
          <td>${esc(s.title)}<div class="phone-sub">${LANGS[s.lang]}</div></td>
          <td class="v ${verdictClass(s.verdict)}">${esc(s.verdict)}</td>
          <td class="hide-sm">${LANGS[s.lang]}</td>
          <td class="hide-sm num muted">${s.passed}/${s.total}</td>
          <td class="hide-sm muted">${s.checkedOnServer ? 'Re-run on server' : 'Outputs checked'}</td>
        </tr>`).join('') : '<tr><td colspan="7" class="empty">No submissions yet.</td></tr>'}</tbody></table></div>`;
      $$('tr.click', body).forEach((tr) => tr.addEventListener('click', () => openSubmission(tr.dataset.id)));
    }
  };
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    history.replaceState(null, '', tab === 'problems' ? '/admin' : '/admin?tab=submissions');
    draw();
  }));
  $('#reset-data').addEventListener('click', async () => {
    if (!confirm('Reset all submissions and problem edits back to the starter data?')) return;
    await api('admin', { method: 'POST', body: { action: 'reset' } });
    toast('Demo data reset');
    navigate('/admin', { replace: true });
  });
  draw();
  return null;
}
