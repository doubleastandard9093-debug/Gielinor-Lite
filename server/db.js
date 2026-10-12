// Tiny JSON-file account store (no native deps, fine for a small server).
// Writes go to a temp file then rename, so a crash never leaves half a file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data = { accounts: {} };
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* new db */ }
  data.accounts ||= {};
  let timer = null;
  const flush = () => {
    timer = null;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  };
  const key = u => u.toLowerCase();
  return {
    has: u => !!data.accounts[key(u)],
    get: u => data.accounts[key(u)] || null,
    create(u, pass) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(pass, salt, 64).toString('hex');
      data.accounts[key(u)] = { name: u, salt, hash, save: null, created: Date.now() };
      this.write();
      return data.accounts[key(u)];
    },
    check(u, pass) {
      const a = data.accounts[key(u)];
      if (!a) return null;
      const h = crypto.scryptSync(pass, a.salt, 64);
      return crypto.timingSafeEqual(h, Buffer.from(a.hash, 'hex')) ? a : null;
    },
    setSave(u, save) { const a = data.accounts[key(u)]; if (a) { a.save = save; a.saved = Date.now(); this.write(); } },
    write() { if (!timer) timer = setTimeout(flush, 500); },
    flushNow() { if (timer) clearTimeout(timer); flush(); }
  };
}
