// GET: who is signed in. POST {action: 'login', email, password} or {action: 'logout'}.
import { route, respond, readJson, checkPassword, issueCookie, clearCookie, userFrom, HttpError } from './_lib/http.js';

export default route(async (req, res) => {
  if (req.method === 'GET') return respond(res, 200, { user: userFrom(req) });
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const body = readJson(req);
  if (body.action === 'logout') {
    clearCookie(res);
    return respond(res, 200, { user: null });
  }
  const user = checkPassword(body.email, body.password);
  // a wrong password is an expected answer, not a failure, so it comes back as 200 with a message
  if (!user) return respond(res, 200, { user: null, error: 'That email and password do not match. Try the demo account below.' });
  issueCookie(res, user);
  respond(res, 200, { user });
});
