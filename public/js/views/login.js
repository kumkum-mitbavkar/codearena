// Sign in, with the two demo accounts one tap away.
import { api, session } from '../api.js';
import { toast, $, $$ } from '../ui.js';
import { navigate } from '../app.js';

const DEMOS = [
  { label: 'Student', email: 'student@codearena.in', note: 'solve, submit, compete' },
  { label: 'Admin', email: 'admin@codearena.in', note: 'add problems and tests' },
];

export async function render(app, _params, query) {
  const next = query.get('next') || '/';
  if (session.user) { navigate(next, { replace: true }); return null; }
  app.innerHTML = `<div class="auth"><div class="card auth-card">
    <h1>Sign in to CodeArena</h1>
    <p class="muted" style="margin:0">Your submissions, streak and sprint score are saved to your account.</p>
    <form id="login-form" novalidate>
      <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="username" required placeholder="you@college.in"></label>
      <label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
      <div class="form-error" id="login-error" hidden></div>
      <button class="btn btn-primary btn-block" type="submit" style="height:40px">Sign in</button>
    </form>
    <div class="demo-box">
      <p>Demo accounts, password <code>demo1234</code></p>
      ${DEMOS.map((d) => `<div class="demo-row"><div><b>${d.label}</b> <span class="muted">· ${d.note}</span><br><code>${d.email}</code></div>
        <button class="btn btn-sm" data-demo="${d.email}">Use</button></div>`).join('')}
    </div>
  </div></div>`;

  const form = $('#login-form');
  const signIn = async (email, password) => {
    const errBox = $('#login-error');
    errBox.hidden = true;
    try {
      const { user, error } = await api('auth', { method: 'POST', body: { action: 'login', email, password } });
      if (!user) throw new Error(error);
      session.user = user;
      toast(`Signed in as ${user.name}`);
      navigate(next.startsWith('/') ? next : '/', { replace: true });
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
    }
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email || !form.password.value) { $('#login-error').textContent = 'Enter your email and password.'; $('#login-error').hidden = false; return; }
    signIn(email, form.password.value);
  });
  $$('[data-demo]').forEach((b) => b.addEventListener('click', () => {
    form.email.value = b.dataset.demo;
    form.password.value = 'demo1234';
    signIn(b.dataset.demo, 'demo1234');
  }));
  return null;
}

