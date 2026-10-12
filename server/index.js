// Gielinor Lite MMO server: accounts + WebSocket game server.
//   PORT (default 8787), DATA_DIR (default ./data), ALLOWED_ORIGINS (comma list, default any)
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { openDb } from './db.js';
import { createGame } from './game.js';
import { applySaveData } from '../js/save.js';
import { createSkills } from '../js/skills.js';
import { createPlayerState } from '../js/playerState.js';

const PORT = +process.env.PORT || 8787;
const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), 'data');
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_MSG = 300 * 1024;              // room for a one-time save upload
const MSGS_PER_SEC = 25;

const db = openDb(path.join(DATA_DIR, 'accounts.json'));
const game = createGame({ db, log: m => console.log(new Date().toISOString(), m) });
const tokens = new Map();                // token -> { name, exp }
const authTries = new Map();             // ip -> [timestamps]

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ ok: true, players: game.players.size, tick: game.tick })); return; }
  res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Gielinor Lite server. Connect with WebSocket.\n');
});
const wss = new WebSocketServer({ server, maxPayload: MAX_MSG, verifyClient: ({ origin }) => !ORIGINS.length || ORIGINS.includes(origin) });

function tooManyAuth(ip) {
  const now = Date.now(), list = (authTries.get(ip) || []).filter(t => now - t < 60000);
  list.push(now); authTries.set(ip, list);
  return list.length > 8;
}
function validSave(text) {
  if (typeof text !== 'string' || text.length > MAX_MSG) return false;
  return applySaveData(text, createSkills(), createPlayerState(), { mesh: { position: { x: 0, z: 0 } } });
}

wss.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  let session = null, bucket = MSGS_PER_SEC, last = Date.now(), strikes = 0;
  const reply = m => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const login = account => {
    const token = crypto.randomBytes(24).toString('hex');
    tokens.set(token, { name: account.name, exp: Date.now() + 30 * 86400e3 });
    reply({ t: 'auth', ok: true, token, name: account.name });
    session = game.join(ws, account);
  };
  ws.on('message', (buf, isBinary) => {
    const now = Date.now();
    bucket = Math.min(MSGS_PER_SEC, bucket + (now - last) / 1000 * MSGS_PER_SEC); last = now;
    if (--bucket < 0) { if (++strikes > 50) ws.close(4008, 'rate limit'); return; }
    if (isBinary) return;
    let msg; try { msg = JSON.parse(buf.toString()); } catch (e) { return; }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    if (!session) {
      if (msg.t === 'resume') {
        const tk = tokens.get(String(msg.token)); const acc = tk && tk.exp > now && db.get(tk.name);
        return acc ? login(acc) : reply({ t: 'auth', ok: false, err: 'Session expired. Please log in.' });
      }
      if (msg.t !== 'login' && msg.t !== 'register') return;
      if (tooManyAuth(ip)) return reply({ t: 'auth', ok: false, err: 'Too many tries. Wait a minute.' });
      const user = String(msg.user || '').trim(), pass = String(msg.pass || '');
      if (!game.NAME_RE.test(user)) return reply({ t: 'auth', ok: false, err: 'Names are 3-12 letters, numbers, spaces, - or _.' });
      if (pass.length < 6 || pass.length > 100) return reply({ t: 'auth', ok: false, err: 'Passwords are 6-100 characters.' });
      if (msg.t === 'register') {
        if (db.has(user)) return reply({ t: 'auth', ok: false, err: 'That name is taken.' });
        if (msg.save && !validSave(msg.save)) return reply({ t: 'auth', ok: false, err: 'That save could not be read.' });
        const acc = db.create(user, pass);
        if (msg.save) db.setSave(user, msg.save);   // one-time upload of the local save
        return login(acc);
      }
      const acc = db.check(user, pass);
      return acc ? login(acc) : reply({ t: 'auth', ok: false, err: 'Wrong name or password.' });
    }
    if (buf.length > 4096) return;            // in-game messages are small
    if (msg.t === 'logout') { for (const [k, v] of tokens) if (v.name === session.name) tokens.delete(k); game.leave(session); session = null; ws.close(1000, 'bye'); return; }
    try { game.handle(session, msg); } catch (e) { console.error('handle error', e); }
  });
  ws.on('close', () => { if (session) game.leave(session); session = null; });
  ws.on('error', () => {});
});

const shutdown = () => { game.stop(); db.flushNow(); process.exit(0); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
server.listen(PORT, () => console.log(`Gielinor server on :${PORT} (data: ${DATA_DIR})`));
