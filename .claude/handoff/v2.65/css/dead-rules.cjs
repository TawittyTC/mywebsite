const { chromium } = require('playwright');
const fs = require('fs');
const html = fs.readFileSync('/home/user/mywebsite/index.html', 'utf8');
const js = fs.readFileSync('/home/user/mywebsite/assets/js/main.js', 'utf8');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })).newPage();
  await p.goto('http://127.0.0.1:8972/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  const rules = await p.evaluate(() => {
    const out = [];
    const sheet = [...document.styleSheets].find(s => s.href && /style\.min\.css/.test(s.href));
    const walk = (list, media) => { for (const r of list) { if (r.cssRules && r.type !== 1) walk(r.cssRules, (media ? media + ' / ' : '') + (r.conditionText || r.name || '@')); else if (r.selectorText) out.push({ sel: r.selectorText, len: r.cssText.length, media: media || '' }); } };
    walk(sheet.cssRules, '');
    return out;
  });
  const used = (tok) => html.includes(tok) || js.includes(tok);
  let deadBytes = 0; const dead = [];
  for (const r of rules) {
    const parts = r.sel.split(/,(?![^(]*\))/).map(s => s.trim());
    const deadParts = parts.filter(s => {
      const toks = [...s.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map(m => m[1]);
      return toks.some(t => !used(t));
    });
    if (deadParts.length === parts.length) { dead.push(r); deadBytes += r.len; }
    else if (deadParts.length) dead.push({ ...r, partial: deadParts.join(', '), len: 0 });
  }
  console.log('rules', rules.length, 'fully dead', dead.filter(d => !d.partial).length, 'approx bytes (expanded cssText)', deadBytes);
  for (const d of dead.filter(d => !d.partial).sort((a, b) => b.len - a.len).slice(0, 60)) console.log(String(d.len).padStart(5), d.media ? '[' + d.media.slice(0, 40) + ']' : '', d.sel.slice(0, 150));
  console.log('--- selector lists with a dead member');
  for (const d of dead.filter(d => d.partial).slice(0, 25)) console.log('   ', d.partial.slice(0, 120), ' IN ', d.sel.slice(0, 80));
  await b.close();
})();
