import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function respond(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

/** Runs a handler, retrying saves that lost a race, and turns errors into JSON responses. */
export function route(handler) {
  return async (req, res) => {
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          return await handler(req, res);
        } catch (err) {
          if (err.status !== 409 || attempt >= 3 || res.headersSent) throw err;
        }
      }
    } catch (err) {
      if (err.status && err.status < 500) return respond(res, err.status, { error: err.message });
      console.error(err);
      respond(res, 500, { error: 'Something went wrong on the server.' });
    }
  };
}

// ---- accounts and sessions ----
// Two fixed demo accounts. Passwords are stored as scrypt hashes, never as text.
const USERS = {
  'student@codearena.in': { name: 'Aditi Patil', handle: 'aditi_codes', role: 'student', college: 'Gogte College, Belagavi', hash: 'scrypt$0861e0dfe120a8431a353b7cfca328c2$0715e8d8811da245be79c65f9746504811c3b687354f10987a8fadc6742212a9' },
  'admin@codearena.in': { name: 'Placement Cell', handle: 'placement_cell', role: 'admin', college: 'CodeArena staff', hash: 'scrypt$50be0e9b0614cc79e8f6726d232c8399$7e1ffde8fa335667f537e654cc61f86d60fb7ee66c14f070df7a8f0d821c13ea' },
};

const COOKIE = 'ca_sid';
const secret = () => process.env.SESSION_SECRET || 'codearena-local-dev';
const secure = () => (process.env.VERCEL ? '; Secure' : '');

export function publicUser(email) {
  const u = USERS[email];
  return u ? { email, name: u.name, handle: u.handle, role: u.role, college: u.college } : null;
}

export function checkPassword(email, password) {
  const key = String(email || '').trim().toLowerCase();
  const user = USERS[key];
  if (!user || !password) return null;
  const [, salt, hash] = user.hash.split('$');
  const got = crypto.scryptSync(String(password), Buffer.from(salt, 'hex'), 32);
  return crypto.timingSafeEqual(got, Buffer.from(hash, 'hex')) ? publicUser(key) : null;
}

export function issueCookie(res, user) {
  const body = Buffer.from(JSON.stringify({ email: user.email, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  res.setHeader('Set-Cookie', `${COOKIE}=${body}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure()}`);
}

export function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure()}`);
}

export function userFrom(req) {
  const pair = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  if (!pair) return null;
  const [body, sig] = pair.slice(COOKIE.length + 1).split('.');
  const check = crypto.createHmac('sha256', secret()).update(body || '').digest('base64url');
  if (!sig || sig.length !== check.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(check))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.exp > Date.now() ? publicUser(data.email) : null;
  } catch { return null; }
}

export function requireUser(req) {
  const user = userFrom(req);
  if (!user) throw new HttpError(401, 'Please sign in first.');
  return user;
}

export function requireAdmin(req) {
  const user = requireUser(req);
  if (user.role !== 'admin') throw new HttpError(403, 'Only the admin account can do this.');
  return user;
}
