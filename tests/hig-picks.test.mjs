// The HIG changes the owner picked from the before/after review (v2.72.0).
// Each test names the HIG rule and the item it comes from, and fails on
// v2.71.0.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, styled } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/**
 * A page with third-party requests (analytics, consent) cut off, opened once
 * style.css applies. With a seed, Math.random repeats, so a graph layout is
 * judged rather than a lucky draw.
 */
async function open(opts, seed) {
  const page = await ctx.browser.newPage({ serviceWorkers: 'block', ...opts });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route((u) => !u.href.startsWith(ctx.srv.url), (r) => r.abort());
  if (seed) await page.addInitScript((s0) => {
    let s = s0;
    Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  }, seed);
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(styled, null, { timeout: 8000 });
  return { page, errors };
}

/** A cheap fingerprint of the constellation's pixels. */
const canvasHash = () => {
  const c = document.getElementById('hero-net');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0, ink = 0;
  for (let i = 3; i < d.length; i += 4) { if (d[i] > 8) ink++; if (i % 389 === 3) h = (h * 31 + d[i - 1] + d[i]) | 0; }
  return h + '/' + ink;
};

/** WCAG contrast of an rgb() colour on a solid background. */
function contrast(rgb, bg = [255, 255, 255]) {
  const lum = (c) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(rgb), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
const rgbOf = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);

