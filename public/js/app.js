// App shell: header, theme, bottom tabs on phones, and a small history-based router.
import { session, loadSession, api } from './api.js';
import { esc, icons, initials, $, toast } from './ui.js';

const routes = [
  [/^\/$/, () => import('./views/landing.js')],
  [/^\/problems\/?$/, () => import('./views/home.js')],
  [/^\/problems\/([a-z0-9-]+)\/?$/, () => import('./views/problem.js')],
  [/^\/contest\/?$/, () => import('./views/contest.js')],
  [/^\/submissions\/?$/, () => import('./views/submissions.js')],
  [/^\/profile\/?$/, () => import('./views/profile.js')],
  [/^\/admin\/?$/, () => import('./views/admin.js')],
  [/^\/admin\/problems\/(new|[a-z0-9-]+)\/?$/, () => import('./views/admin-edit.js')],
  [/^\/login\/?$/, () => import('./views/login.js')],
];

let cleanup = null;
let renderId = 0;

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
  render();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('ca-theme', theme); } catch { /* private mode */ }
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0e0f11' : '#f7f7f5';
  drawHeader();
}
const currentTheme = () => document.documentElement.dataset.theme || 'dark';

function navLinks() {
  const links = [['/problems', 'Problems'], ['/contest', 'Contest'], ['/submissions', 'Submissions'], ['/profile', 'Profile']];
  if (session.user?.role === 'admin') links.push(['/admin', 'Admin']);
  return links;
}
const isActive = (href) => (href === '/' ? location.pathname === '/' : location.pathname.startsWith(href));

export function drawHeader() {
  const u = session.user;
  const dark = currentTheme() === 'dark';
  $('#top').innerHTML = `
    <a class="brand" href="/" data-link><span class="brand-mark">${icons.logo}</span>CodeArena</a>
    <nav class="nav" aria-label="Main">${navLinks().map(([href, label]) => `<a href="${href}" data-link class="${isActive(href) ? 'active' : ''}">${label}</a>`).join('')}</nav>
    <div class="top-right">
      <button class="icon-btn" id="theme-btn" aria-label="Switch to ${dark ? 'light' : 'dark'} theme" title="Switch theme">${dark ? icons.sun : icons.moon}</button>
      ${u ? `<div class="user-menu">
        <button id="user-btn" aria-label="Account menu" aria-haspopup="true"><span class="avatar">${esc(initials(u.name))}</span></button>
        <div class="menu" id="user-menu" role="menu">
          <div class="who"><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div>
          <a href="/profile" data-link role="menuitem">Profile</a>
          <a href="/submissions" data-link role="menuitem">My submissions</a>
          ${u.role === 'admin' ? '<a href="/admin" data-link role="menuitem">Admin</a>' : ''}
          <button id="logout-btn" role="menuitem">Sign out</button>
        </div></div>`
      : `<a class="btn btn-sm btn-primary" href="/login?next=${encodeURIComponent(location.pathname)}" data-link>Sign in</a>`}
    </div>`;
  const tabs = [['/', 'Home', icons.home], ['/problems', 'Problems', icons.list], ['/contest', 'Contest', icons.trophy], ['/submissions', 'History', icons.clock], [u?.role === 'admin' ? '/admin' : '/profile', u?.role === 'admin' ? 'Admin' : 'Profile', icons.user]];
  $('#tabbar').innerHTML = tabs.map(([href, label, icon]) => `<a href="${href}" data-link class="${isActive(href) ? 'active' : ''}">${icon}<span>${label}</span></a>`).join('');

  $('#theme-btn').onclick = () => setTheme(dark ? 'light' : 'dark');
  const btn = $('#user-btn');
  if (btn) {
    btn.onclick = (e) => { e.stopPropagation(); $('#user-menu').classList.toggle('open'); };
    $('#logout-btn').onclick = async () => {
      await api('auth', { method: 'POST', body: { action: 'logout' } });
      session.user = null;
      toast('Signed out');
      navigate('/');
    };
  }
}

async function render() {
  const id = ++renderId;
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  const path = location.pathname;
  const match = routes.find(([re]) => re.test(path));
  document.body.classList.toggle('in-ws', /^\/problems\/[^/]+/.test(path));
  document.body.classList.toggle('on-landing', path === '/');
  drawHeader();
  const app = $('#app');
  if (!match) {
    app.innerHTML = `<div class="page"><div class="empty"><h1>Page not found</h1><p>That page doesn't exist. <a href="/problems" data-link style="color:var(--accent-text)">Back to problems</a></p></div></div>`;
    return;
  }
  const params = path.match(match[0]).slice(1);
  const view = await match[1]();
  if (id !== renderId) return; // a newer navigation won
  app.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = await view.render(app, params, new URLSearchParams(location.search));
}

document.addEventListener('click', (e) => {
  const menu = $('#user-menu');
  if (menu && !e.target.closest('.user-menu')) menu.classList.remove('open');
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  e.preventDefault();
  navigate(a.getAttribute('href'));
});
window.addEventListener('popstate', render);

loadSession().then(render);
