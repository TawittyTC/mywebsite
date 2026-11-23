// The hero's opening: one line draws a sound wave, runs on as a transit line
// through the six stops, is reeled into gears of three sizes, and the gears
// let go into the constellation. It never covers the copy, any input skips
// it, and Reduce Motion, a phone on its side and a relayout never see it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, styled, inkCount } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

const MAC = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SIDEWAYS = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/**
 * Watches the canvas from before the page's own script: the opening is the
 * only drawing that sets a round line cap, so a frame that set one is a frame
 * of the opening. Keeps the first and last such frame's time, how many there
 * were, and the circles drawn in the latest one (the gears' rims among them).
 */
const probe = () => {
  const P = (window.__intro = { frames: 0, first: null, last: null, arcs: [] });
  const proto = CanvasRenderingContext2D.prototype;
  const cap = Object.getOwnPropertyDescriptor(proto, 'lineCap');
  let round = false, arcs = [];
  Object.defineProperty(proto, 'lineCap', {
    set(v) { if (v === 'round') round = true; cap.set.call(this, v); },
    get() { return cap.get.call(this); },
  });
  const arc = proto.arc;
  proto.arc = function (x, y, r, ...rest) { arcs.push([x, y, r]); return arc.call(this, x, y, r, ...rest); };
  const tick = (ts) => {
    if (round) { P.frames++; if (P.first === null) P.first = ts; P.last = ts; P.arcs = arcs; }
    round = false; arcs = [];
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/** A page with third-party requests cut off and a repeatable Math.random, opened once style.css applies. */
async function open(opts, seed = 11) {
  const page = await ctx.browser.newPage({ serviceWorkers: 'block', ...opts });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route((u) => !u.href.startsWith(ctx.srv.url), (r) => r.abort());
  await page.addInitScript((s0) => {
    let s = s0;
    Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  }, seed);
  await page.addInitScript(probe);
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(styled, null, { timeout: 8000 });
  return { page, errors };
}

const until = (page, ms) => page.waitForFunction((t) => performance.now() > t, ms, { timeout: ms + 20000 });
const intro = (page) => page.evaluate(() => ({ ...window.__intro, arcs: undefined, now: performance.now() }));
const labelsShown = (page) => page.$$eval('.hero-net-label', (ls) => ls.filter((l) => +l.style.opacity > 0.9).map((l) => l.textContent).sort());
const SIX = ['ASR', 'CRM', 'IVR', 'LLM', 'POS', 'TTS'];
/** The opening has stopped: no frame of it for 300 ms. */
const over = (page) => page.waitForFunction(() => window.__intro.last !== null && performance.now() - window.__intro.last > 300, null, { timeout: 15000 });

/** Painted canvas pixels inside the copy block's own box. */
const inkOverCopy = () => {
  const c = document.getElementById('hero-net'), hero = document.getElementById('hero');
  if (!c.width) return 0;
  const hr = hero.getBoundingClientRect(), r = document.querySelector('.hero-copy').getBoundingClientRect(), k = c.width / hr.width;
  const d = c.getContext('2d').getImageData(Math.round((r.left - hr.left) * k), Math.round((r.top - hr.top) * k),
    Math.round(r.width * k), Math.round(r.height * k)).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
  return n;
};

/** The six largest circles of the latest opening frame, one per centre: the gears' rims, largest first. */
const rims = () => {
  const by = new Map();
  for (const [x, y, r] of window.__intro.arcs) {
    const k = Math.round(x) + ',' + Math.round(y);
    by.set(k, Math.max(by.get(k) || 0, r));
  }
  return [...by.values()].sort((a, b) => b - a).slice(0, 6).map((r) => +r.toFixed(1));
};

test('the opening plays once, for about 7 s on a desktop and 5.6 s on a phone, and ends on the graph with all six labels', async () => {
  for (const [where, opts, lo, hi] of [['Mac', MAC, 6400, 7600], ['iPhone', PHONE, 5000, 6200]]) {
    const { page, errors } = await open(opts);
    await until(page, 1500);
    const mid = await intro(page);
    assert.ok(mid.frames > 10, `${where}: no opening in the first 1.5 s (${mid.frames} frames)`);
    assert.ok(mid.first < 1200, `${where}: the opening starts ${Math.round(mid.first)} ms in`);
    await over(page);
    const end = await intro(page);
    const ran = end.last - end.first;
    assert.ok(ran > lo && ran < hi, `${where}: the opening ran ${Math.round(ran)} ms`);
    await until(page, end.now + 900);
    assert.deepEqual(await labelsShown(page), SIX, `${where}: labels after the opening`);
    assert.ok(await page.evaluate(inkCount()) > 500, `${where}: no graph after the opening`);
    assert.equal((await intro(page)).frames, end.frames, `${where}: the opening came back`);
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('during the opening the name, role line and buttons are there and usable, and nothing is drawn over the copy', async () => {
  for (const [where, opts, seeds] of [['Mac', MAC, [11, 5]], ['iPhone', PHONE, [11, 5]], ['320px', SMALL, [11]]]) {
    for (const seed of seeds) {
      const { page } = await open(opts, seed);
      let worst = 0, samples = 0, checked = false;
      for (;;) {
        const s = await page.evaluate((f) => {
          const I = window.__intro;
          return { ink: (0, eval)('(' + f + ')')(), live: I.last === null || performance.now() - I.last < 300, now: performance.now() };
        }, inkOverCopy.toString());
        worst = Math.max(worst, s.ink); samples++;
        if (!checked && s.now > 1300) {
          checked = true;
          const copy = await page.evaluate(() => {
            const seen = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) if (+getComputedStyle(e).opacity < 0.99 || getComputedStyle(e).visibility === 'hidden') return false; return true; };
            const hit = (el) => { const r = el.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t)); };
            const q = (s) => document.querySelector('#hero ' + s);
            return { name: seen(q('.hero-name')), role: seen(q('.hero-role')), typed: q('.typed').textContent.length > 0,
              projects: seen(q('.btn-pill')) && hit(q('.btn-pill')), cv: seen(q('.more')) && hit(q('.more')), live: window.__intro.frames > 0 && performance.now() - window.__intro.last < 300 };
          });
          assert.deepEqual(copy, { name: true, role: true, typed: true, projects: true, cv: true, live: true }, `${where} seed ${seed}: the copy 1.3 s in`);
        }
        if (!s.live || s.now > 12000) break;
        await page.waitForTimeout(110);
      }
      assert.ok(checked && samples > 15, `${where} seed ${seed}: sampled ${samples} times`);
      assert.equal(worst, 0, `${where} seed ${seed}: ${worst} canvas pixels painted over the copy during the opening`);
      await page.close();
    }
  }
});

test('the gears are a clockwork of clearly different sizes, and a 320px screen goes without them', async () => {
  for (const [where, opts, at, least] of [['Mac', MAC, 4700, 40], ['iPhone', PHONE, 3800, 15]]) {
    for (const seed of [11, 5, 23]) {
      const { page } = await open(opts, seed);
      await until(page, at);
      const r = await page.evaluate(rims);
      assert.equal(r.length, 6, `${where} seed ${seed}: six gears`);
      assert.ok(r[5] >= least, `${where} seed ${seed}: the smallest gear is ${r[5]}px (${r})`);
      assert.ok(r[0] / r[5] >= 1.6 && r[0] / r[5] <= 2.6, `${where} seed ${seed}: largest to smallest is ${(r[0] / r[5]).toFixed(2)} (${r})`);
      // three sizes, two wheels of each: a clear step from large to medium and from medium to small
      assert.ok(r[1] / r[2] >= 1.1 && r[3] / r[4] >= 1.1, `${where} seed ${seed}: sizes too alike (${r})`);
      await page.close();
    }
  }
  // too narrow for readable gears: the line goes straight to the graph, sooner
  const { page } = await open(SMALL);
  let big = 0;
  for (;;) {
    const s = await page.evaluate(() => ({ r: Math.max(0, ...window.__intro.arcs.map((a) => a[2])), live: window.__intro.last === null || performance.now() - window.__intro.last < 300 }));
    big = Math.max(big, s.r);
    if (!s.live) break;
    await page.waitForTimeout(100);
  }
  const end = await intro(page);
  assert.ok(end.frames > 30, '320px: no opening');
  assert.ok(big < 15, `320px: a ${big.toFixed(0)}px circle was drawn in the opening (gears?)`);
  assert.ok(end.last - end.first < 4700, `320px: the opening ran ${Math.round(end.last - end.first)} ms`);
  await page.close();
});

test('a scroll, a tap, a click or a key skips the opening to the graph', async () => {
  const inputs = {
    wheel: (page) => page.mouse.wheel(0, 60),
    click: (page) => page.mouse.click(1000, 450),
    key: (page) => page.keyboard.press('Shift'),
    scroll: (page) => page.evaluate(() => window.scrollTo(0, 40)),
    tap: (page) => page.touchscreen.tap(195, 700),
    swipe: (page) => page.evaluate(() => window.dispatchEvent(new Event('touchstart'))),
    button: (page) => page.click('#hero .btn-pill'),
  };
  for (const [where, opts, kinds] of [['Mac', MAC, ['wheel', 'click', 'key', 'scroll', 'button']], ['iPhone', PHONE, ['tap', 'swipe', 'scroll']]]) {
    for (const kind of kinds) {
      const { page } = await open(opts);
      await until(page, 1600);
      assert.ok((await intro(page)).frames > 10, `${where} ${kind}: the opening was not running`);
      const t = await page.evaluate(() => performance.now());
      await inputs[kind](page);
      await until(page, t + 1100);
      const s = await intro(page);
      assert.ok(s.last - t < 250, `${where} ${kind}: the opening went on ${Math.round(s.last - t)} ms after the input`);
      if (kind === 'button') { // View Projects did its job as well: the page is on its way down
        await page.waitForFunction(() => window.scrollY > 300, null, { timeout: 5000 });
      } else {
        assert.deepEqual(await labelsShown(page), SIX, `${where} ${kind}: labels after the skip`);
        assert.ok(await page.evaluate(inkCount()) > 500, `${where} ${kind}: no graph after the skip`);
      }
      await page.close();
    }
  }
});

test('no opening under Reduce Motion, on a phone on its side, or after a relayout', async () => {
  for (const [where, opts] of [['Mac, Reduce Motion', { ...MAC, reducedMotion: 'reduce' }], ['iPhone, Reduce Motion', { ...PHONE, reducedMotion: 'reduce' }], ['iPhone on its side', SIDEWAYS]]) {
    const { page, errors } = await open(opts);
    await until(page, 2500);
    assert.equal((await intro(page)).frames, 0, `${where}: the opening played`);
    assert.deepEqual(await labelsShown(page), SIX, `${where}: labels`);
    assert.ok(await page.evaluate(inkCount()) > 500, `${where}: no graph`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  // a rotation mid-opening lands on the graph; it does not start over
  const { page } = await open(PHONE);
  await until(page, 1600);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  const a = await intro(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  assert.equal((await intro(page)).frames, a.frames, 'the opening started again after a rotation');
  assert.ok(await page.evaluate(inkCount()) > 500, 'no graph after the rotation');
  await page.close();
});
