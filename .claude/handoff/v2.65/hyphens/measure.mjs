// node measure.mjs <siteRoot> <out.json> [widths csv] [--mobile] [--heights=csv] [--cards=all|few]
// Opens the site at each width (reduced motion), opens every FAQ item and every
// overlay, and writes what it measured. Read-only: never edits the site.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const [root, outFile, widthsArg, ...flags] = process.argv.slice(2);
const NM = '/home/user/mywebsite/node_modules';
const { chromium } = await import(pathToFileURL(join(NM, 'playwright/index.mjs')).href);
const { startServer } = await import(pathToFileURL(join(root, 'tests/serve.mjs')).href);

const ALL = [320, 344, 360, 375, 390, 412, 430, 600, 744, 768, 820, 1024, 1280, 1440, 1920, 2560];
const widths = widthsArg && widthsArg !== 'all' ? widthsArg.split(',').map(Number) : ALL;
const mobile = flags.includes('--mobile');
const hFlag = flags.find((f) => f.startsWith('--heights='));
const heightWidths = hFlag ? hFlag.slice(10).split(',').filter(Boolean).map(Number) : [320, 360, 390, 430, 768, 1024, 1440, 1920];
const allCards = !flags.includes('--cards=few');

const ROWS = {
  skills: '#skill-scroller > .rf-cards-scroller-item',
  projects: '#scroller > .rf-cards-scroller-item',
  services: '#services .svc-grid > *',
  resumeInfo: '#resume .info-grid > .info-item',
  resumeRoles: '#resume .exp-roles > .exp-role',
  expCards: '#experience .row > [class*="col-"] > .data-box',
  expRoles: '#experience .exp-roles > .exp-role',
  expStats: '#experience .exp-stats > *',
};

const srv = await startServer(root);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const out = {};

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await document.fonts.ready;
  });
}

async function collect(page, sel, wantHeights) {
  return page.evaluate(({ sel, wantHeights }) => {
    const H = window.__hy;
    const root = sel ? document.querySelector(sel) : document.body;
    const res = { hy: H.hyphens(root), nw: H.nwFit(root), sideways: H.sideways(root), clipped: H.clipped(root, root) };
    if (sel) {
      res.panel = { sw: root.scrollWidth, cw: root.clientWidth };
      res.pokes = H.pokes(root, root);
      res.text = root.textContent.replace(/\s+/g, ' ').trim().length;
    } else {
      res.doc = { sw: document.documentElement.scrollWidth, vw: innerWidth, bodySw: document.body.scrollWidth };
      res.pokes = H.pokes(document.querySelector('main'), null).concat(H.pokes(document.querySelector('footer'), null));
    }
    if (wantHeights) res.heights = H.heights(root, root);
    return res;
  }, { sel, wantHeights });
}

