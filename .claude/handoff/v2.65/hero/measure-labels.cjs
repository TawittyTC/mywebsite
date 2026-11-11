const { chromium } = require('playwright');
const sizes = (process.argv[2] || '320x568,360x640,360x740,375x667,390x664,390x844,414x896,430x932,600x960,768x1024,820x1180,844x390,993x700,1024x768,1100x800,1280x720,1440x900,1920x1080').split(',').map(s => s.split('x').map(Number));
const sides = (process.argv[3] || 'before,after').split(',');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of sizes) {
    for (const side of sides) {
      const port = side === 'before' ? 8971 : 8972;
      const agg = { min: {}, mean: {}, ll: 0, cut: 0, onCopy: 0, n: 0, errs: 0 }; let geo = null;
      for (const seed of [11, 222, 3333]) {
        const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', ...(w < 900 ? { hasTouch: true, isMobile: true } : {}) });
        const p = await ctx.newPage();
        p.on('pageerror', () => agg.errs++);
        await p.addInitScript((seed) => { let s = seed; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }, seed);
        await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
        await p.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
        await p.waitForTimeout(2600);
        const r = await p.evaluate(async () => {
          const R = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v)); };
          const q = s => document.querySelector(s);
          const hero = q('#hero').getBoundingClientRect(), copy = q('.hero-copy').getBoundingClientRect();
          const out = { min: {}, sum: {}, ll: 0, cut: 0, onCopy: 0, n: 0, geo: { sw: document.documentElement.scrollWidth, vw: innerWidth, heroH: Math.round(hero.height), copy: R(q('.hero-copy')), name: R(q('.hero-name')), actions: R(q('.hero-actions')), pill: R(q('.hero-actions .btn-pill')), more: R(q('.hero-actions .more')), hint: getComputedStyle(q('.hero-scroll-hint')).display !== 'none' ? R(q('.hero-scroll-hint')) : null } };
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 150));
            const ls = [...document.querySelectorAll('.hero-net-label')].map(l => ({ t: l.textContent, op: +getComputedStyle(l).opacity, r: l.getBoundingClientRect() }));
            for (const l of ls) { out.min[l.t] = Math.min(out.min[l.t] ?? 1, l.op); out.sum[l.t] = (out.sum[l.t] || 0) + l.op; }
            const vis = ls.filter(l => l.op > 0.3);
            for (let a = 0; a < vis.length; a++) for (let c = a + 1; c < vis.length; c++) { const A = vis[a].r, B = vis[c].r; if (A.right > B.left && A.left < B.right && A.bottom > B.top && A.top < B.bottom) out.ll++; }
            for (const l of vis) { if (l.r.right > hero.right - 1 || l.r.bottom > hero.bottom - 1 || l.r.left < hero.left + 1) out.cut++; if (l.r.right > copy.left && l.r.left < copy.right && l.r.bottom > copy.top && l.r.top < copy.bottom) out.onCopy++; }
            out.n++;
          }
          return out;
        });
        geo = r.geo; agg.ll += r.ll; agg.cut += r.cut; agg.onCopy += r.onCopy; agg.n += r.n;
        for (const t of Object.keys(r.min)) { agg.min[t] = Math.min(agg.min[t] ?? 1, r.min[t]); agg.mean[t] = (agg.mean[t] || 0) + r.sum[t] / r.n / 3; }
        await ctx.close();
      }
      const labs = ['CRM', 'POS', 'ASR', 'TTS', 'LLM', 'IVR'];
      console.log(`${(w + 'x' + h).padEnd(9)} ${side.padEnd(6)} copy ${geo.copy} name ${geo.name} actions ${geo.actions} sw ${geo.sw}/${geo.vw} | mean ` + labs.map(t => t + ' ' + agg.mean[t].toFixed(2)).join(' ') + ` | shown ${labs.filter(t => agg.mean[t] > 0.6).length}/6 sum ${labs.reduce((a, t) => a + agg.mean[t], 0).toFixed(2)} | label-label ${agg.ll} cut ${agg.cut} onCopy ${agg.onCopy} /${agg.n} errs ${agg.errs}`);
    }
  }
  await b.close();
})().catch(e => { console.error(String(e).slice(0, 600)); process.exit(1); });
