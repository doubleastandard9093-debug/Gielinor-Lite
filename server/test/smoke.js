// Headless protocol test: two clients, movement validation, shared tree depletion, shared monster kill.
import WebSocket from 'ws';
import { NODES, MONSTER_SPAWNS } from '../world.js';
const URL = process.env.URL || 'ws://localhost:8787';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function client(name) {
  const ws = new WebSocket(URL); const c = { ws, name, msgs: [], snap: null, self: null, logs: [] };
  ws.on('message', b => { const m = JSON.parse(b); c.msgs.push(m); if (m.t === 'snap') c.snap = m; if (m.t === 'self') c.self = m; if (m.t === 'log') c.logs.push(m.text); if (m.t === 'welcome') c.welcome = m; if (m.t === 'pos') c.pos = m; });
  c.send = m => ws.send(JSON.stringify(m));
  c.open = new Promise(r => ws.on('open', r));
  return c;
}
async function walk(c, x0, z0, x1, z1) { // walk at legal speed
  const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.8);
  for (let i = 1; i <= steps; i++) { c.send({ t: 'move', x: x0 + (x1 - x0) * i / steps, z: z0 + (z1 - z0) * i / steps, run: true }); await sleep(150); }
}
const ok = (cond, label) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) process.exitCode = 1; };
const tag = Date.now() % 100000;
const A = client('A'), B = client('B');
await Promise.all([A.open, B.open]);
A.send({ t: 'register', user: 'ta' + tag, pass: 'secret1' }); B.send({ t: 'register', user: 'tb' + tag, pass: 'secret1' });
await sleep(800);
ok(A.welcome && B.welcome, 'both logged in');
await sleep(700);
ok(A.snap.players.some(p => p.name === 'tb' + tag), 'A sees B');
// teleport attempt is clamped
A.send({ t: 'move', x: 100, z: 100 }); await sleep(300);
ok(A.pos && Math.hypot(A.pos.x - 100, A.pos.z - 100) > 50, 'teleport rejected');
// chat
A.send({ t: 'chat', text: 'hello <b>world</b>' }); await sleep(300);
ok(B.msgs.some(m => m.t === 'chat' && m.text === 'hello bworld/b'), 'chat delivered + sanitised');
// tree
const tree = NODES.filter(n => n.type === 'tree' && n.kind === 'Tree' || n.type === 'tree' && /^Tree/.test(n.name)).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
console.log('tree', tree.id, tree.name, tree.x.toFixed(1), tree.z.toFixed(1));
const ax = A.pos.x, az = A.pos.z;
await walk(A, ax, az, tree.x + 1, tree.z);
A.send({ t: 'gather', id: tree.id });
let fell = false;
for (let i = 0; i < 120 && !fell; i++) { await sleep(300); fell = B.msgs.some(m => m.t === 'snap' && m.nodes.some(([id, al]) => id === tree.id && !al)); }
ok(A.self.p.inventory.Logs > 0, 'A got logs from server: ' + A.self.p.inventory.Logs + ', WC xp ' + A.self.skills.Woodcutting.xp.toFixed(0));
ok(fell, 'tree depletion seen by B');
// goblin
const gob = MONSTER_SPAWNS.find(m => m.name === 'Goblin');
const mx = A.snap.mons.find(m => m[0] === gob.id) || [gob.id, gob.spawnX, gob.spawnZ];
const ap = { x: tree.x + 1, z: tree.z };
await walk(A, ap.x, ap.z, mx[1] + 0.8, mx[2]);
await walk(B, 1, 1, mx[1] - 0.8, mx[2]);
A.send({ t: 'equip', item: 'Bronze sword' });
A.send({ t: 'attack', id: gob.id });
let dead = false;
for (let i = 0; i < 100 && !dead; i++) {
  await sleep(300);
  const m = A.snap.mons.find(q => q[0] === gob.id);
  if (m) A.send({ t: 'move', x: m[1] + 0.8, z: m[2], run: true });
  dead = B.snap.mons.some(q => q[0] === gob.id && !q[5]);
}
ok(dead, 'goblin death seen by B');
ok(A.logs.some(t => /defeated the Goblin/.test(t)), 'A credited with kill');
ok(A.self.skills.Attack.xp > 0, 'A attack xp ' + A.self.skills.Attack.xp.toFixed(0));
const logs = A.self.p.inventory.Logs;
A.send({ t: 'logout' }); await sleep(800);
const A2 = client('A2'); await A2.open; A2.send({ t: 'login', user: 'ta' + tag, pass: 'secret1' }); await sleep(800);
ok(A2.welcome && JSON.parse(A2.welcome.save).player.inventory.Logs === logs, 'progress kept after relogin');
const A3 = client('A3'); await A3.open; A3.send({ t: 'login', user: 'ta' + tag, pass: 'wrongpw' }); await sleep(500);
ok(A3.msgs.some(m => m.t === 'auth' && !m.ok), 'wrong password rejected');
process.exit();