test('motion > Reduce Motion: the hero graph is still, and cross-fades to a second still every 10s (reduce-motion-hero-still)', async () => {
  for (const [where, opts] of [['iPhone', PHONE], ['Mac', { viewport: { width: 1440, height: 900 } }]]) {
    const { page, errors } = await open({ ...opts, reducedMotion: 'reduce' }, 11);
    await page.waitForFunction(() => performance.now() > 2000);
    const a = await page.evaluate(canvasHash);
    const inkA = await page.$eval('.hero-name', (el) => el.style.getPropertyValue('--ink-x') + el.style.getPropertyValue('--ink-c'));
    await page.waitForTimeout(2500);
    const b = await page.evaluate(canvasHash);
    const inkB = await page.$eval('.hero-name', (el) => el.style.getPropertyValue('--ink-x') + el.style.getPropertyValue('--ink-c'));
    assert.equal(a, b, `${where}: the graph moved between 2s and 4.5s under Reduce Motion`);
    assert.equal(inkA, inkB, `${where}: the light in the name moved while the graph is still`);
    // all six labels on the still frame (iPhone and Mac), each at full strength
    const labels = await page.$$eval('.hero-net-label', (ls) => ls.map((l) => +l.style.opacity));
    assert.deepEqual(labels, [1, 1, 1, 1, 1, 1], `${where}: the still frame's labels are ${labels.join(', ')}`);
    if (where === 'iPhone') {
      // about 10s after it was first drawn, one 600ms cross-fade into a second still
      let fadeFrames = 0;
      for (let i = 0; i < 70; i++) {
        await page.waitForTimeout(150);
        const s = await page.evaluate(() => ({ t: performance.now(), lo: [...document.querySelectorAll('.hero-net-label')].map((l) => +l.style.opacity) }));
        if (s.lo.some((o) => o > 0 && o < 1)) fadeFrames++;
        if (s.t > 12500) break;
      }
      const after = await page.evaluate(canvasHash);
      await page.waitForTimeout(1500);
      assert.equal(await page.evaluate(canvasHash), after, 'the second layout keeps moving after the cross-fade');
      assert.notEqual(after, b, 'no cross-fade to a second still within 12.5s');
      assert.ok(fadeFrames >= 1 && fadeFrames <= 6, `the labels were mid-fade in ${fadeFrames} samples 150ms apart (a 600ms fade)`);
      // the still frame is drawn again on a return to the tab (iOS may purge the canvas)
      await page.evaluate(() => {
        const c = document.getElementById('hero-net');
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(canvasHash), after, 'a return to the tab does not bring the same still back');
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  // without Reduce Motion the graph still drifts
  const { page } = await open(PHONE);
  await page.waitForTimeout(2600);
  const a = await page.evaluate(canvasHash);
  await page.waitForTimeout(400);
  assert.notEqual(await page.evaluate(canvasHash), a, 'the graph stopped drifting for visitors without Reduce Motion');
  await page.close();
});

test('motion > Reduce Motion: no letter-by-letter typing and no count-up; the roles change a whole word at a time (reduce-motion-typed-countup)', async () => {
  const { page } = await open({ ...PHONE, reducedMotion: 'reduce' });
  const items = await page.$eval('#hero .typed', (el) => el.dataset.typedItems.split(',').map((s) => s.trim()));
  assert.equal(await page.$eval('#hero .typed', (el) => getComputedStyle(el, '::after').display), 'none', 'the typing caret still shows');
  const seen = new Set(), partial = [];
  for (let i = 0; i < 32; i++) {
    const st = await page.$eval('#hero .typed', (el) => ({ word: el.textContent, lead: el.previousSibling.nodeValue.trim(), op: +getComputedStyle(el).opacity }));
    if (!items.includes(st.word)) partial.push(st.word);
    else {
      seen.add(st.word);
      assert.equal(st.lead, /^[aeiou]/i.test(st.word) ? "I'm an" : "I'm a", `the line reads "${st.lead} ${st.word}"`);
    }
    await page.waitForTimeout(250);
  }
  assert.deepEqual(partial, [], `part of a role was on screen: ${partial.join(' | ')}`);
  assert.ok(seen.size >= 2, `the roles do not take turns: saw ${[...seen].join(' | ')}`);
  // the Experience numbers are at their values from the first frame they show
  await page.evaluate(() => document.querySelector('#experience [data-count]').scrollIntoView({ block: 'center' }));
  const frames = await page.evaluate(() => new Promise((res) => {
    const out = [], els = [...document.querySelectorAll('#experience [data-count]')].slice(0, 3);
    const tick = () => {
      out.push(els.map((e) => e.textContent.trim() === e.dataset.count));
      if (out.length < 40) requestAnimationFrame(tick); else res(out);
    };
    requestAnimationFrame(tick);
  }));
  assert.ok(frames.every((f) => f.every(Boolean)), 'an Experience number counted up under Reduce Motion');
  await page.close();
  // without Reduce Motion the line still types
  const def = await open(PHONE);
  const words = new Set();
  for (let i = 0; i < 30; i++) { words.add(await def.page.$eval('#hero .typed', (el) => el.textContent)); await def.page.waitForTimeout(150); }
  assert.ok([...words].some((w) => !items.includes(w)), 'the role stopped typing for visitors without Reduce Motion');
  await def.page.close();
});

test('typography > minimum size: the graph labels are 11px everywhere and hold full contrast while shown (net-labels-11px)', async () => {
  for (const [where, opts, spacing] of [['small phone', SMALL, 0.08], ['iPhone', PHONE, 0.08],
    ['iPad', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }, 0.08], ['Mac', { viewport: { width: 1440, height: 900 } }, 0.14]]) {
    const { page } = await open(opts, 222);
    const f = await page.$eval('.hero-net-label', (l) => ({ size: parseFloat(getComputedStyle(l).fontSize), ls: parseFloat(getComputedStyle(l).letterSpacing) }));
    assert.ok(Math.abs(f.size - 11) < 0.1, `${where}: labels are ${f.size}px`);
    assert.ok(Math.abs(f.ls / f.size - spacing) < 0.005, `${where}: letter-spacing is ${(f.ls / f.size).toFixed(3)}em`);
    await page.waitForTimeout(2600);
    // a shown label is at full opacity (it fades only on its way in or out, over 300ms),
    // never covers another, and is never cut by the hero's edge
    const r = await page.evaluate(async () => {
      const out = { shown: 0, full: 0, overlaps: 0, cut: 0 };
      const hit = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
      for (let i = 0; i < 24; i++) {
        await new Promise((res) => setTimeout(res, 100));
        const hero = document.querySelector('#hero').getBoundingClientRect();
        const ls = [...document.querySelectorAll('.hero-net-label')].map((l) => ({ op: +getComputedStyle(l).opacity, r: l.getBoundingClientRect() }))
          .filter((l) => l.op > 0.05);
        for (const l of ls) {
          out.shown++;
          if (l.op === 1) out.full++;
          if (l.r.right > hero.right || l.r.left < hero.left) out.cut++;
        }
        for (let a = 0; a < ls.length; a++) for (let b = a + 1; b < ls.length; b++) if (ls[a].op > 0.5 && ls[b].op > 0.5 && hit(ls[a].r, ls[b].r)) out.overlaps++;
      }
      return out;
    });
    assert.ok(r.full / r.shown >= 0.85, `${where}: only ${r.full} of ${r.shown} shown label samples are at full opacity`);
    assert.equal(r.overlaps, 0, `${where}: two shown labels overlap`);
    assert.equal(r.cut, 0, `${where}: a label is cut by the edge of the hero`);
    await page.close();
  }
});

test('color > contrast: the lightest blue in the name and in "Let\'s build what\'s next." keeps 3:1 (gradient-text-contrast)', async () => {
  const { page } = await open({ viewport: { width: 1440, height: 900 } });
  const stops = await page.$eval('.cta-headline', (el) => getComputedStyle(el).backgroundImage);
  const bg = rgbOf(await page.evaluate(() => {
    // the band the headline sits on
    for (let el = document.querySelector('.cta-headline'); el; el = el.parentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    }
    return 'rgb(255, 255, 255)';
  }));
  const colours = (stops.match(/rgb\([^)]+\)/g) || []).map(rgbOf);
  assert.ok(colours.length >= 4, `no gradient on the headline: ${stops}`);
  for (const c of colours) assert.ok(contrast(c, bg) >= 3, `the headline stop rgb(${c}) is ${contrast(c, bg).toFixed(2)}:1 on rgb(${bg})`);
  // the light that runs through the name, sampled for 8s
  const low = [];
  for (let i = 0; i < 16; i++) {
    const c = rgbOf(await page.$eval('.hero-name', (el) => el.style.getPropertyValue('--ink-c')));
    if (c.length === 3 && contrast(c) < 3) low.push(`rgb(${c})`);
    await page.waitForTimeout(500);
  }
  assert.deepEqual(low, [], `the name's light dropped under 3:1 on white: ${low.join(', ')}`);
  await page.close();
});

test('images > resolution: on a 3x iPhone the hero graph is drawn at 3x (hero-canvas-dpr3)', async () => {
  for (const [dpr, want] of [[3, 1170], [2, 780]]) {
    const { page } = await open({ ...PHONE, deviceScaleFactor: dpr });
    await page.waitForTimeout(500);
    const w = await page.$eval('#hero-net', (c) => c.width);
    assert.equal(w, want, `at ${dpr}x the 390px canvas is ${w} pixels wide`);
    await page.close();
  }
});

test('launching > loading: no white loader; the hero shows at once and nothing flashes when the stylesheet lands (loader-curtain-removed)', async () => {
  for (const [where, opts] of [['iPhone', PHONE], ['Mac', { viewport: { width: 1440, height: 900 } }]]) {
    for (const reducedMotion of ['reduce', 'no-preference']) {
      const tag = `${where}${reducedMotion === 'reduce' ? ', Reduce Motion' : ''}`;
      const page = await ctx.browser.newPage({ serviceWorkers: 'block', ...opts, reducedMotion });
      await page.route((u) => !u.href.startsWith(ctx.srv.url), (r) => r.abort());
      await page.route(/style\.min\.css/, async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.continue(); });
      // every frame: what is on screen outside the hero, and when style.css applied
      await page.addInitScript(() => {
        window.__out = []; window.__styledAt = 0;
        const tick = () => {
          const t = performance.now();
          const foot = document.querySelector('footer');
          if (foot && !window.__styledAt && getComputedStyle(foot).animationName === 'none') window.__styledAt = t;
          for (const el of document.querySelectorAll('body > :not(main):not(script):not(template):not(style):not(link):not(.skip-link), main > section:not(#hero), footer')) {
            const cs = getComputedStyle(el), r = el.getBoundingClientRect();
            if (cs.display === 'none' || cs.visibility !== 'visible' || +cs.opacity < 0.02) continue;
            if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight) continue;
            window.__out.push(`${Math.round(t)}ms ${el.id || el.className || el.tagName} at ${(+cs.opacity).toFixed(2)}`);
          }
          if (t < 3200) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'commit' });
      await page.waitForFunction(() => performance.now() > 1000);
      const early = await page.evaluate(() => ({
        loader: !!document.querySelector('.loader'),
        styled: getComputedStyle(document.querySelector('footer')).animationName === 'none',
        name: +getComputedStyle(document.querySelector('.hero-name-line')).opacity,
        nameTop: document.elementFromPoint(...(() => { const r = document.querySelector('.hero-name-line').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })())?.closest('#hero') !== null,
        pill: getComputedStyle(document.querySelector('#hero .btn-pill')).backgroundColor,
        below: getComputedStyle(document.querySelector('#resume')).visibility,
      }));
      assert.equal(early.loader, false, `${tag}: the page still has a loader`);
      assert.equal(early.styled, false, `${tag}: the stylesheet was not held back`);
      assert.ok(early.name > 0.9 && early.nameTop, `${tag}: the name is not on screen 1s in, before the stylesheet (opacity ${early.name})`);
      assert.equal(early.pill, 'rgb(18, 100, 206)', `${tag}: "View projects" is not blue before the stylesheet`);
      assert.equal(early.below, 'hidden', `${tag}: the sections below the hero show unstyled`);
      await page.waitForFunction(() => performance.now() > 3300);
      const r = await page.evaluate(() => ({ out: window.__out, at: window.__styledAt }));
      assert.ok(r.at > 1400, `${tag}: style.css applied at ${r.at}ms`);
      assert.deepEqual(r.out, [], `${tag}: something outside the hero showed on the first screen`);
      assert.equal(await page.$eval('#resume', (el) => getComputedStyle(el).visibility), 'visible');
      await page.close();
    }
  }
});
