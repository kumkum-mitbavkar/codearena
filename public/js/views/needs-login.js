// Shown in place of a page that needs an account.
export function needsLogin(app, what) {
  app.innerHTML = `<div class="page"><div class="card empty" style="padding:48px 20px">
    <h2 style="margin:0 0 6px;color:var(--ink);font-size:18px">Sign in to see ${what}</h2>
    <p style="margin:0 0 16px">Use the demo student account to try it in one tap.</p>
    <a class="btn btn-primary" href="/login?next=${encodeURIComponent(location.pathname)}" data-link>Sign in</a>
  </div></div>`;
  return null;
}