async function closeSheet(page) {
  for (let i = 0; i < 4; i++) {
    const open = await page.evaluate(() => !!document.querySelector('.exp-lightbox.open, .cert-lightbox.open'));
    if (!open) {
      // closing steps history back on a timer: let it land before the next sheet opens
      await page.waitForFunction(() => !(history.state && history.state.overlay), null, { timeout: 3000 });
      await page.waitForTimeout(30);
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
  }
  throw new Error('sheet would not close');
}

async function openAllClients(page) {
  // on a phone the client stories are folded: open every one
  return page.evaluate(() => {
    let n = 0;
    document.querySelectorAll('.exp-lightbox-inner .exp-clients-folded .exp-client-section').forEach((sec) => {
      if (!sec.classList.contains('is-open')) { sec.querySelector('.exp-client-section-header').click(); n++; }
    });
    return n;
  });
}

async function run(width) {
  const height = width < 700 ? 844 : width < 1100 ? 1024 : 900;
  const page = await browser.newPage({
    viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block',
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript({ path: join(HERE, 'inpage.js') });
  await page.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
  await page.waitForFunction(() => [...document.styleSheets].some((s) => s.href && /style\.min\.css/.test(s.href)));
  const wantH = heightWidths.includes(width);
  const res = { width, height, overlays: {} };

  // the typed hero line, at the moment its first role is fully typed
  res.hero = await page.evaluate(() => new Promise((resolve) => {
    const t = document.querySelector('#hero .typed');
    const full = t.getAttribute('data-typed-items').split(',')[0].trim();
    const t0 = performance.now();
    (function poll() {
      if (t.textContent === full) {
        const role = document.querySelector('#hero .hero-role');
        resolve({ text: role.textContent.replace(/\s+/g, ' ').trim(), hy: window.__hy.hyphens(role), lines: t.getClientRects().length, roleH: role.getBoundingClientRect().height });
      } else if (performance.now() - t0 > 9000) resolve({ timeout: t.textContent });
      else setTimeout(poll, 20);
    })();
  }));

  await page.evaluate(async () => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 150));
  });
  await settle(page);
  res.page = await collect(page, null, wantH);
  res.page.rows = await page.evaluate((g) => window.__hy.rows(g), ROWS);
  res.page.bodyText = await page.evaluate(() => document.body.textContent.length);

  const sheet = async (name, opener, heightsToo) => {
    const ok = await page.evaluate(opener.fn, opener.arg);
    if (!ok) { res.overlays[name] = { missing: true }; return; }
    await page.waitForSelector('.exp-lightbox.open', { timeout: 3000 });
    const opened = await openAllClients(page);
    await settle(page);
    const r = await collect(page, '.exp-lightbox-inner', wantH && heightsToo);
    r.clientsOpened = opened;
    res.overlays[name] = r;
    await closeSheet(page);
  };

  // each experience sheet, from its card
  const exps = await page.$$eval('#experience .data-box[data-exp]', (els) => els.map((e) => e.dataset.exp));
  for (const id of exps) {
    await sheet('exp:' + id, { fn: (id) => { const c = document.querySelector(`#experience .data-box[data-exp="${id}"]`); c.click(); return true; }, arg: id }, true);
  }
  // project sheets from the cards' "+"
  const cards = await page.$$eval('#scroller > .rf-cards-scroller-item', (els) => els.map((e, i) => ({ i, exp: e.dataset.openExp || '', client: e.dataset.client || '' })));
  const seen = new Set();
  for (const c of cards) {
    if (!c.exp) continue;
    const first = !seen.has(c.exp);
    seen.add(c.exp);
    if (!first && !allCards) continue;
    await sheet(`card${c.i}:${c.exp}${c.client ? '/' + c.client : ''}`, {
      fn: (i) => { const el = document.querySelectorAll('#scroller > .rf-cards-scroller-item')[i]; const b = el.querySelector('.card-plus') || el; b.click(); return true; }, arg: c.i,
    }, first);
  }
  // the See-all list, then a row opened from it (the sheet with its Back pill)
  await sheet('seeall', { fn: () => { const b = document.querySelector('[data-proj-all]'); if (!b) return false; b.click(); return true; } }, true);
  await page.evaluate(() => document.querySelector('[data-proj-all]').click());
  await page.waitForSelector('.exp-lightbox.open .proj-row');
  await sheet('seeall>row', { fn: () => { const rows = [...document.querySelectorAll('.exp-lightbox-inner .proj-row')]; const r = rows[rows.length > 40 ? 40 : 0]; r.click(); return true; } }, false);
  await closeSheet(page);

  res.errors = errors;
  await page.close();
  return res;
}

const queue = [...widths];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const w = queue.shift();
    const t0 = Date.now();
    try { out[w] = await run(w); } catch (e) { out[w] = { width: w, fatal: String(e).slice(0, 800) }; }
    console.error(`width ${w} done in ${((Date.now() - t0) / 1000).toFixed(1)}s${out[w].fatal ? ' FATAL ' + out[w].fatal : ''}`);
  }
}));
await browser.close();
srv.server.close();
writeFileSync(outFile, JSON.stringify(out));
