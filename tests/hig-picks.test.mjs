// The HIG changes the owner picked from the before/after review (v2.72.0).
// Each test names the HIG rule and the item it comes from, and fails on
// v2.71.0.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, styled, ROOT } from './helpers.mjs';

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

test('color > contrast: the lightest blue in the name and in the Contact headline keeps 3:1 (gradient-text-contrast)', async () => {
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
  // with Increase Contrast the name and headline keep their gradient, with the darker blue; they do not turn solid
  {
    const { page: more } = await open({ viewport: { width: 1440, height: 900 }, contrast: 'more' });
    const g = await more.evaluate(() => ({
      cta: getComputedStyle(document.querySelector('.cta-headline')).backgroundImage,
      name: getComputedStyle(document.querySelector('.hero-name-line')).backgroundImage,
    }));
    assert.ok(g.cta.includes('rgb(47, 128, 232) 66%'), `Increase Contrast: the headline gradient is ${g.cta}`);
    assert.notEqual(g.name, 'none', 'Increase Contrast: the name lost its gradient');
    await more.close();
  }
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

const MAC = { viewport: { width: 1440, height: 900 } };
const GREY = 'rgb(110, 110, 115)', GREY_SMALL = 'rgb(81, 81, 84)', GREY_MORE = 'rgb(58, 58, 60)';
const BLUE = 'rgb(18, 100, 206)', BLUE_MORE = 'rgb(10, 77, 163)', BLUE_HOVER = 'rgb(15, 87, 181)', INK = 'rgb(29, 29, 31)';
/** Computed colour of each selector's first match (hidden ones too: the sheets are in the page). */
/** Wait until the hover transitions on a locator's element have run out. */
const settle = (loc) => loc.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))));
/** The grey "(KBAO)"-style aside after a client's name, in the Experience sheet (an inline colour). */
async function clientAside(page) {
  await page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open .exp-client-section-header h3 span[style]');
  return page.$eval('.exp-lightbox.open .exp-client-section-header h3 span[style]', (el) => getComputedStyle(el).color);
}
const colours = (page, sels) => page.evaluate((sels) => Object.fromEntries(Object.entries(sels).map(([k, s]) => {
  const el = document.querySelector(s);
  return [k, el ? getComputedStyle(el).color : 'missing'];
})), sels);

test('color > Increase Contrast: grey text and link blue get darker variants; the default look stays (increased-contrast-tokens)', async () => {
  const sels = {
    role: '#hero .hero-role > [aria-hidden]',   // 20px grey
    typed: '#hero .typed',                      // the typed role word, still blue (blue-for-interactive-only, closest)
    more: '#hero a.more',
    cv: '#resume a.resume-exp-link[download]',  // an inline colour in the page
    footMail: 'footer .footer-contact-link',    // another inline colour
    footName: '.footer-copy-link',
    duration: '.exp-duration',                  // small grey (small-text-7-to-1) follows to the same dark grey
    statLabel: '.exp-stat-label',
    ctaSub: '.cta-sub',
  };
  for (const [where, opts] of [['iPhone', PHONE], ['Mac', MAC]]) {
    const def = await open(opts);
    const d = await colours(def.page, sels);
    d.clientAside = await clientAside(def.page);
    await def.page.close();
    for (const k of ['role', 'clientAside']) assert.equal(d[k], GREY, `${where}: ${k} changed in the default look`);
    for (const k of ['typed', 'more', 'cv', 'footMail', 'footName']) assert.equal(d[k], BLUE, `${where}: ${k} changed in the default look`);
    assert.equal(d.ctaSub, 'rgb(99, 99, 102)', `${where}: the contact subline changed in the default look`);
    const { page } = await open({ ...opts, contrast: 'more' });
    const c = await colours(page, sels);
    for (const k of ['role', 'duration', 'statLabel', 'ctaSub']) assert.equal(c[k], GREY_MORE, `${where}, Increase Contrast: ${k} is ${c[k]}`);
    for (const k of ['typed', 'more', 'cv', 'footMail', 'footName']) assert.equal(c[k], BLUE_MORE, `${where}, Increase Contrast: ${k} is ${c[k]}`);
    // the pill follows the same tokens, resting and under the pointer
    assert.equal(await page.$eval('#hero .btn-pill', (b) => getComputedStyle(b).backgroundColor), BLUE_MORE);
    if (where === 'Mac') {
      const pill = page.locator('#hero .btn-pill');
      await pill.hover();
      await settle(pill);
      assert.equal(await pill.evaluate((b) => getComputedStyle(b).backgroundColor), 'rgb(8, 63, 134)', 'the hovered pill under Increase Contrast');
    }
    assert.equal(await clientAside(page), GREY_MORE, `${where}, Increase Contrast: the client aside in the sheet`);
    await page.close();
  }
  // the first paint already has the darker tokens (the hero's copies in index.html)
  const page = await ctx.browser.newPage({ ...PHONE, serviceWorkers: 'block', contrast: 'more' });
  await page.route((u) => !u.href.startsWith(ctx.srv.url) || /style\.min\.css/.test(u.href), (r) => r.abort());
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  const first = await colours(page, { role: '#hero .hero-role > [aria-hidden]', eyebrow: '#hero .hero-eyebrow', more: '#hero a.more' });
  assert.deepEqual(first, { role: GREY_MORE, eyebrow: GREY_MORE, more: BLUE_MORE }, 'the hero before style.css lands, under Increase Contrast');
  await page.close();
});

test('color > contrast: grey text at 14px and below on the page reaches 7:1; larger grey stays #6E6E73 (small-text-7-to-1)', async () => {
  const small = {
    eyebrow: '#hero .hero-eyebrow', label: '.hero-net-label', info: '#resume .info-label', duration: '.exp-duration',
    stat: '.exp-stat-label', clients: '.exp-clients-line', tagline: 'footer .col-md-4 .fw-light',
  };
  for (const [where, opts] of [['iPhone', PHONE], ['Mac', MAC]]) {
    const { page } = await open(opts);
    const c = await page.evaluate((small) => Object.fromEntries(Object.entries(small).map(([k, s]) => {
      const el = document.querySelector(s);
      let bg = 'rgb(255, 255, 255)';
      for (let p = el; p; p = p.parentElement) {
        const b = getComputedStyle(p).backgroundColor;
        if (b !== 'rgba(0, 0, 0, 0)' && !/, 0\)$/.test(b)) { bg = b; break; }
      }
      return [k, { color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize), bg }];
    })), small);
    for (const [k, v] of Object.entries(c)) {
      assert.ok(v.size <= 14.5, `${where}: ${k} is ${v.size}px, not small text`);
      assert.equal(v.color, GREY_SMALL, `${where}: ${k} is ${v.color}`);
      assert.ok(contrast(rgbOf(v.color), rgbOf(v.bg)) >= 7, `${where}: ${k} is ${contrast(rgbOf(v.color), rgbOf(v.bg)).toFixed(2)}:1 on ${v.bg}`);
    }
    // on phones the Education and Achievement lines keep the darker grey the owner approved, also at
    // their 15px size (phone-body-17), so they are never lighter than the 13px dates under them
    const line = (sel) => page.$$eval(sel, (els) => { const el = els[els.length - 1]; return { color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize) }; });
    const edu = await page.$eval('#resume p.profile-bio-small', (el) => ({ color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize) }));
    assert.equal(edu.color, where === 'iPhone' ? GREY_SMALL : GREY, `${where}: an Education line at ${edu.size}px is ${edu.color}`);
    const ach = await line('#resume .data-box p.profile-bio-small');
    assert.equal(ach.color, where === 'iPhone' ? GREY_SMALL : GREY, `${where}: an Achievement line at ${ach.size}px is ${ach.color}`);
    assert.equal(await page.$eval('#hero .hero-role > [aria-hidden]', (el) => getComputedStyle(el).color), GREY, `${where}: the 20px role line left #6E6E73`);
    await page.close();
  }
});

test('color > blue is for what can be tapped: no blue text that is not a link or button, but the typed role (blue-for-interactive-only, closest)', async () => {
  for (const [where, opts] of [['iPhone', PHONE], ['Mac', MAC]]) {
    const { page } = await open({ ...opts, reducedMotion: 'reduce' });   // the role shows whole words
    const blue = await page.evaluate((BLUE) => {
      const out = new Set();
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) {
        const el = n.parentElement;
        if (!n.nodeValue.trim() || !el || el.closest('a, button, [role="button"], template, noscript, .exp-lightbox, .proj-sheet, [hidden]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || el.closest('.visuallyhidden')) continue;   // screen-reader text is not seen
        if (getComputedStyle(el).visibility !== 'visible' || getComputedStyle(el).color !== BLUE) continue;
        out.add((el.closest('.typed, .exp-clients-more') || el).className || el.tagName);
      }
      return [...out].sort();
    }, BLUE);
    assert.deepEqual(blue, ['exp-clients-more', 'typed'], `${where}: blue text that cannot be tapped: ${blue.join(', ')}`);
    const r = await page.evaluate(() => {
      const chip = [...document.querySelectorAll('#resume .exp-card-highlights .hl')].find((h) => /Full-Stack/.test(h.textContent));
      const near = chip.nextElementSibling;
      const cs = (el) => getComputedStyle(el);
      return {
        chip: [cs(chip).color, cs(chip).backgroundColor], near: [cs(near).color, cs(near).backgroundColor],
        location: cs(document.querySelector('#resume .contact-strip div.info-item .info-icon')).color,
        phone: cs(document.querySelector('#resume .contact-strip a.info-item .info-icon')).color,
        active: cs(document.querySelector('.exp-status-active')).color,
        activeTint: cs(document.querySelector('.exp-status-active')).backgroundColor,
        sup: cs(document.querySelector('.stat-sup')).color,
        tag: cs(document.querySelector('#skill .skill-tag')).color,
        typed: cs(document.querySelector('#hero .typed')).color,
      };
    });
    assert.deepEqual(r.chip, r.near, `${where}: the Full-Stack Developer chip differs from AI Engineer beside it`);
    assert.deepEqual(r.chip, [INK, 'rgb(255, 255, 255)']);
    assert.equal(r.location, GREY, `${where}: the Location pin`);
    assert.equal(r.phone, BLUE, `${where}: the Phone tile is a link and keeps its blue glyph`);
    assert.equal(r.active, INK);
    assert.equal(r.activeTint, 'rgba(18, 100, 206, 0.08)', `${where}: the Active tint was meant to stay`);
    assert.equal(r.sup, INK);
    assert.equal(r.tag, where === 'iPhone' ? GREY_SMALL : GREY, `${where}: the skill tag`);
    assert.equal(r.typed, BLUE, `${where}: the typed role word stays blue (closest)`);
    await page.close();
  }
});

test('color > hover: a pointed-at link or button goes darker, not lighter (link-hover-darker)', async () => {
  const { page } = await open(MAC);
  const pill = page.locator('#hero .btn-pill');
  await pill.hover();
  await settle(pill);
  assert.equal(await pill.evaluate((b) => getComputedStyle(b).backgroundColor), BLUE_HOVER);
  await page.$eval('#services .faq a[href*="linkedin"]', (a) => { a.closest('details').open = true; });
  const faq = page.locator('#services .faq a[href*="linkedin"]').first();
  await faq.scrollIntoViewIfNeeded();
  assert.equal(await faq.evaluate((a) => getComputedStyle(a).color), BLUE, 'the resting link blue changed');
  await faq.hover();
  await settle(faq);
  const c = await faq.evaluate((a) => getComputedStyle(a).color);
  assert.equal(c, BLUE_HOVER);
  assert.ok(contrast(rgbOf(c), [245, 245, 247]) >= 4.5, `the hovered FAQ link is ${contrast(rgbOf(c), [245, 245, 247]).toFixed(2)}:1`);
  const icon = page.locator('.social-links-footer a').first();
  await icon.scrollIntoViewIfNeeded();
  await icon.hover();
  await settle(icon);
  assert.equal(await icon.evaluate((a) => getComputedStyle(a).color), BLUE_HOVER, 'a hovered footer icon');
  // the Resume links, the footer e-mail and phone and "See all 58 projects" darken too (no inline colour holds them)
  for (const sel of ['#resume a.resume-exp-link', 'footer .footer-contact-link', '[data-proj-all]']) {
    const l = page.locator(sel).first();
    await l.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    assert.equal(await l.evaluate((a) => getComputedStyle(a).color), BLUE, `${sel} at rest`);
    await l.hover();
    await page.waitForTimeout(450);
    assert.equal(await l.evaluate((a) => getComputedStyle(a).color), BLUE_HOVER, `${sel} under the pointer`);
  }
  await page.close();
});

test('accessibility > focus: every keyboard ring is the system ring, in each control\'s own shape (system-focus-ring)', async () => {
  const ring = (page, sel, of) => page.$eval(sel, (el, of) => {
    const t = of ? el.closest(of) : el, cs = getComputedStyle(t);
    return { fv: el.matches(':focus-visible'), style: cs.outlineStyle, color: cs.outlineColor, text: cs.color, offset: cs.outlineOffset, radius: cs.borderRadius };
  }, of);
  const { page } = await open({ ...MAC, reducedMotion: 'reduce' });
  await page.keyboard.press('Tab');   // keyboard modality
  for (const [sel, of, offset, radius] of [
    ['#hero .btn-pill', null, '3px', '980px'], ['#hero a.more', null, '3px', '6px'],
    ['#scroller .card-plus[tabindex="0"]', '.rf-cards-scroller-item', '3px', null],
    ['#images-list button.cert-img[tabindex="0"]', '.cert-card', '3px', null],
    ['#services .faq summary', null, '0px', '14px'],
  ]) {
    await page.focus(sel);
    await page.waitForTimeout(250);
    const r = await ring(page, sel, of);
    assert.ok(r.fv, `${sel} is not :focus-visible`);
    assert.equal(r.style, 'auto', `${sel}${of ? ' (its ' + of + ')' : ''} draws a ${r.style} ring`);
    assert.notEqual(r.color, r.text, `${sel}: the ring takes the text colour (white on the white-text pill)`);
    assert.equal(r.offset, offset, `${sel}: ring offset`);
    if (radius) assert.equal(r.radius, radius, `${sel}: the ring lost the control's shape`);
  }
  // the scroller paddles
  const pad = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.paddlenav-arrow')].find((x) => !x.disabled && x.getClientRects().length);
    b.focus();
    return { style: getComputedStyle(b).outlineStyle, offset: getComputedStyle(b).outlineOffset };
  });
  assert.deepEqual(pad, { style: 'auto', offset: '3px' }, 'a focused paddle');
  await page.close();
  // the client toggle in the Experience sheet (phones)
  const ph = await open({ ...PHONE, reducedMotion: 'reduce' });
  await ph.page.keyboard.press('Tab');
  await ph.page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
  await ph.page.waitForSelector('.exp-lightbox.open');
  await ph.page.focus('.exp-client-toggle');
  await ph.page.waitForTimeout(250);
  const t = await ring(ph.page, '.exp-client-toggle');
  assert.equal(t.style, 'auto', 'the client toggle in the sheet');
  assert.equal(t.offset, '3px');
  await ph.page.close();
});

test('color > not by colour alone: the name in the copyright line is underlined at rest (footer-link-underline)', async () => {
  for (const [where, opts] of [['small phone', SMALL], ['iPhone', PHONE], ['Mac', MAC]]) {
    const { page } = await open(opts);
    const r = await page.$eval('a.footer-copy-link', (a) => {
      const cs = getComputedStyle(a);
      return { line: cs.textDecorationLine, thick: cs.textDecorationThickness, off: parseFloat(cs.textUnderlineOffset) / parseFloat(cs.fontSize), color: cs.color };
    });
    assert.equal(r.line, 'underline', `${where}: no underline at rest`);
    assert.equal(r.thick, '1px', `${where}: underline thickness`);
    assert.ok(Math.abs(r.off - 0.2) < 0.01, `${where}: underline offset is ${r.off.toFixed(3)}em`);
    assert.equal(r.color, BLUE, `${where}: the name changed colour`);
    if (where === 'Mac') {
      // under the pointer it behaves like the site's other links: darker, without the line
      const a = page.locator('a.footer-copy-link');
      await a.scrollIntoViewIfNeeded();
      await a.hover();
      await settle(a);
      assert.deepEqual(await a.evaluate((el) => [getComputedStyle(el).textDecorationLine, getComputedStyle(el).color]), ['none', BLUE_HOVER]);
    }
    await page.close();
  }
});

/** Computed size and line height of every match, with a little of its text to name it. */
const sizes = (page, sel) => page.$$eval(sel, (els) => els.map((el) => {
  const cs = getComputedStyle(el);
  return { t: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24), size: Math.round(parseFloat(cs.fontSize) * 10) / 10, lh: Math.round(parseFloat(cs.lineHeight)) };
}));

test('typography > legibility: on phones the reading paragraphs step up from 13px to the 15/20 Subhead size; dates stay 13px, the FAQ 15px (phone-body-17, closest)', async () => {
  const reading = '#resume .profile-bio, #resume p.profile-bio-small, ' +
    '#experience .data-box[data-exp] > .profile-bio-small:not(.exp-card-highlights), #experience .data-box[data-exp] .exp-role > p.profile-bio-small';
  const dates = '#resume div.profile-bio-small:not(.exp-card-highlights), #experience .exp-role-period, ' +
    '#experience .data-box[data-exp] .d-flex .profile-bio-small';
  for (const [where, opts] of [['small phone', SMALL], ['iPhone', PHONE]]) {
    const { page } = await open(opts);
    const r = await sizes(page, reading);
    // the bio, 4 Education and Achievement lines, 2 experience descriptions, 2 SCG role paragraphs
    assert.equal(r.length, 9, `${where}: ${r.length} reading paragraphs`);
    for (const x of r) assert.deepEqual([x.size, x.lh], [15, 20], `${where}: "${x.t}" is ${x.size}/${x.lh}`);
    const d = await sizes(page, dates);
    assert.ok(d.length >= 7, `${where}: only ${d.length} date lines found`);
    for (const x of d) assert.equal(x.size, 13, `${where}: the date line "${x.t}" is ${x.size}px`);
    for (const x of await sizes(page, '#services .faq details > p')) assert.equal(x.size, 15, `${where}: an FAQ answer is ${x.size}px`);
    // the experience descriptions keep their three-line teaser
    assert.deepEqual(await page.$$eval('#experience .data-box[data-exp] .exp-role > p.profile-bio-small',
      (els) => els.map((el) => getComputedStyle(el).webkitLineClamp)), ['3', '3']);
    // the sheet behind a card's "+" reads at the same size
    await page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
    await page.waitForSelector('.exp-lightbox.open .exp-modal-overview');   // (the client lists start folded)
    for (const sel of ['.exp-lightbox.open .exp-modal-overview', '.exp-lightbox.open .exp-client-section ul']) {
      const [x] = await sizes(page, sel);
      assert.deepEqual([x.size, x.lh], [15, 20], `${where}: ${sel} is ${x.size}/${x.lh}`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${where}: the page scrolls sideways`);
    await page.close();
  }
  // the larger text does not split the citation's "July–December." at its en dash
  for (const width of [375, 390, 393]) {
    const { page } = await open({ viewport: { width, height: 800 } });
    const lines = await page.$$eval('#resume p.profile-bio-small .nw', (els) => {
      const el = els.find((e) => e.textContent === 'July\u2013December.');
      if (!el) return 0;
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size;
    });
    assert.equal(lines, 1, `${width}px: "July–December." breaks over ${lines} lines`);
    await page.close();
  }
  // the Mac keeps its sizes
  const { page } = await open(MAC);
  assert.deepEqual((await sizes(page, '#resume .profile-bio')).map((x) => x.size), [17]);
  assert.deepEqual([...new Set((await sizes(page, '#experience .data-box[data-exp] .exp-role > p.profile-bio-small')).map((x) => x.size))], [17]);
  await page.close();
});

test('typography > hierarchy: on phones the Resume subsection titles are 28/34 under the 34px section title (resume-subhead-28)', async () => {
  for (const [where, opts, sub] of [['small phone', SMALL, [28, 34]], ['iPhone', PHONE, [28, 34]], ['Mac', MAC, [32, 38]]]) {
    const { page } = await open(opts);
    const r = await sizes(page, '#resume .resume-title');
    assert.deepEqual(r.map((x) => x.t), ['Profile', 'Education', 'Achievement']);
    for (const x of r) assert.deepEqual([x.size, x.lh], sub, `${where}: ${x.t} is ${x.size}/${x.lh}`);
    assert.equal(await page.$eval('#resume .resume-title', (el) => getComputedStyle(el).fontWeight), '700', `${where}: weight`);
    if (where !== 'Mac') assert.equal((await sizes(page, '#resume .section-title h2'))[0].size, 34, `${where}: the Resume title moved`);
    await page.close();
  }
});

test('typography > minimum size: below 360px the Experience stat labels keep 11px and stay inside their cells (stat-labels-11px-small-phones)', async () => {
  const { page } = await open(SMALL);
  const r = await page.$$eval('.exp-stat-label', (els) => els.map((el) => {
    const cell = el.closest('.exp-stat-item').getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(el);
    const ink = range.getBoundingClientRect();
    return { t: el.textContent.trim(), size: parseFloat(getComputedStyle(el).fontSize), inside: ink.left >= cell.left - 0.5 && ink.right <= cell.right + 0.5 };
  }));
  assert.equal(r.length, 9);
  for (const x of r) {
    assert.ok(Math.abs(x.size - 11) < 0.05, `"${x.t}" is ${x.size}px`);
    assert.ok(x.inside, `"${x.t}" runs out of its cell`);
  }
  // every card's stats stay on one row
  const rows = await page.$$eval('.exp-card-stats', (bars) => bars.map((b) => new Set([...b.querySelectorAll('.exp-stat-item')].map((i) => Math.round(i.getBoundingClientRect().top))).size));
  assert.deepEqual(rows, [1, 1, 1]);
  await page.close();
});

test('writing > capitalization: the four university project cards use sentence case like the other 54 (project-title-case)', async () => {
  const { page } = await open(PHONE);
  const titles = ['Real time pulse & temperature monitoring', 'Covid-19 spread analysis website', "Student's project management system", 'Classroom booking record system'];
  const r = await page.$$eval('#scroller > .rf-cards-scroller-item', (cards) => cards.map((c) => ({
    t: c.querySelector('h3').textContent.trim(), plus: c.querySelector('.card-plus') && c.querySelector('.card-plus').getAttribute('aria-label'),
  })));
  assert.equal(r.length, 58);
  for (const t of titles) {
    const card = r.find((x) => x.t === t);
    assert.ok(card, `no card titled "${t}"`);
    assert.equal(card.plus, 'View screenshot: ' + t);
  }
  // no card title capitalises every word any more
  const shouting = r.map((x) => x.t.split(',')[0]).filter((t) => t.split(/\s+/).filter((w) => /^[a-z]/i.test(w) && w.length > 3).length > 2 &&
    t.split(/\s+/).filter((w) => /^[a-z]/i.test(w) && w.length > 3).every((w) => /^[A-Z]/.test(w)));
  assert.deepEqual(shouting, []);
  // the See all list copies them
  await page.$eval('[data-proj-all]', (b) => b.click());
  await page.waitForSelector('.exp-lightbox.open .proj-row');
  const names = await page.$$eval('.exp-lightbox.open .proj-name', (els) => els.map((el) => el.textContent.trim()));
  for (const t of titles) assert.ok(names.includes(t), `"${t}" is not in the See all list`);
  await page.close();
});

test('writing > titles: the section is "Projects", like Resume, Experience, Skills and Certificates (projects-heading)', async () => {
  const { page } = await open(MAC);
  assert.equal(await page.$eval('#portfolio-title h2', (el) => el.textContent.trim()), 'Projects');
  assert.equal(await page.$eval('#portfolio', (el) => el.getAttribute('aria-labelledby')), 'portfolio-title');
  await page.close();
});

test('writing > voice: the Contact headline speaks as the owner, "Build what\'s / next with me.", on two lines everywhere (contact-headline-we)', async () => {
  for (const [where, opts] of [['small phone', SMALL], ['iPhone', PHONE], ['iPad', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }], ['Mac', MAC]]) {
    const { page } = await open(opts);
    const r = await page.$eval('.cta-headline', (h) => {
      const range = document.createRange();
      range.selectNodeContents(h);
      const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
      const box = h.getBoundingClientRect(), ink = range.getBoundingClientRect();
      return { html: h.innerHTML.trim(), lines, inside: ink.left >= box.left - 0.5 && ink.right <= box.right + 0.5, sideways: document.documentElement.scrollWidth - innerWidth };
    });
    assert.equal(r.html, "Build what's<br>next with me.", where);
    assert.equal(r.lines, 2, `${where}: the headline takes ${r.lines} lines`);
    assert.ok(r.inside, `${where}: the headline runs out of its box`);
    assert.equal(r.sideways, 0, `${where}: the page scrolls sideways`);
    await page.close();
  }
});

test('writing > plain words: the Certificates subtitle is "Certificates I\'ve earned.", one line on every screen (certificates-subtitle-plain)', async () => {
  for (const [where, opts] of [['small phone', SMALL], ['iPhone', PHONE], ['Mac', MAC]]) {
    const { page } = await open(opts);
    const r = await page.$eval('#certificates .section-title p', (p) => {
      const range = document.createRange();
      range.selectNodeContents(p);
      return { t: p.textContent.trim(), lines: new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size };
    });
    assert.deepEqual(r, { t: "Certificates I've earned.", lines: 1 }, where);
    await page.close();
  }
});

test('content: the second scan of the Computer Repair Service certificate (No 10, 16 June 2017) is gone; 32 certificates, each its own (q-cert24)', async () => {
  const { page } = await open(MAC);
  const requested = [];
  page.on('request', (q) => { if (/certificate\//.test(q.url())) requested.push(q.url()); });
  const r = await page.$$eval('#images-list .cert-card', (cards) => cards.map((c) => ({
    label: c.querySelector('button.cert-img').getAttribute('aria-label'), src: c.querySelector('img').getAttribute('src'),
  })));
  assert.equal(r.length, 32);
  assert.equal(new Set(r.map((x) => x.src)).size, 32, 'two tiles draw the same file');
  assert.equal(new Set(r.map((x) => x.label)).size, 32, 'two tiles have the same name');
  assert.equal(r.filter((x) => /Computer Repair Service/.test(x.label)).length, 1, 'the Computer Repair Service certificate is shown twice');
  assert.match(r[20].label, /Computer Repair Service/);
  assert.equal(r[20].src, 'assets/img/certificate/thumb/img-21.avif');
  assert.match(r[23].label, /Introduction to JavaScript/);
  assert.equal(r[23].src, 'assets/img/certificate/thumb/img-25.avif');
  // every tile's file is there; nothing asks for the removed one
  await page.$eval('#images-list', (el) => el.scrollIntoView());
  await page.$$eval('#images-list img', async (imgs) => {
    for (const im of imgs) { im.loading = 'eager'; try { await im.decode(); } catch (e) { /* counted below */ } }
  });
  assert.deepEqual(await page.$$eval('#images-list img', (imgs) => imgs.filter((im) => !(im.naturalWidth > 0)).map((im) => im.getAttribute('src'))), []);
  assert.deepEqual(requested.filter((u) => /img-24\.avif/.test(u)), []);
  // each tile's stored full size (CERT_SIZES) has the shape of its own file, so the viewer opens it at the right shape
  const off = await page.$$eval('#images-list img', (imgs) => imgs.map((im) => {
    const w = +im.getAttribute('data-full-w'), h = +im.getAttribute('data-full-h');
    return { src: im.getAttribute('src'), w, h, d: Math.abs(w / h - im.naturalWidth / im.naturalHeight) };
  }).filter((x) => !(x.d < 0.02)));
  assert.deepEqual(off, [], 'a tile\'s stored size does not match its file');
  await page.close();
});

/* ---- controls (v2.72.0, stage 4) ---- */

/** Hold the mouse down on the centre of a selector's first match (it stays held). */
async function press(page, sel) {
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(300);
  const b = await page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.waitForTimeout(450);
}

test('buttons > press state: a held "+" darkens and shrinks, its card gives way, links dim and rows tint (press-states)', async () => {
  {
    const { page } = await open({ ...MAC, reducedMotion: 'reduce' });
    await press(page, '#portfolio .rf-cards-scroller-item .card-plus');
    const plus = await page.$eval('#portfolio .rf-cards-scroller-item .card-plus', (b) => ({
      bg: getComputedStyle(b).backgroundColor, t: getComputedStyle(b).transform, card: getComputedStyle(b.closest('.rf-cards-scroller-item')).transform,
    }));
    assert.deepEqual(plus, { bg: 'rgba(194, 194, 199, 0.655)', t: 'matrix(0.94, 0, 0, 0.94, 0, 0)', card: 'matrix(0.98, 0, 0, 0.98, 0, 0)' }, 'the held "+" looks like a hovered one');
    await page.close();
  }
  {
    const { page } = await open({ ...MAC, reducedMotion: 'reduce' });
    await press(page, '#services .faq summary');
    assert.equal(await page.$eval('#services .faq summary', (s) => getComputedStyle(s).backgroundColor), 'rgba(0, 0, 0, 0.05)', 'a held FAQ question does not change');
    await page.close();
  }
  {
    const { page } = await open({ ...MAC, reducedMotion: 'reduce' });
    await press(page, '#portfolio button.more.proj-all');
    assert.equal(await page.$eval('#portfolio button.more.proj-all', (b) => getComputedStyle(b).opacity), '0.6', 'a held "See all" link does not dim');
    await page.close();
  }
  // a held row of the "All projects" list tints its whole band of the grouped list
  const { page } = await open({ ...PHONE, reducedMotion: 'reduce' });
  await page.$eval('[data-proj-all]', (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open .proj-row');
  await page.waitForTimeout(400);
  await press(page, '.exp-lightbox.open .proj-row');
  const row = await page.$eval('.exp-lightbox.open .proj-row', (r) => {
    const a = r.getBoundingClientRect(), g = r.closest('.proj-rows').getBoundingClientRect();
    return { bg: getComputedStyle(r).backgroundColor, left: Math.round(a.left - g.left), right: Math.round(g.right - a.right), corner: getComputedStyle(r).borderTopLeftRadius };
  });
  assert.deepEqual(row, { bg: 'rgba(0, 0, 0, 0.05)', left: 0, right: 0, corner: '18px' }, 'the held row is not tinted edge to edge');
  await page.close();
});

test('controls > segmented control: the four skill filters are one grey track; the chosen segment is a white thumb with dark text; all fit at 320px (skill-filter-segmented)', async () => {
  {
    const { page } = await open(MAC);
    const s = await page.evaluate(() => {
      const track = document.querySelector('#skill .project-filters');
      const segs = [...track.querySelectorAll('.filter-btn')].map((b) => ({ w: Math.round(b.getBoundingClientRect().width * 10) / 10, bg: getComputedStyle(b).backgroundColor, c: getComputedStyle(b).color }));
      const t = track.getBoundingClientRect();
      return { track: getComputedStyle(track).backgroundColor, centred: Math.abs((t.left + t.right) / 2 - innerWidth / 2) < 2, segs };
    });
    assert.equal(s.track, 'rgb(232, 232, 237)');
    assert.ok(s.centred, 'the track is not centred');
    assert.equal(new Set(s.segs.map((x) => x.w)).size, 1, `the Mac segments differ in width: ${s.segs.map((x) => x.w).join(', ')}`);
    assert.deepEqual([s.segs[0].bg, s.segs[0].c], ['rgb(255, 255, 255)', INK], 'the chosen segment is not a white thumb with dark text');
    assert.deepEqual(s.segs.slice(1).map((x) => x.bg), Array(3).fill('rgba(0, 0, 0, 0)'));
    // choosing Web moves the thumb; nothing is blue
    await page.$eval('#skill .filter-btn[data-filter="web"]', (b) => b.click());
    await page.waitForTimeout(400);
    const after = await page.$$eval('#skill .filter-btn', (bs) => bs.map((b) => [getComputedStyle(b).backgroundColor, b.getAttribute('aria-pressed')]));
    assert.deepEqual(after[1], ['rgb(255, 255, 255)', 'true']);
    assert.equal(after[0][0], 'rgba(0, 0, 0, 0)');
    await page.close();
  }
  const { page } = await open(SMALL);
  const r = await page.evaluate(() => {
    const wrap = document.querySelector('#skill .project-filters-wrap');
    const segs = [...wrap.querySelectorAll('.filter-btn')].map((b) => { const x = b.getBoundingClientRect(); return { l: x.left, r: x.right, w: x.width, h: x.height, clip: b.scrollWidth > b.clientWidth }; });
    return { wrap: wrap.scrollWidth - wrap.clientWidth, page: document.documentElement.scrollWidth - innerWidth, segs };
  });
  assert.equal(r.wrap, 0, 'the filter row scrolls sideways at 320px');
  assert.equal(r.page, 0);
  for (const s of r.segs) {
    assert.ok(s.l >= 0 && s.r <= 320, 'a segment runs off a 320px screen');
    assert.ok(s.w >= 44 && s.h >= 44, `a segment is ${s.w}x${s.h}, under 44pt`);
    assert.ok(!s.clip, 'a segment label is cut');
  }
  await page.close();
  // Windows High Contrast: the chosen segment is filled with the system Highlight, unlike the others
  {
    const { page: fc } = await open({ ...MAC, forcedColors: 'active' });
    const bgs = await fc.$$eval('#skill .filter-btn', (bs) => bs.map((b) => [b.getAttribute('aria-pressed'), getComputedStyle(b).backgroundColor]));
    const on = bgs.find((x) => x[0] === 'true')[1];
    assert.ok(bgs.filter((x) => x[0] !== 'true').every((x) => x[1] !== on), `forced colours: the chosen segment looks like the others (${on})`);
    assert.notEqual(on, 'rgb(255, 255, 255)', 'forced colours: the chosen segment kept the white thumb');
    await fc.close();
  }
});

test('controls > hover: a pointed-at skill segment tints light grey, never blue and never larger (filter-hover-tint, as the segmented control)', async () => {
  const { page } = await open(MAC);
  const web = page.locator('#skill .filter-btn[data-filter="web"]');
  await web.scrollIntoViewIfNeeded();
  await web.hover();
  await page.waitForTimeout(500);
  await settle(web);
  const s = await page.$$eval('#skill .filter-btn', (bs) => bs.map((b) => [getComputedStyle(b).backgroundColor, getComputedStyle(b).color, getComputedStyle(b).transform]));
  assert.deepEqual(s[1], ['rgba(0, 0, 0, 0.04)', INK, 'none'], `the hovered segment is ${s[1].join(' / ')}`);
  assert.equal(s[0][0], 'rgb(255, 255, 255)', 'the chosen segment changed while another was hovered');
  assert.equal(s.filter((x) => x[0] === BLUE).length, 0, 'a segment is blue');
  await page.close();
});

test('motion > the cards a skill filter shows fade in over 240ms; hidden ones go at once; none under Reduce Motion (skill-filter-fade-in)', async () => {
  for (const [rm, fades] of [['no-preference', true], ['reduce', false]]) {
    const { page } = await open({ ...MAC, reducedMotion: rm });
    await page.$eval('#skill', (el) => el.scrollIntoView());
    await page.waitForTimeout(600);
    await page.$eval('#skill .filter-btn[data-filter="ai"]', (b) => b.click());
    const s = await page.evaluate(() => [...document.querySelectorAll('#skill .rf-cards-scroller-item')].map((c) => ({
      shown: c.style.display !== 'none',
      fade: c.getAnimations().filter((a) => a.effect && a.effect.getKeyframes().some((k) => k.opacity !== undefined)).map((a) => a.effect.getTiming().duration),
    })));
    const shown = s.filter((c) => c.shown), hidden = s.filter((c) => !c.shown);
    assert.ok(shown.length >= 1 && hidden.length >= 1);
    assert.deepEqual(hidden.map((c) => c.fade.length), hidden.map(() => 0), 'a hidden card fades');
    if (fades) assert.deepEqual(shown.map((c) => c.fade), shown.map(() => [240]), 'a shown card does not fade in over 240ms');
    else assert.deepEqual(shown.map((c) => c.fade.length), shown.map(() => 0), 'a card fades under Reduce Motion');
    await page.waitForTimeout(400);
    assert.deepEqual(await page.$$eval('#skill .rf-cards-scroller-item', (cs) => cs.filter((c) => c.style.display !== 'none' && getComputedStyle(c).opacity !== '1').length), 0, 'a card stays faded');
    await page.close();
  }
});

test('controls > disclosure: the FAQ and the folded clients end in a blue chevron that points right, and down when open (faq-disclosure-chevron)', async () => {
  for (const [where, opts, mt] of [['Mac', MAC, '5px'], ['iPhone', PHONE, '4px']]) {
    const { page } = await open(opts);
    await page.$eval('#services .faq details', (d) => { d.open = true; });
    await page.waitForTimeout(400);
    const [open1, closed] = await page.$$eval('#services .faq summary', (ss) => ss.slice(0, 2).map((s) => {
      const st = getComputedStyle(s, '::after');
      return { w: st.width, h: st.height, t: st.transform, mt: st.marginTop, chev: /viewBox='0 0 8 14'/.test(st.maskImage || st.webkitMaskImage) };
    }));
    assert.deepEqual(closed, { w: '10px', h: '16px', t: 'none', mt, chev: true }, `${where}: a closed question's indicator`);
    assert.deepEqual(open1, { w: '10px', h: '16px', t: 'matrix(0, 1, -1, 0, 0, 0)', mt, chev: true }, `${where}: an open question's chevron does not point down`);
    if (where === 'iPhone') {
      // the folded client rows in the Experience sheet
      await page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
      await page.waitForSelector('.exp-lightbox.open .exp-clients-folded .exp-client-section-header');
      const hs = page.locator('.exp-lightbox.open .exp-clients-folded .exp-client-section-header');
      await hs.nth(1).click();
      await page.waitForTimeout(500);
      const rows = await hs.evaluateAll((els) => els.slice(0, 2).map((h) => { const s = getComputedStyle(h, '::after'); return [s.width, s.height, s.transform, /viewBox='0 0 8 14'/.test(s.maskImage || s.webkitMaskImage)]; }));
      assert.deepEqual(rows, [['10px', '16px', 'none', true], ['10px', '16px', 'matrix(0, 1, -1, 0, 0, 0)', true]], 'the folded client rows');
    }
    await page.close();
  }
});

test('icons > the round corner button shows what it does: a chevron where it opens a story, an expand mark where it opens a picture (plus-glyph-matches-action)', async () => {
  const { page } = await open(MAC);
  const r = await page.evaluate(() => {
    const d = (el) => el.querySelector('path').getAttribute('d');
    const plus = (s) => /^m24 16\.5h-4\.5/.test(s);
    const cards = [...document.querySelectorAll('#portfolio .card-plus')];
    const shots = cards.filter((b) => /^View screenshot/.test(b.getAttribute('aria-label')));
    const stories = cards.filter((b) => /^Read more/.test(b.getAttribute('aria-label')));
    const exp = [...document.querySelectorAll('#experience .exp-card-btn')];
    const cert = getComputedStyle(document.querySelector('#images-list .cert-expand-btn'), '::before');
    return {
      plus: [...document.querySelectorAll('svg path')].filter((p) => plus(p.getAttribute('d') || '')).length,
      stories: stories.length, storyChevron: stories.filter((b) => /^M14\.14 12\.01L20\.54 18\.64/.test(d(b))).length,
      shots: shots.length, shotExpand: shots.filter((b) => d(b) === 'M19.5 16.5 24.5 11.5M20 11.5h4.5V16M16.5 19.5 11.5 24.5M11.5 20v4.5H16' && b.querySelector('path').getAttribute('fill') === 'none').length,
      exp: exp.length, expChevron: exp.filter((b) => /^M14\.14 12\.01L20\.54 18\.64/.test(d(b))).length,
      certExpand: /M19\.5 16\.5 24\.5 11\.5/.test(cert.maskImage || cert.webkitMaskImage),
      size: [...new Set(cards.map((b) => b.offsetWidth))],
    };
  });
  assert.equal(r.plus, 0, 'a "+" glyph is left');
  assert.deepEqual([r.stories, r.storyChevron], [54, 54]);
  assert.deepEqual([r.shots, r.shotExpand], [4, 4]);
  assert.deepEqual([r.exp, r.expChevron], [3, 3]);
  assert.ok(r.certExpand, 'the certificate corner is not the expand mark');
  assert.deepEqual(r.size, [36], 'the round button changed size');
  await page.close();
});

test('icons > one line weight: the project drawings are drawn lighter and the service drawings heavier, to meet on screen (icon-stroke-match)', async () => {
  const { page } = await open(MAC);
  // rendered line = stroke-width x the drawing's scale on screen
  const w = await page.evaluate(() => {
    // the first drawing that is laid out (offsetWidth ignores the scroll reveal's scale)
    const px = (sel) => {
      const p = [...document.querySelectorAll(sel)].find((e) => e.ownerSVGElement.clientWidth > 0);
      const svg = p.ownerSVGElement;
      return parseFloat(getComputedStyle(p).strokeWidth) * svg.clientWidth / svg.viewBox.baseVal.width;
    };
    return {
      svc: parseFloat(getComputedStyle(document.querySelector(".svc-icon svg [stroke-width='5']")).strokeWidth),
      work: [4, 5, 6].map((n) => { const el = document.querySelector(`.work-icon svg [stroke-width='${n}']`); return el ? parseFloat(getComputedStyle(el).strokeWidth) : null; }),
      svcPx: px(".svc-icon svg [stroke-width='5']"), workPx: px(".work-icon svg [stroke-width='5']"),
    };
  });
  assert.equal(w.svc, 6.3);
  assert.deepEqual(w.work.filter((x) => x !== null), [3.5, 4.4, 5.25].filter((_, i) => w.work[i] !== null));
  assert.ok(Math.abs(w.svcPx - w.workPx) / w.workPx < 0.05, `on a Mac the service lines (${w.svcPx.toFixed(2)}px) and project lines (${w.workPx.toFixed(2)}px) differ`);
  await page.close();
  // the Skills marks (72px on phones, 202px on a Mac) meet the project lines too
  for (const [where, opts] of [['iPhone', PHONE], ['Mac', MAC]]) {
    const { page: p } = await open(opts);
    const k = await p.evaluate(() => {
      const px = (sel) => {
        const el = [...document.querySelectorAll(sel)].find((e) => e.ownerSVGElement.clientWidth > 0);
        const svg = el.ownerSVGElement;
        return parseFloat(getComputedStyle(el).strokeWidth) * svg.clientWidth / svg.viewBox.baseVal.width;
      };
      return { skill: px("#skill .skill-icon [stroke-width='5']"), work: px(".work-icon svg [stroke-width='5']") };
    });
    assert.ok(Math.abs(k.skill - k.work) / k.work < 0.1, `${where}: the skill lines (${k.skill.toFixed(2)}px) and project lines (${k.work.toFixed(2)}px) differ`);
    await p.close();
  }
});

test('scroll views > a card row past its last card bounces on its own and never hands the swipe to the page (scroller-overscroll-contain)', async () => {
  const { page } = await open(PHONE);
  assert.deepEqual(await page.$$eval('#scroller, #skill-scroller', (els) => els.map((e) => getComputedStyle(e).overscrollBehaviorX)), ['contain', 'contain']);
  await page.close();
});

test('motion > the project row nudges once as it comes into view and once more 6s later, then stops (nudge-stops-after-use)', async () => {
  const { page } = await open(PHONE);
  await page.$eval('#scroller', (el) => el.scrollIntoView({ block: 'center' }));
  // count the times the row leaves its resting place in the next 10s (it nudged every 3s before)
  const starts = await page.$eval('#scroller', (el) => new Promise((resolve) => {
    // the row rests at its start; a nudge takes it about 80px out and back in 0.5s
    const t0 = performance.now(), out = [];
    let away = false;
    (function tick() {
      const off = el.scrollLeft > 10, t = performance.now() - t0;
      if (off && !away && !(out.length && t / 1000 - out[out.length - 1] < 1)) out.push(Math.round(t / 100) / 10);
      away = off;
      if (performance.now() - t0 < 10000) requestAnimationFrame(tick); else resolve(out);
    })();
  }));
  assert.equal(starts.length, 2, `the row nudged at ${starts.join(', ')}s`);
  assert.ok(Math.abs(starts[1] - starts[0] - 6) < 0.6, `the second nudge came ${(starts[1] - starts[0]).toFixed(1)}s after the first`);
  await page.close();
  // a touch swipe on the row stops the nudging for good
  const { page: p } = await open(PHONE);
  await p.$eval('#scroller', (el) => el.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(1000);
  const box = await p.$eval('#scroller', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const cdp = await p.context().newCDPSession(p);
  const at = (x) => [{ x, y: box.y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(box.x + 100) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(box.x + 100 - i * 15) });
    await p.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(1500);
  const moves = await p.$eval('#scroller', (el) => new Promise((resolve) => {
    const t0 = performance.now(), rest = el.scrollLeft, out = [];
    (function tick() {
      if (Math.abs(el.scrollLeft - rest) > 2) out.push(Math.round((performance.now() - t0) / 100) / 10);
      if (performance.now() - t0 < 10000) requestAnimationFrame(tick); else resolve(out);
    })();
  }));
  assert.deepEqual(moves.slice(0, 3), [], `after a swipe the row moved again at ${moves[0]}s`);
  await p.close();
});

test('layout > the Skills cards are as tall as the Projects cards, words on top and the drawing at the foot, every card whole (q-skills-card)', async () => {
  for (const [w, icon] of [[320, 72], [390, 72], [430, 72], [768, 172], [1440, 202]]) {
    const { page } = await open({ viewport: { width: w, height: 900 }, isMobile: w < 1024, hasTouch: w < 1024, reducedMotion: 'reduce' });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const proj = document.querySelector('#portfolio .rf-cards-scroller-item').offsetHeight;
      const cards = [...document.querySelectorAll('#skill .rf-cards-scroller-item')].map((c) => {
        const q = (s) => c.querySelector(s).getBoundingClientRect(), cr = c.getBoundingClientRect();
        const [tag, title, desc, tools, ic] = ['.skill-tag', '.title', '.skill-desc', '.skill-tools', '.skill-icon'].map(q);
        return {
          name: c.querySelector('.title').textContent.trim(), h: c.offsetHeight, icon: [Math.round(ic.width), Math.round(ic.height)],
          order: tag.bottom <= title.top + 0.5 && title.bottom <= desc.top + 0.5 && desc.bottom <= tools.top + 0.5 && tools.bottom <= ic.top + 0.5,
          toolsUnder: Math.round(tools.top - desc.bottom), centred: Math.abs((ic.left + ic.right) / 2 - (cr.left + cr.right) / 2) < 1,
          inside: [tag, title, desc, tools, ic].every((b) => b.left >= cr.left - 0.5 && b.right <= cr.right + 0.5 && b.bottom <= cr.bottom + 0.5),
          cut: [...c.querySelectorAll('.skill-tag, .title, .skill-desc, .skill-tools li')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).length,
        };
      });
      return { proj, cards, sideways: document.documentElement.scrollWidth - innerWidth };
    });
    assert.equal(r.sideways, 0, `${w}px: the page scrolls sideways`);
    assert.equal(r.cards.length, 12);
    for (const c of r.cards) {
      assert.equal(c.h, r.proj, `${w}px: ${c.name} is ${c.h}px tall, the project cards ${r.proj}px`);
      assert.ok(c.order, `${w}px: ${c.name} is not eyebrow, title, description, tools, drawing from the top`);
      assert.equal(c.toolsUnder, 0, `${w}px: ${c.name}'s tools are not right under its description`);
      assert.deepEqual(c.icon, [icon, icon], `${w}px: ${c.name}'s drawing is not a ${icon}px square`);
      assert.ok(c.centred && c.inside, `${w}px: ${c.name}'s parts are off centre or past the card's edge`);
      assert.equal(c.cut, 0, `${w}px: ${c.name} has cut text`);
    }
    // a filter keeps the height (skill-filter-segmented, skill-filter-fade-in)
    await page.$eval('#skill .filter-btn[data-filter="ai"]', (b) => b.click());
    await page.waitForTimeout(400);
    const hs = await page.$$eval('#skill .rf-cards-scroller-item', (cs) => cs.filter((c) => c.style.display !== 'none').map((c) => c.offsetHeight));
    assert.ok(hs.length >= 1 && hs.every((h) => h === r.proj), `${w}px: filtered cards are ${hs.join(', ')}px tall`);
    await page.close();
  }
});

const IPAD = { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Opens the current job's sheet from its card's "+" and waits for it to settle. */
async function openProtollcall(page) {
  await page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open .exp-client-section');
  await page.waitForTimeout(450);
}

test('modality > the sheet stays short: on iPad and Mac too each client folds to its name, right after the role overview (sheet-fold-all-sizes)', async () => {
  for (const [where, opts, most] of [['Mac', MAC, 7.5], ['iPad', IPAD, 6]]) {
    const { page, errors } = await open({ ...opts, reducedMotion: 'reduce' });
    await openProtollcall(page);
    const r = await page.evaluate(() => {
      const inner = document.querySelector('.exp-lightbox-inner');
      const block = inner.querySelector('.exp-client-section').closest('.exp-modal-section');
      const secs = [...inner.querySelectorAll('.exp-client-section')];
      return {
        folded: block.classList.contains('exp-clients-folded'),
        after: block.previousElementSibling && !!block.previousElementSibling.querySelector('.exp-modal-overview'),
        open: secs.filter((s) => getComputedStyle(s.querySelector('ul')).display !== 'none').length,
        toggles: inner.querySelectorAll('.exp-client-toggle[aria-expanded="false"]').length, n: secs.length,
        heights: inner.scrollHeight / inner.clientHeight,
        sideways: inner.scrollWidth - inner.clientWidth,
      };
    });
    assert.ok(r.folded, `${where}: the clients are not folded`);
    assert.ok(r.after, `${where}: the client list does not follow the role overview`);
    assert.equal(r.open, 0, `${where}: ${r.open} client stories show before they are opened`);
    assert.equal(r.toggles, r.n, `${where}: a client row is not a collapsed disclosure button`);
    assert.ok(r.heights <= most, `${where}: the sheet runs to ${r.heights.toFixed(1)} sheet heights`);
    assert.equal(r.sideways, 0, `${where}: the sheet scrolls sideways`);
    // a click on a row opens that client's story, and only that one
    const head = page.locator('.exp-lightbox.open .exp-client-section-header').nth(1);
    await head.click();
    const opened = await page.$$eval('.exp-lightbox.open .exp-client-section', (ss) =>
      ss.filter((s) => getComputedStyle(s.querySelector('ul')).display !== 'none').map((s) => s.dataset.client));
    assert.deepEqual(opened, ['kasikorn'], `${where}: clicking the second row opened ${opened.join(', ')}`);
    // the row's padding opens it too, not only the header strip
    const third = page.locator('.exp-lightbox.open .exp-client-section').nth(2);
    await third.scrollIntoViewIfNeeded();
    const box = await third.boundingBox();
    await page.mouse.click(box.x + box.width - 12, box.y + box.height - 10);
    assert.equal(await third.evaluate((s) => s.classList.contains('is-open')), true,
      `${where}: a click in the third row's bottom padding left it closed`);
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('controls > pop-up button: the 35 client chips are one grey "All Clients" capsule, 44px tall with 17px text, that filters the stories (sheet-client-popup)', async () => {
  for (const [where, opts] of [['small phone', SMALL], ['iPhone', PHONE], ['iPad', IPAD], ['Mac', MAC]]) {
    const { page, errors } = await open({ ...opts, reducedMotion: 'reduce' });
    await openProtollcall(page);
    const r = await page.evaluate(() => {
      const inner = document.querySelector('.exp-lightbox-inner');
      const sel = inner.querySelector('select.exp-client-select');
      const cs = sel && getComputedStyle(sel), q = sel && sel.getBoundingClientRect();
      return {
        chips: inner.querySelectorAll('.exp-filter-chip, .exp-client-filter button').length,
        selects: inner.querySelectorAll('.exp-client-filter select').length,
        options: sel && sel.options.length, first: sel && sel.options[0].text, value: sel && sel.value,
        h: q && q.height, font: cs && cs.fontSize, bg: cs && cs.backgroundColor, radius: cs && parseFloat(cs.borderRadius) >= q.height / 2,
        label: sel && sel.getAttribute('aria-label'),
        count: document.querySelector('[data-exp="protollcall"] .exp-stat-clients').textContent,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.deepEqual([r.chips, r.selects], [0, 1], `${where}: chips ${r.chips}, pop-up buttons ${r.selects}`);
    assert.deepEqual([r.options, r.first, r.value], [35, 'All Clients', 'all'], `${where}: the pop-up's choices`);
    assert.deepEqual([r.h, r.font, r.bg, r.radius], [44, '17px', 'rgb(232, 232, 237)', true], `${where}: the capsule's look`);
    assert.equal(r.label, 'Client');
    assert.equal(r.count, '33', `${where}: the client count changed`);
    assert.equal(r.sideways, 0, `${where}: the page scrolls sideways`);
    if (opts.isMobile && opts.viewport.width < 735) {
      // scrolled into the stories, the capsule sticks under the sheet's top bar
      // (v2.73.0, sheet-title-bar: it used to stick beside the close button),
      // 10px of air above and below it, the full width its own
      await page.evaluate(() => { const inner = document.querySelector('.exp-lightbox-inner'); inner.scrollTop = inner.querySelector('.exp-client-section[data-client="vietjet"]').offsetTop - 120; });
      await page.waitForTimeout(150);
      const s = await page.evaluate(() => {
        const inner = document.querySelector('.exp-lightbox-inner').getBoundingClientRect();
        const a = document.querySelector('.exp-lightbox .exp-client-select').getBoundingClientRect();
        const b = document.querySelector('.exp-lightbox .exp-lightbox-close').getBoundingClientRect();
        const bar = document.querySelector('.exp-lightbox .exp-sheet-bar').getBoundingClientRect();
        const row = document.querySelector('.exp-lightbox .exp-client-filter').getBoundingClientRect();
        return { mid: [a.top + a.height / 2 - inner.top, b.top + b.height / 2 - inner.top], under: a.top - bar.bottom, below: row.bottom - a.bottom };
      });
      assert.deepEqual(s.mid, [84, 28], `${where}: the stuck capsule is not under the top bar, or the close button is not 8px from the sheet's edge`);
      assert.deepEqual([s.under, s.below], [10, 10], `${where}: the air around the stuck capsule`);
    }
    await page.selectOption('.exp-lightbox.open .exp-client-select', 'vietjet');
    const shown = await page.$$eval('.exp-lightbox.open .exp-client-section', (ss) => ss.filter((s) => s.style.display !== 'none').map((s) => s.dataset.client + (s.classList.contains('is-open') ? ' open' : '')));
    assert.deepEqual(shown, ['vietjet open'], `${where}: choosing Thai VietJet Air left ${shown.join(', ')}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  // opened from a client's project card: that client is already chosen
  const { page } = await open({ ...MAC, reducedMotion: 'reduce' });
  await page.$eval('#portfolio [data-open-exp][data-client="kasikorn"]', (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open .exp-client-select');
  assert.equal(await page.$eval('.exp-lightbox.open .exp-client-select', (s) => s.value), 'kasikorn');
  await page.close();
});

test('motion > no hint wave is left in the sheet once the chips are gone (chip-hint-once, moot under sheet-client-popup)', async () => {
  const { page } = await open(MAC);
  const css = await page.evaluate(() => [...document.styleSheets].some((sh) => {
    try { return [...sh.cssRules].some((r) => /chip-hint/.test(r.cssText)); } catch { return false; }
  }));
  assert.equal(css, false, 'a chip-hint animation is still defined');
  await openProtollcall(page);
  await page.waitForTimeout(1200);   // the old wave started 450ms after opening
  const moved = await page.$$eval('.exp-lightbox.open .exp-client-filter *, .exp-lightbox.open .exp-client-filter', (els) =>
    els.filter((el) => el.classList.contains('hint') || getComputedStyle(el).animationName !== 'none').length);
  assert.equal(moved, 0, 'something in the client picker animates after the sheet opens');
  await page.close();
});

test('layout > on a Mac nothing floats on the window\'s bottom edge: Back to top is for touch screens only (mac-back-to-top-hidden)', async () => {
  const { page } = await open(MAC);
  await page.evaluate(() => scrollTo(0, 6000));
  await page.waitForTimeout(400);
  assert.equal(await page.$eval('#back-to-top', (b) => getComputedStyle(b).display), 'none', 'Mac: Back to top is drawn');
  await page.close();
  // an iPhone keeps it: it comes out as the page moves back up
  const ph = await open(PHONE);
  await ph.page.evaluate(() => scrollTo(0, 6000));
  await ph.page.waitForTimeout(100);
  for (let y = 5960; y >= 5800; y -= 40) {
    await ph.page.evaluate((to) => new Promise((done) => { scrollTo(0, to); requestAnimationFrame(() => requestAnimationFrame(done)); }), y);
  }
  await ph.page.waitForFunction(() => document.getElementById('back-to-top').classList.contains('visible'));
  assert.notEqual(await ph.page.$eval('#back-to-top', (b) => getComputedStyle(b).display), 'none', 'iPhone: Back to top is gone');
  await ph.page.close();
});

test('feedback > on a Mac the confirmation drops in at the top centre, 24px down; phones keep it 28px above the bottom (mac-toast-top)', async () => {
  for (const [where, opts, want] of [['Mac', MAC, { top: 24 }], ['iPhone', PHONE, { bottom: 28 }]]) {
    const { page } = await open({ ...opts, reducedMotion: 'reduce' });
    await page.evaluate(() => window._toast('Downloading the CV'));
    await page.waitForTimeout(400);
    const r = await page.$eval('.toast', (t) => {
      const q = t.getBoundingClientRect();
      return { top: Math.round(q.top), bottom: Math.round(innerHeight - q.bottom), centre: Math.round(q.left + q.width / 2 - innerWidth / 2) };
    });
    if (want.top !== undefined) assert.equal(r.top, want.top, `${where}: the toast's top`);
    else assert.equal(r.bottom, want.bottom, `${where}: the toast's gap to the bottom`);
    assert.ok(Math.abs(r.centre) <= 1, `${where}: the toast is off centre by ${r.centre}px`);
    await page.close();
  }
});

test('feedback > a confirmation stays 5s; a pointer on it holds it, and it goes 2s after the pointer leaves; Escape or a click closes it (toast-longer-hover-pause)', async () => {
  const { page } = await open({ ...MAC, reducedMotion: 'reduce' });
  const shown = () => page.$eval('.toast', (t) => t.classList.contains('is-shown'));
  await page.mouse.move(10, 600);
  await page.evaluate(() => window._toast('Downloading the CV'));
  await page.waitForTimeout(4500);
  assert.equal(await shown(), true, 'gone before 4.5s');
  await page.waitForTimeout(1000);
  assert.equal(await shown(), false, 'still there after 5.5s');
  // held by the pointer well past 5s, then 2s more once it leaves
  await page.evaluate(() => window._toast('Downloading the CV'));
  await page.waitForTimeout(300);
  assert.equal(await page.$eval('.toast', (t) => getComputedStyle(t).pointerEvents), 'auto', 'a shown toast does not take the pointer');
  const c = await page.$eval('.toast', (t) => { const q = t.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(c[0], c[1]);
  await page.waitForTimeout(5800);
  assert.equal(await shown(), true, 'it left from under the pointer');
  await page.mouse.move(10, 600);
  await page.waitForTimeout(1500);
  assert.equal(await shown(), true, 'gone sooner than 2s after the pointer left');
  await page.waitForTimeout(900);
  assert.equal(await shown(), false, 'still there 2.4s after the pointer left');
  // Escape and a click anywhere close it at once
  await page.evaluate(() => window._toast('x'));
  await page.keyboard.press('Escape');
  assert.equal(await shown(), false, 'Escape left it up');
  await page.evaluate(() => window._toast('x'));
  await page.mouse.click(10, 600);
  assert.equal(await shown(), false, 'a click elsewhere left it up');
  await page.close();
});

test('layout > the footer starts on the same left edge as every section and its own separator; phones keep the copyright centred (footer-aligned)', async () => {
  for (const [where, opts, centred] of [['small phone', SMALL, true], ['iPhone', PHONE, true], ['iPad', IPAD, true], ['Mac', MAC, false]]) {
    const { page } = await open(opts);
    const r = await page.evaluate(() => {
      const f = document.getElementById('footer');
      const sec = document.querySelector('#contact .container');
      const edge = sec.getBoundingClientRect().left + parseFloat(getComputedStyle(sec).paddingLeft);
      const copy = f.querySelector('.border-top .text-body-secondary');
      return {
        edge: Math.round(edge), name: Math.round(f.querySelector('.col-12 > div').getBoundingClientRect().left),
        sep: Math.round(f.querySelector('.border-top').getBoundingClientRect().left),
        copy: Math.round(copy.getBoundingClientRect().left), align: getComputedStyle(copy.parentNode).textAlign,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(r.name, r.edge, `${where}: the footer name starts at ${r.name}, the sections at ${r.edge}`);
    assert.equal(r.sep, r.edge, `${where}: the separator starts at ${r.sep}`);
    if (centred) assert.equal(r.align, 'center', `${where}: the copyright is no longer centred`);
    else assert.equal(r.copy, r.edge, `${where}: the copyright starts at ${r.copy}`);
    assert.equal(r.sideways, 0, `${where}: the page scrolls sideways`);
    // the Contact column moves left with the rest: 948.8 / 538.8 in v2.71.0, 12.5px further left now
    const was = { iPad: 538.8, Mac: 948.8 }[where];
    if (was) {
      const contact = await page.evaluate(() => [...document.querySelectorAll('#footer *')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Contact').getBoundingClientRect().left);
      assert.ok(Math.abs(contact - (was - 12.5)) <= 1, `${where}: the footer Contact heading starts at ${contact}`);
    }
    await page.close();
  }
});

test('layout > hit regions: on a Mac the footer icons and contact lines answer a 44px square, as on phones (footer-hit-regions-mac)', async () => {
  for (const [where, opts] of [['Mac', MAC], ['iPhone', PHONE]]) {
    const { page } = await open(opts);
    const r = await page.evaluate(() => {
      const icons = [...document.querySelectorAll('.social-links-footer a')].map((a) => a.getBoundingClientRect());
      return {
        icons: icons.map((q) => [Math.round(q.width), Math.round(q.height)]),
        pitch: icons.slice(1).map((q, i) => Math.round(q.left - icons[i].left)),
        lines: [...document.querySelectorAll('.footer-contact-link')].map((a) => Math.round(a.getBoundingClientRect().height)),
        // the first glyph stays on the text's edge (2px in, as the icon draws it)
        glyph: Math.round(document.querySelector('.social-links-footer svg').getBoundingClientRect().left -
          [...document.querySelectorAll('#footer .col-12 > div')].find((d) => d.textContent.trim() === 'Contact').getBoundingClientRect().left),
      };
    });
    assert.deepEqual(r.icons, [[44, 44], [44, 44], [44, 44], [44, 44]], `${where}: the footer icons' hit areas`);
    assert.deepEqual(r.pitch, [44, 44, 44], `${where}: the icons overlap or leave gaps`);
    assert.deepEqual(r.lines, [44, 44], `${where}: the contact lines' height`);
    assert.equal(r.glyph, 2, `${where}: the first icon moved off the text's edge`);
    await page.close();
  }
});

test('layout > compact height: a phone held sideways gets the phone spacing, 128px round each section and 56px under its title; other screens keep theirs (landscape-compact-height-spacing)', async () => {
  for (const [where, opts, pad, title] of [
    ['iPhone sideways', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, '128px', '56px'],
    ['a 480px-tall window', { viewport: { width: 1440, height: 480 } }, '128px', '56px'],
    ['iPhone', PHONE, '128px', '56px'], ['iPad', IPAD, '220px', '96px'], ['Mac', MAC, '220px', '96px'],
  ]) {
    const { page } = await open(opts);
    const r = await page.evaluate(() => ({
      pads: [...new Set(['#resume', '#experience', '#skill', '#certificates', '#services', '#contact'].map((s) => getComputedStyle(document.querySelector(s)).paddingTop))],
      title: getComputedStyle(document.querySelector('#resume .section-title')).paddingBottom,
      hero: getComputedStyle(document.getElementById('hero')).paddingTop,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    assert.deepEqual(r.pads, [pad], `${where}: section padding ${r.pads.join(', ')}`);
    assert.equal(r.title, title, `${where}: the space under a section title`);
    assert.equal(r.sideways, 0, `${where}: the page scrolls sideways`);
    if (opts.viewport.height <= 500) assert.equal(r.hero, '0px', `${where}: the hero got padding back`);
    await page.close();
  }
});

test('app icons > one simple mark, the same everywhere: the tab, Home Screen and Android icons are the card\'s three-node mark in white on #1264CE, not a photo (web-clip-mark)', async () => {
  const { page } = await open(MAC);
  const icons = await page.evaluate(async () => {
    const links = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')];
    const out = [];
    for (const l of links) {
      const status = await fetch(l.href, { cache: 'no-store' }).then((r) => r.status, () => 0);
      const img = new Image();
      img.src = l.href;
      const decoded = await img.decode().then(() => true, () => false);
      if (!decoded) { out.push({ file: l.getAttribute('href'), status, decoded }); continue; }
      const w = img.naturalWidth || 180, h = img.naturalHeight || 180;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      let white = 0, clear = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) white++;
        if (d[i + 3] < 255) clear++;
      }
      const px = (x, y) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];
      out.push({
        rel: l.rel, type: l.type, file: l.getAttribute('href'), status, w, h,
        corners: [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)],
        white: white / (w * h), clear,
      });
    }
    return out;
  });
  const files = icons.map((i) => i.file);
  assert.ok(icons.some((i) => i.rel === 'icon' && i.type === 'image/svg+xml'), `no SVG favicon among ${files.join(', ')}`);
  assert.ok(icons.some((i) => i.rel === 'apple-touch-icon' && i.w === 180 && i.h === 180), 'no 180px Home Screen icon');
  // the photo icons' old addresses would still be answered from caches
  for (const old of ['assets/img/favicon.ico', 'assets/img/icon-180.png', 'assets/img/icon-192.png']) {
    assert.ok(!files.includes(old), `${old} (the photo icon's address) is still linked`);
  }
  for (const i of icons) {
    assert.equal(i.status, 200, `${i.file} is missing`);
    assert.notEqual(i.decoded, false, `${i.file} does not decode`);
    // full-bleed accent blue to every corner, opaque, so iOS draws no black edge
    for (const c of i.corners) assert.ok(c.every((v, k) => Math.abs(v - [18, 100, 206][k]) <= 3), `${i.file}: a corner is ${c}, not #1264CE`);
    assert.equal(i.clear, 0, `${i.file}: ${i.clear} see-through pixels`);
    // the white mark is a small part of the square, never a photo's highlights
    // (at 32px antialiasing leaves about 5% pure white)
    assert.ok(i.white > 0.03 && i.white < 0.3, `${i.file}: ${(i.white * 100).toFixed(1)}% white`);
  }
  await page.close();
});

test('materials > the business card is frosted glass: 55% white over the blue light, the white rims kept, no glare under the pointer (glass-card-standard-material, closest)', async () => {
  const { page } = await open(MAC);
  await page.$eval('#biz-scene', (el) => el.scrollIntoView({ block: 'center' }));
  const look = () => page.$eval('#biz-card', (el) => {
    const s = getComputedStyle(el), b = getComputedStyle(el, '::before');
    return { bg: s.backgroundColor, filter: s.backdropFilter, shadow: s.boxShadow, before: b.content, glare: b.backgroundImage };
  });
  const rest = await look();
  assert.equal(rest.bg, 'rgba(255, 255, 255, 0.55)', 'the card\'s tint');
  assert.match(rest.filter, /blur\(18px\).*brightness\(1\.05\)/, 'the backdrop blur');
  assert.match(rest.shadow, /inset/, 'the white inner rims went');
  assert.equal(rest.before, 'none', 'the card still draws a ::before layer (glare or grain)');
  const box = await page.$eval('#biz-card', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + 40, y: r.top + 40 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.waitForTimeout(450);
  assert.deepEqual(await look(), rest, 'the card changes under the pointer');
  await page.close();
});

test('motion > the business card does not tip toward the pointer; it keeps its own slow sway and its links stay put (bizcard-no-pointer-tilt)', async () => {
  // two Macs on the same frozen clock: one rests the pointer on the card's
  // top-right corner, the other away from it; after the same 3s the card
  // stands at the same angle in both
  const run = async (onCard) => {
    const page = await ctx.browser.newPage({ serviceWorkers: 'block', ...MAC });
    await page.route((u) => !u.href.startsWith(ctx.srv.url), (r) => r.abort());
    await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
    await page.waitForFunction(styled, null, { timeout: 8000 });
    // the clock stops before the card comes into view, so both sways start
    // from the same frame
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await page.$eval('#biz-scene', (el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const r = await page.$eval('#biz-scene', (el) => { const q = el.getBoundingClientRect(); return { x: q.right - 12, y: q.top + 12 }; });
    await page.mouse.move(onCard ? r.x : 20, onCard ? r.y : 20);
    for (let i = 0; i < 30; i++) {
      await page.clock.runFor(100);
      await page.mouse.move((onCard ? r.x : 20) + (i % 2), onCard ? r.y : 20);
    }
    const out = await page.evaluate(() => ({
      t: document.getElementById('biz-card').style.transform,
      mail: (() => { const q = document.querySelector('#biz-card a[href^="mailto:"]').getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map((v) => Math.round(v)); })(),
    }));
    await page.close();
    return out;
  };
  const [on, off] = [await run(true), await run(false)];
  assert.match(off.t, /rotateY/, 'the card stopped swaying');
  assert.equal(on.t, off.t, 'the card turns toward the pointer');
  assert.deepEqual(on.mail, off.mail, 'the e-mail link moves under the pointer');
});

test('layout > hit regions: where the card\'s e-mail and phone stack they sit 44px apart, so a finger on the e-mail never lands on the phone (biz-links-44-pitch-320)', async () => {
  for (const [w, cardH] of [[320, 207.2], [375, 208.1], [387, null]]) {
    const { page } = await open({ ...SMALL, viewport: { width: w, height: 700 }, reducedMotion: 'reduce' });
    await page.$eval('#biz-scene', (el) => el.scrollIntoView({ block: 'center' }));
    const r = await page.evaluate(() => {
      const [mail, tel] = [...document.querySelectorAll('#biz-card .biz-contacts a')];
      const m = mail.getBoundingClientRect(), t = tel.getBoundingClientRect();
      const cx = m.left + 20, cy = m.top + m.height / 2;
      // a finger landing 20px either side of the e-mail's centre still reaches it
      // (the two 44px hit areas meet exactly; the card's layer snaps to whole
      // pixels, so the last pixel at the seam can go either way)
      const reach = [-20, 20].map((dy) => mail.contains(document.elementFromPoint(cx, cy + dy)));
      return { pitch: t.top - m.top, reach, card: document.getElementById('biz-card').getBoundingClientRect().height, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.ok(Math.abs(r.pitch - 44) < 0.5, `${w}px: e-mail to phone ${r.pitch.toFixed(1)}px apart`);
    assert.deepEqual(r.reach, [true, true], `${w}px: the e-mail's hit area is cut by its neighbours`);
    if (cardH) assert.ok(Math.abs(r.card - cardH) < 0.5, `${w}px: the card is ${r.card.toFixed(1)}px tall, expected ${cardH}`);
    assert.equal(r.sideways, 0, `${w}px: the page scrolls sideways`);
    await page.close();
  }
  // side by side (388px and up) nothing moves: the gap only applies between stacked lines
  for (const [opts, top] of [[PHONE, 165.3], [MAC, 214.4]]) {
    const { page } = await open({ ...opts, reducedMotion: 'reduce' });
    const r = await page.evaluate(() => {
      const c = document.getElementById('biz-card').getBoundingClientRect();
      return [...document.querySelectorAll('#biz-card .biz-contacts a')].map((a) => Math.round((a.getBoundingClientRect().top - c.top) * 10) / 10);
    });
    assert.deepEqual(r, [top, top], `${opts.viewport.width}px: the e-mail and phone moved`);
    await page.close();
  }
});

// ---------------------------------------------------------------------------
// Round 2 (v2.73.0): copy and text
// ---------------------------------------------------------------------------

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

test('buttons > title-style capitalisation on every button and link label, and one name per action (button-label-case)', async () => {
  const { page } = await open({ ...PHONE, reducedMotion: 'reduce' });
  const r = await page.evaluate((textSrc) => {
    const text = eval('(' + textSrc + ')');
    const q = (s) => document.querySelector(s);
    const sheetLinks = [...document.querySelectorAll('template')].flatMap((t) => [...t.content.querySelectorAll('a.exp-sheet-link')].map(text));
    const resume = [...document.querySelectorAll('#resume a.resume-exp-link')].map((a) => {
      const cs = getComputedStyle(a);
      return { text: text(a), more: a.classList.contains('more'), chev: !!a.querySelector('.chev'), weight: cs.fontWeight, top: Math.round(a.getBoundingClientRect().top), inline: a.getAttribute('style') };
    });
    return {
      hero: text(q('#hero .btn-pill')), all: text(q('[data-proj-all]')), contact: text(q('#contact .cta-pill')), sheetLinks, resume,
      cv: [...document.querySelectorAll('a[download][href$="CV.pdf"]')].map(text),
      expCta: [...document.querySelectorAll('#experience .exp-card-cta')].map((b) => b.getAttribute('aria-label')),
    };
  }, text.toString());
  assert.equal(r.hero, 'View Projects');
  assert.match(r.all, /^See All \d+ Projects$/);
  assert.equal(r.contact, 'Get in Touch');
  assert.equal(r.sheetLinks.length, 18, 'one contact link at the foot of each of the 18 sheets');
  assert.deepEqual([...new Set(r.sheetLinks)], ['Get in Touch'], 'the sheet links spell the label as the Contact pill does');
  assert.deepEqual(r.resume.map((l) => l.text), ['View Experience', 'Download CV']);
  for (const l of r.resume) {
    assert.ok(l.more && l.chev, `"${l.text}" is not the site's standard link with a drawn chevron`);
    assert.equal(l.weight, '400', `"${l.text}" is not regular weight`);
    assert.equal(l.inline, null, `"${l.text}" still carries inline styles`);
  }
  assert.equal(r.resume[0].top, r.resume[1].top, 'on an iPhone the two Profile links share one row');
  assert.deepEqual([...new Set(r.cv)], ['Download CV'], 'the CV link has one name everywhere');
  assert.equal(r.expCta.length, 3);
  for (const n of r.expCta) assert.match(n, /^Read More: /);
  // the back pill of a project opened from the See All list
  await page.click('[data-proj-all]');
  await page.waitForSelector('.proj-row');
  await page.click('.proj-row');
  await page.waitForSelector('.proj-back');
  // (the pill also carries the project's name for screen readers)
  assert.match(await page.$eval('.proj-back', (b) => b.textContent.trim()), /^All Projects/);
  await page.close();
});

test('writing > FAQ answers speak in the first person; the structured data says the same; numbers and the LinkedIn name stay whole (faq-first-person)', async () => {
  const src = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const faq = [...src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((b) => b['@type'] === 'FAQPage');
  for (const [where, opts] of [['320', SMALL], ['iPhone', PHONE], ['iPad', { viewport: { width: 820, height: 1180 } }], ['Mac', MAC]]) {
    const { page } = await open({ ...opts, reducedMotion: 'reduce' });
    const r = await page.evaluate((textSrc) => {
      const text = eval('(' + textSrc + ')');
      document.querySelectorAll('#services .faq details').forEach((d) => { d.open = true; });
      const lines = (el) => new Set([...el.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
      return {
        qa: [...document.querySelectorAll('#services .faq details')].map((d) => [text(d.querySelector('summary')), text(d.querySelector('p'))]),
        tel: [...document.querySelectorAll('#services .faq a[href^="tel:"]')].map(lines),
        name: [...document.querySelectorAll('#services .faq a[href*="linkedin.com"] .nw')].map((n) => [text(n), lines(n)]),
        wbr: [...document.querySelectorAll('#services .faq a[href*="linkedin.com"]')].map((a) => a.innerHTML.includes('/in/<wbr>')),
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, text.toString());
    assert.equal(r.qa.length, 13);
    for (const [q, a] of r.qa) assert.doesNotMatch(a, /^(รับครับ |มีครับ |ใช่ครับ |Yes\. |Contact )?(ธนพล ชำนาญหาญ|Tanapol Chamnanhan)/, `${where}: "${q}" is answered in the third person`);
    assert.match(r.qa[0][1], /^ผมเป็น Full-Stack Developer/);
    assert.match(r.qa[5][1], /^Contact me via email/);
    assert.deepEqual(r.qa, faq.mainEntity.map((e) => [e.name, e.acceptedAnswer.text]), `${where}: the FAQPage data differs from the visible questions and answers`);
    assert.ok(r.tel.length >= 2 && r.tel.every((n) => n === 1), `${where}: a phone number wraps (${r.tel})`);
    assert.ok(r.name.length >= 2 && r.name.every(([t, n]) => t === 'tanapol-chamnanhan/' && n === 1), `${where}: the LinkedIn name breaks at its hyphen`);
    assert.ok(r.wbr.every(Boolean), 'the LinkedIn address may break after "/in/"');
    assert.equal(r.sideways, 0, `${where}: the page scrolls sideways`);
    await page.close();
  }
});

test('writing > abbreviations are spelled out in the text or carry their full name (jargon-defined)', async () => {
  for (const [where, opts] of [['320', SMALL], ['iPhone', PHONE], ['iPad', { viewport: { width: 820, height: 1180 } }], ['1280', { viewport: { width: 1280, height: 800 } }], ['Mac', MAC]]) {
    const { page } = await open({ ...opts, reducedMotion: 'reduce' });
    const r = await page.evaluate((textSrc) => {
      const text = eval('(' + textSrc + ')');
      const lines = (el) => new Set([...el.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
      const abbr = [...document.querySelectorAll('abbr')];
      const inSheets = [...document.querySelectorAll('template')].flatMap((t) => [...t.content.querySelectorAll('abbr')]);
      const tts = [...document.querySelectorAll('.profile-bio .nw')].find((n) => /^text-to-speech/.test(n.textContent));
      return {
        bio: text(document.querySelector('.profile-bio')),
        tts: tts ? lines(tts) : -1,
        story: text(document.querySelector('[data-exp="protollcall"] .exp-card-desc, [data-exp="protollcall"] p')),
        card: text(document.querySelector('[data-exp="protollcall"]')),
        page: abbr.length, sheets: inSheets.length,
        untitled: [...abbr, ...inSheets].filter((a) => !a.title).length,
        names: [...new Set([...abbr, ...inSheets].map((a) => a.textContent + '=' + a.title))].sort(),
        line: getComputedStyle(abbr[0]).textDecorationLine + ' ' + getComputedStyle(abbr[0]).textDecorationStyle,
        // a question with an abbreviation is still one piece of text beside its chevron
        split: [...document.querySelectorAll('#services .faq summary')].filter((s) => s.querySelector('abbr') && s.children.length !== 1).length,
        qH: [...document.querySelectorAll('#services .faq summary')].map((s) => Math.round(s.getBoundingClientRect().height)),
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, text.toString());
    assert.match(r.bio, /LLM \(large language model\) integration, voice AI \(speech recognition, text-to-speech, speech-to-speech\)/, `${where}: the bio`);
    assert.doesNotMatch(r.bio, /ASR|TTS/);
    assert.equal(r.tts, 1, `${where}: "text-to-speech" breaks at a hyphen`);
    assert.match(r.card, /CRM \(customer relationship management\) systems/);
    assert.match(r.card, /IVR \(interactive voice response\)/);
    assert.doesNotMatch(r.card, /TTS\/ASR\/LLM/);
    assert.equal(r.page, 69, `${where}: abbreviations marked on the page`);
    assert.equal(r.sheets, 88, 'abbreviations marked in the sheets');
    assert.equal(r.untitled, 0);
    assert.deepEqual(r.names, ['ASR=automatic speech recognition', 'CRM=customer relationship management', 'IVR=interactive voice response', 'LLM=large language model', 'TTS=text-to-speech']);
    assert.match(r.line, /underline dotted/);
    assert.equal(r.split, 0, 'a FAQ question is split into columns around its abbreviation');
    assert.equal(r.sideways, 0, `${where}: the page scrolls sideways`);
    await page.close();
  }
});

test('writing > durations use whole words everywhere: years and months (duration-units-consistent)', async () => {
  const src = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(src.slice(src.indexOf('<body')), /\d (yrs?|mos?)\b/, 'an abbreviated unit is left in the page');
  const { page } = await open({ ...PHONE, reducedMotion: 'reduce' });
  // June 2024 to a fixed "today" is checked through the page's own clock
  const r = await page.evaluate((textSrc) => {
    const text = eval('(' + textSrc + ')');
    return {
      chips: [...document.querySelectorAll('#experience .exp-duration')].map(text),
      periods: [...document.querySelectorAll('#experience [data-exp="scg"] *')].filter((e) => !e.children.length || e.matches('strong, .exp-period')).map(text).filter((t) => /20\d\d - .* · /.test(t)),
      all: text(document.querySelector('#experience')),
    };
  }, text.toString());
  assert.match(r.chips[0], /^(\d+ years? ?)?(\d+ months?)?$/, `the live duration reads "${r.chips[0]}"`);
  assert.ok(r.chips[0].length > 0);
  assert.deepEqual(r.chips.slice(1), ['2 internships · 8 months', '4 months']);
  assert.match(r.all, /December 2023 - March 2024 · 4 months/);
  assert.match(r.all, /April 2023 - July 2023 · 4 months/);
  assert.doesNotMatch(r.all, /\b(yrs?|mos)\b/);
  await page.close();
});

test('typography > at very large text a hyphenated name wraps rather than runs off its card; chips wrap at their spaces (nowrap-release-large-text)', async () => {
  const probe = () => {
    const cs = (s) => { const c = getComputedStyle(document.querySelector(s)); return c.display + ' ' + c.whiteSpaceCollapse + ' ' + c.textWrapMode; };
    const qa = [...document.querySelectorAll('.nw')].filter((n) => n.getClientRects().length).find((n) => n.textContent === 'Question-Answering');
    const box = qa.closest('.data-box').getBoundingClientRect();
    const chips = [...document.querySelectorAll('#skill .skill-tools li, #services .svc-chips li')].filter((li) => li.getClientRects().length);
    return {
      nw: cs('.profile-bio .nw'), svcNw: cs('#services .svc-nw'), skillChip: cs('#skill .skill-tools li'), svcChip: cs('#services .svc-chips li'),
      qaOut: Math.round(qa.getBoundingClientRect().right - box.right),
      // (each chip against its own card: the skill cards sit in a sideways scroller)
      chipsOut: chips.filter((li) => li.getBoundingClientRect().right > li.closest('ul').parentElement.getBoundingClientRect().right + 0.5).length,
      // no punctuation is left outside a no-wrap span, where it could drop to a line of its own
      loose: [...document.querySelectorAll('.nw, .svc-nw')].filter((n) => n.nextSibling && n.nextSibling.nodeType === 3 && /^[,.;:)]/.test(n.nextSibling.nodeValue)).length,
    };
  };
  const at = async (width) => {
    const { page } = await open({ viewport: { width, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const r = await page.evaluate(probe);
    await page.close();
    return r;
  };
  // 320px (every phone at default text): nothing is released
  let r = await at(320);
  assert.equal(r.nw, 'inline collapse nowrap');
  assert.equal(r.skillChip.split(' ')[2], 'nowrap');
  assert.equal(r.svcChip.split(' ')[2], 'nowrap');
  assert.equal(r.loose, 0, 'punctuation sits outside a no-wrap span');
  // 300px (under 19em): the chips may wrap at their spaces, names still hold
  r = await at(300);
  assert.equal(r.skillChip.split(' ')[2], 'wrap', 'skill chips do not wrap under 19em');
  assert.equal(r.svcChip.split(' ')[2], 'wrap', 'service chips do not wrap under 19em');
  assert.equal(r.nw, 'inline collapse nowrap', 'names are released before 14em');
  assert.equal(r.svcNw, 'inline collapse nowrap');
  // 230px: still above 14em
  r = await at(230);
  assert.equal(r.nw, 'inline collapse nowrap');
  // 220px (under 14em, an iPhone at 175% zoom): a name moves whole, and wraps at its hyphen only when wider than the line
  r = await at(220);
  assert.equal(r.nw, 'inline-block collapse wrap');
  assert.equal(r.svcNw, 'inline-block collapse wrap');
  assert.ok(r.qaOut <= 0, `"Question-Answering" runs ${r.qaOut}px past its card`);
  assert.equal(r.chipsOut, 0, 'a chip runs past its card');
});

test('layout > phones: an experience card gives its title the full width, and the logo follows the role details (exp-header-stack-phone)', async () => {
  const probe = () => [...document.querySelectorAll('#experience .data-box[data-exp]')].map((c) => {
    const head = c.querySelector(':scope > .d-flex');
    const logo = c.querySelector('.company-logo').getBoundingClientRect();
    const title = head.querySelector('h3').getBoundingClientRect();
    const chip = c.querySelector('.exp-duration').getBoundingClientRect();
    const cs = getComputedStyle(c);
    const next = head.nextElementSibling.getBoundingClientRect();
    return {
      dir: getComputedStyle(head).flexDirection,
      headFull: Math.round(head.getBoundingClientRect().width - (c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))),
      titleLines: Math.round(title.height / parseFloat(getComputedStyle(head.querySelector('h3')).lineHeight)),
      titleFirst: title.top < logo.top,
      logoUnderChip: Math.round(logo.top - chip.bottom),
      logoLeft: Math.round(logo.left - title.left),
      toStory: Math.round(next.top - logo.bottom),
      logo: [Math.round(logo.width), Math.round(logo.height)],
    };
  });
  for (const [where, opts] of [['320', SMALL], ['iPhone', PHONE], ['576', { viewport: { width: 576, height: 800 } }]]) {
    const { page } = await open({ ...opts, reducedMotion: 'reduce' });
    const cards = await page.evaluate(probe);
    assert.equal(cards.length, 3);
    for (const [i, c] of cards.entries()) {
      assert.equal(c.dir, 'column', `${where} card ${i}: the header is not stacked`);
      assert.equal(c.headFull, 0, `${where} card ${i}: the role details do not get the card's full width`);
      assert.ok(c.titleFirst, `${where} card ${i}: the logo is above the title`);
      assert.ok(c.logoUnderChip >= 12 && c.logoUnderChip <= 24, `${where} card ${i}: the logo is ${c.logoUnderChip}px under the duration`);
      assert.equal(c.logoLeft, 0, `${where} card ${i}: the logo is not on the text's left edge`);
      assert.ok(c.toStory >= 24, `${where} card ${i}: only ${c.toStory}px between the logo and the story`);
    }
    // beside the logo these titles took 2, 3 and 3 lines on an iPhone
    if (where === 'iPhone') assert.deepEqual(cards.map((c) => c.titleLines), [1, 2, 2]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${where}: the page scrolls sideways`);
    await page.close();
  }
  // from 577px the logo stays beside the title, as before
  for (const opts of [{ viewport: { width: 577, height: 800 } }, { viewport: { width: 820, height: 1180 } }, MAC]) {
    const { page } = await open({ ...opts, reducedMotion: 'reduce' });
    for (const c of await page.evaluate(probe)) {
      assert.equal(c.dir, 'row');
      assert.ok(c.logoLeft > 100, 'the logo left its place beside the title');
    }
    await page.close();
  }
});

// ---------------------------------------------------------------------------
// Round 2 (v2.73.0): controls and motion
// ---------------------------------------------------------------------------

/** open(), with a stand-in for the consent script (the real one is cut off). */
async function openWithConsent(opts) {
  const page = await ctx.browser.newPage({ serviceWorkers: 'block', ...opts });
  await page.route((u) => !u.href.startsWith(ctx.srv.url), (r) => r.abort());
  await page.addInitScript(() => { window.Cookiebot = { renew() { window.__renewed = (window.__renewed || 0) + 1; } }; });
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(styled, null, { timeout: 8000 });
  return page;
}

/** Scroll to y + 200 and come back up 160px in steps, as a finger would. */
async function scrollUpTo(page, y) {
  await page.evaluate((to) => scrollTo(0, to + 200), y);
  await page.waitForTimeout(250);
  for (let i = 0; i < 8; i++) { await page.evaluate(() => scrollBy(0, -20)); await page.waitForTimeout(40); }
  await page.waitForTimeout(200);
}

test('pointing devices > the hero graph does not react to the pointer, with or without Reduce Motion (hero-no-pointer-effect)', async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await ctx.browser.newPage({ serviceWorkers: 'block', ...MAC, reducedMotion });
    await page.route((u) => !u.href.startsWith(ctx.srv.url), (r) => r.abort());
    await page.addInitScript(() => {
      window.__heroListeners = [];
      const add = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type) {
        if (this instanceof Element && this.closest('#hero') && /^(mouse|pointer)(move|enter|leave|over|out)$/.test(type)) window.__heroListeners.push(type);
        return add.apply(this, arguments);
      };
    });
    await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
    await page.waitForFunction(styled, null, { timeout: 8000 });
    await page.mouse.move(1010, 405);
    assert.deepEqual(await page.evaluate(() => window.__heroListeners), [], `${reducedMotion}: the hero still listens for the pointer`);
    await page.close();
  }
});

test('motion > the three repeating hints stop at the end of a cycle about 10s after coming into view, and play again on return (hint-loops-finite, closest)', async () => {
  const { page, errors } = await open(MAC);
  const endless = () => document.querySelector('.hero-scroll-hint').getAnimations({ subtree: true })
    .filter((a) => a.effect.getTiming().iterations === Infinity).length;
  await page.waitForFunction(endless, null, { timeout: 5000 });   // loops as before while first in view
  await page.waitForTimeout(10600);
  assert.equal(await page.evaluate(endless), 0, 'the scroll hint still loops without end after 10s');
  // the cycle under way is finished, not cut: it ends on a whole iteration
  const its = await page.evaluate(() => document.querySelector('.hero-scroll-hint')._capped.map((a) => a.effect.getTiming().iterations));
  assert.ok(its.length > 0 && its.every((n) => Number.isInteger(n) && n >= 1), `capped at ${its}`);
  // out of view and back: it plays again
  await page.evaluate(() => scrollTo(0, 3000));
  await page.waitForTimeout(300);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(endless, null, { timeout: 5000 });
  // the other two hints are under the same cap
  const src = readFileSync(join(ROOT, 'assets/js/main.js'), 'utf8');
  assert.match(src, /'\.hero-scroll-hint, \.exp-status-active, \.exp-role-spark'/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('pointing devices > the arrow on buttons and on cards that open a sheet, the hand only on links, zoom-in on pictures that open full size (cursor-semantics)', async () => {
  const { page } = await open(MAC);
  const cur = (sel) => page.$eval(sel, (el) => getComputedStyle(el).cursor);
  for (const sel of ['.filter-btn', '#back-to-top', '#services .faq summary', '#experience .data-box[data-exp]', '#experience .exp-card-cta',
    '#portfolio .work-card', '#portfolio .work-card .card-plus', '.proj-all', '.paddlenav-arrow:not(:disabled)',
    '.cert-lightbox-close', '.exp-lightbox-close', '[data-cookie-settings]']) {
    assert.equal(await cur(sel), 'default', `${sel} shows the hand`);
  }
  for (const sel of ['#hero a.btn-pill', 'a.footer-copy-link', 'a.footer-contact-link', '#contact a.btn-pill']) {
    assert.equal(await cur(sel), 'pointer', `${sel}: a link keeps the hand`);
  }
  for (const sel of ['#certificates .cert-card', '#certificates button.cert-img', '#certificates .cert-expand-btn',
    '#portfolio .rf-cards-scroller-item:not(.work-card)', '#portfolio .rf-cards-scroller-item:not(.work-card) .card-plus']) {
    assert.equal(await cur(sel), 'zoom-in', `${sel} opens a picture full size`);
  }
  // inside the sheet: the client pop-up button and the folding client names
  await page.locator('#experience .data-box[data-exp]').first().click({ position: { x: 30, y: 30 } });
  await page.waitForSelector('.exp-lightbox.open .exp-client-select');
  for (const sel of ['.exp-lightbox .exp-client-select', '.exp-lightbox .exp-client-toggle']) {
    assert.equal(await cur(sel), 'default', `${sel} shows the hand`);
  }
  await page.close();
});

test('focus > a tap or click opens the sheet and the viewer without a ring on the close button; Tab reaches it next; a key press focuses it at once (no-focus-ring-after-tap)', async () => {
  const { page, errors } = await open(MAC);
  const focus = () => page.evaluate(() => {
    const a = document.activeElement;
    return { cls: a.className, outline: getComputedStyle(a).outlineStyle, radius: getComputedStyle(a).borderRadius };
  });
  // an experience card, clicked
  const card = page.locator('#experience .data-box[data-exp]').first();
  await card.click({ position: { x: 30, y: 30 } });
  await page.waitForSelector('.exp-lightbox.open');
  let f = await focus();
  assert.equal(f.cls, 'exp-lightbox-inner', 'a click put focus on the close button');
  assert.equal(f.outline, 'none');
  await page.keyboard.press('Tab');
  assert.equal((await focus()).cls, 'exp-lightbox-close', 'Tab did not reach the close button first');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.exp-lightbox.open', { state: 'detached', timeout: 3000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  // the same card from the keyboard: the close button has focus (and its ring)
  await page.locator('#experience .exp-card-cta').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.exp-lightbox.open');
  assert.equal((await focus()).cls, 'exp-lightbox-close', 'a key press did not focus the close button');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  // a screenshot card, clicked: the viewer takes focus, square and ringless
  await page.locator('#portfolio .rf-cards-scroller-item:not(.work-card) .project-img').first().click();
  await page.waitForSelector('.cert-lightbox.open');
  f = await focus();
  assert.match(f.cls, /^cert-lightbox\b/, 'a click put focus on the viewer\'s close button');
  assert.equal(f.outline, 'none');
  assert.equal(f.radius, '0px');
  await page.keyboard.press('Tab');
  assert.match((await focus()).cls, /cert-lightbox-close/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('layout > Back to top steps aside while it would cover another control, and comes back once clear (back-to-top-clear-of-controls)', async () => {
  const { page, errors } = await open(PHONE);
  const at = (sel, dy) => page.evaluate(([s, d]) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return Math.round(r.top + scrollY + d);
  }, [sel, dy]);
  const state = () => page.evaluate(() => {
    const b = document.getElementById('back-to-top');
    const x = b.offsetLeft + b.offsetWidth / 2, y = b.offsetTop + b.offsetHeight / 2;
    return { visible: b.classList.contains('visible'),
      control: document.elementsFromPoint(x, y).some((el) => el !== b && el.matches('.paddlenav-arrow, .card-plus, .exp-card-cta, .cert-expand-btn, #services .faq summary')) };
  });
  // a question lies under the button's place: it stays away
  const q = await at('#services .faq details:nth-of-type(3) summary', 0);
  await scrollUpTo(page, q - 844 + 60);
  let s = await state();
  assert.equal(s.control, true, 'the test did not put a question under the button');
  assert.equal(s.visible, false, 'Back to top sits on a question');
  // plain text under it (the Contact headline at the bottom of the screen): it shows as before
  const c = await at('#contact h2, #contact .cta-title, #contact h1', 0);
  await scrollUpTo(page, c - 844 + 80);
  s = await state();
  assert.equal(s.control, false);
  assert.equal(s.visible, true, 'Back to top did not come back once clear');
  assert.deepEqual(errors, []);
  await page.close();
});

test('feedback > on a touch screen the confirmation sits 12px above Back to top while it shows, and glides down when it leaves; a Mac keeps it at the top (toast-above-back-to-top)', async () => {
  for (const [where, opts] of [['320px phone', SMALL], ['iPhone', PHONE]]) {
    const { page } = await open(opts);
    const y = await page.evaluate(() => document.querySelector('#contact').getBoundingClientRect().top + scrollY);
    await scrollUpTo(page, y);
    await page.evaluate(() => {
      const a = [...document.querySelectorAll('#contact a')].find((x) => /Download CV/.test(x.textContent));
      a.addEventListener('click', (e) => e.preventDefault());
      a.click();
    });
    await page.waitForSelector('.toast.is-shown');
    await page.waitForTimeout(450);
    const box = () => page.evaluate(() => {
      const t = document.querySelector('.toast').getBoundingClientRect(), b = document.getElementById('back-to-top');
      return { bottom: t.bottom, left: t.left, right: t.right, top: b.getBoundingClientRect().top, visible: b.classList.contains('visible'), ih: innerHeight,
        glides: getComputedStyle(document.querySelector('.toast')).transitionProperty };
    });
    const up = await box();
    assert.equal(up.visible, true, `${where}: Back to top was not showing`);
    assert.equal(Math.round(up.top - up.bottom), 12, `${where}: the toast is not 12px above Back to top`);
    assert.match(up.glides, /bottom/, `${where}: the toast jumps rather than glides`);
    // the button leaves 2s after the scrolling stops; the toast (5s) settles 28px above the bottom
    await page.waitForFunction(() => !document.getElementById('back-to-top').classList.contains('visible'), null, { timeout: 4000 });
    await page.waitForTimeout(500);
    const down = await box();
    assert.equal(Math.round(down.ih - down.bottom), 28, `${where}: the toast did not return to its place`);
    await page.close();
  }
  // a Mac: Back to top is never drawn, so the toast is not lifted or stretched
  const { page } = await open(MAC);
  await page.evaluate(() => scrollTo(0, 3000));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.getElementById('back-to-top').classList.add('visible');
    const a = [...document.querySelectorAll('a')].find((x) => /Download CV/.test(x.textContent));
    a.addEventListener('click', (e) => e.preventDefault());
    a.click();
  });
  await page.waitForSelector('.toast.is-shown');
  await page.waitForTimeout(450);
  const t = await page.evaluate(() => { const r = document.querySelector('.toast').getBoundingClientRect(); return { top: Math.round(r.top), h: r.height }; });
  assert.equal(t.top, 24);
  assert.ok(t.h < 60, `the toast is ${t.h}px tall`);
  await page.close();
});

test('privacy > the footer has a Cookie settings button that reopens the consent choice; it is left out when the consent script is missing (cookie-settings-link)', async () => {
  // no consent script (a blocker, no network): no button
  const { page: bare } = await open(PHONE);
  assert.equal(await bare.locator('footer [data-cookie-settings]').isVisible(), false, 'a button that does nothing is showing');
  await bare.close();
  for (const [where, opts] of [['320px phone', SMALL], ['iPhone', PHONE], ['iPad', { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }], ['Mac', MAC]]) {
    const page = await openWithConsent(opts);
    const btn = page.locator('footer [data-cookie-settings]');
    assert.equal(await btn.isVisible(), true, `${where}: no Cookie settings button`);
    assert.equal(await btn.evaluate((b) => b.tagName + ':' + b.textContent), 'BUTTON:Cookie settings');
    const m = await btn.evaluate((b) => {
      const copy = b.previousElementSibling, r = b.getBoundingClientRect(), c = copy.getBoundingClientRect();
      return { gap: r.top - c.bottom, mid: (r.left + r.right) / 2, right: r.right, copyRight: c.right, sameRow: Math.abs(r.top - c.top) < 2,
        color: getComputedStyle(b).color, link: getComputedStyle(document.querySelector('#contact a.more')).color,
        ruleRight: document.querySelector('#footer .border-top').getBoundingClientRect().right,
        vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth };
    });
    assert.equal(m.color, m.link, `${where}: not the link blue`);
    assert.equal(m.sw, m.vw, `${where}: the page scrolls sideways`);
    if (where === 'Mac') {
      assert.equal(m.sameRow, true, 'Mac: not on the copyright row');
      assert.ok(m.right > m.copyRight + 200 && m.right <= m.ruleRight, 'Mac: not at the trailing end of the row');
    } else {
      // under the copyright, centred, a small gap so it is not a third copyright line
      assert.ok(m.gap >= 6 && m.gap <= 8.5, `${where}: ${m.gap}px under the copyright`);
      assert.ok(Math.abs(m.mid - m.vw / 2) <= 1, `${where}: not centred`);
    }
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await btn.click();
    assert.equal(await page.evaluate(() => window.__renewed), 1, `${where}: the consent dialog was not reopened`);
    await page.close();
  }
});

test('layout > the page runs edge to edge on a phone held sideways, and the floating buttons keep clear of the sensor housing (landscape-edge-to-edge)', async () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<meta content="width=device-width, initial-scale=1\.0, viewport-fit=cover" name="viewport">/);
  const css = readFileSync(join(ROOT, 'assets/css/style.css'), 'utf8');
  assert.match(css, /#back-to-top \{\s*bottom: calc\(22px \+ env\(safe-area-inset-bottom, 0px\)\);\s*right: calc\(22px \+ env\(safe-area-inset-right, 0px\)\);/);
  assert.match(css, /\.cert-lightbox-close \{[^}]*top: calc\(20px \+ env\(safe-area-inset-top, 0px\)\);\s*right: calc\(24px \+ env\(safe-area-inset-right, 0px\)\);/);
  // with no insets (portrait in a browser without a notch) nothing moves
  const { page } = await open(PHONE);
  const pos = await page.evaluate(() => {
    const b = getComputedStyle(document.getElementById('back-to-top'));
    return { right: b.right, bottom: b.bottom, sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth };
  });
  assert.deepEqual([pos.right, pos.bottom], ['22px', '22px']);
  assert.equal(pos.sw, pos.vw);
  await page.close();
});

// ── v2.73.0 round 2: the sheet ──────────────────────────────────────────

/** What the sheet's top bar shows right now, measured from the sheet's own edges. */
const sheetBar = () => {
  const inner = document.querySelector('.exp-lightbox-inner'), ir = inner.getBoundingClientRect();
  const bar = inner.querySelector('.exp-sheet-bar');
  if (!bar) return null;
  const br = bar.getBoundingClientRect(), c = bar.querySelector('.exp-lightbox-close').getBoundingClientRect();
  const t = bar.querySelector('.exp-sheet-bar-title'), ts = getComputedStyle(t), back = bar.querySelector('.proj-back');
  const big = inner.querySelector('.exp-modal-title');
  return {
    h: br.height, edge: [br.left - ir.left, ir.right - br.right], closeTop: Math.round(c.top - ir.top), closeH: c.height,
    stuck: bar.classList.contains('is-stuck'), material: getComputedStyle(bar).backgroundColor,
    title: t.textContent, shown: ts.opacity === '1' && ts.visibility === 'visible', cut: t.classList.contains('is-cut'),
    bigTop: big ? big.getBoundingClientRect().top - c.bottom : null,
    backTop: back ? Math.round(back.getBoundingClientRect().top - ir.top) : null,
    order: [...bar.children].map((el) => el.className.split(' ').pop()),
    sideways: inner.scrollWidth - inner.clientWidth,
  };
};
const sheetScroll = async (page, y) => {
  await page.evaluate((top) => { document.querySelector('.exp-lightbox-inner').scrollTop = top; }, y);
  await page.waitForTimeout(350);
};

test('navigation > the sheet has a top bar: the close button rests where it was, the bar turns to material as soon as it sticks, and the title joins it once the big one has left (sheet-title-bar)', async () => {
  for (const [where, opts, pad] of [['small phone', SMALL, 24], ['iPhone', PHONE, 24], ['iPad', IPAD, 36], ['Mac', MAC, 36]]) {
    const { page, errors } = await open({ ...opts, reducedMotion: 'reduce' });
    await openProtollcall(page);
    const rest = await page.evaluate(sheetBar);
    assert.ok(rest, `${where}: the sheet has no top bar`);
    assert.deepEqual([rest.h, rest.edge, rest.closeH], [52, [0, 0], 40], `${where}: the bar is not 52px, edge to edge, around a 40px close button`);
    assert.equal(rest.closeTop, pad, `${where}: at rest the close button moved from its v2.71 place`);
    assert.deepEqual([rest.stuck, rest.material, rest.shown], [false, 'rgba(0, 0, 0, 0)', false], `${where}: at rest the bar is not bare`);
    assert.ok(rest.bigTop >= 0, `${where}: the title is not below the close button`);
    assert.equal(rest.sideways, 0, `${where}: the sheet scrolls sideways`);
    // a little scroll: the bar has stuck, 8px from the sheet's edge, on its material; no title yet
    await sheetScroll(page, pad + 4);
    const stuck = await page.evaluate(sheetBar);
    assert.deepEqual([stuck.stuck, stuck.closeTop, stuck.material, stuck.shown], [true, 8, 'rgba(255, 255, 255, 0.92)', false], `${where}: just scrolled`);
    // deep in the stories: the compact title shows
    await page.evaluate(() => { const i = document.querySelector('.exp-lightbox-inner'); i.scrollTop = i.querySelector('.exp-client-section[data-client="netbay"]').offsetTop - 130; });
    await page.waitForTimeout(450);
    const deep = await page.evaluate(sheetBar);
    assert.deepEqual([deep.stuck, deep.closeTop, deep.title, deep.shown], [true, 8, 'Full Stack Developer', true], `${where}: scrolled into the stories`);
    // back at the top the bar is bare again
    await sheetScroll(page, 0);
    const again = await page.evaluate(sheetBar);
    assert.deepEqual([again.stuck, again.closeTop], [false, pad], `${where}: back at the top`);
    await page.keyboard.press('Escape');
    // a project opened from See all: the way back, the title and the close button share the bar
    await page.$eval('[data-proj-all]', (b) => b.click());
    await page.waitForSelector('.exp-lightbox.open .proj-row');
    await page.locator('.proj-row', { hasText: 'Sales campaign CRM' }).first().evaluate((r) => r.click());
    await page.waitForSelector('.exp-sheet-bar .proj-back');
    await page.waitForTimeout(450);
    const nested = await page.evaluate(sheetBar);
    assert.deepEqual(nested.order, ['proj-back', 'exp-sheet-bar-title', 'exp-lightbox-close'].slice(0, 3).map((c, i) => (i === 1 && nested.cut ? 'is-cut' : c)), `${where}: the bar's order`);
    assert.deepEqual([nested.stuck, nested.backTop, nested.closeTop], [true, 8, 8], `${where}: the way back and the close button are not 8px from the edge`);
    // each button answers its own taps (their 44px hit regions do not spread over the bar)
    const hits = await page.evaluate(() => ['.proj-back', '.exp-lightbox-close'].map((sel) => {
      const el = document.querySelector('.exp-sheet-bar ' + sel), r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).closest('button') === el;
    }));
    assert.deepEqual(hits, [true, true], `${where}: a bar button is covered by another's hit region`);
    // the smallest phones have no room for the title beside the way back: it stays out rather than show "Full…"
    assert.equal(nested.shown, where !== 'small phone', `${where}: the compact title beside "All Projects"`);
    assert.equal(nested.sideways, 0, `${where}: the nested sheet scrolls sideways`);
    assert.deepEqual(errors, []);
    await page.close();
  }
});

/** One finger down at (x, y0), dragged to y1 (or x1) in steps, then lifted. */
async function touchDrag(page, x, y0, y1, { steps = 10, wait = 16, x1 = x } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (px, py) => [{ x: px, y: py, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y0) });
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(wait);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x + (x1 - x) * i / steps, y0 + (y1 - y0) * i / steps) });
  }
  await page.waitForTimeout(wait);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(500);
}

test('gestures > a sheet or a picture is swiped down to close: a short slow pull springs back, a long one closes, and a zoomed or sideways drag never does (sheet-swipe-dismiss)', async () => {
  const css = readFileSync(join(ROOT, 'assets/css/style.css'), 'utf8');
  assert.doesNotMatch(css, /\.cert-lightbox-frame\s*\{[^}]*touch-action/, 'a touch-action rule on the frame would stop pinch-zoom');
  const { page, errors } = await open(PHONE);
  const sheet = () => page.evaluate(() => ({ open: !!document.querySelector('.exp-lightbox.open'), transform: document.querySelector('.exp-lightbox-inner').style.transform, depth: (history.state && history.state.overlay) || 0 }));
  // the sheet
  await openProtollcall(page);
  assert.equal(await page.$eval('.exp-lightbox-inner', (el) => getComputedStyle(el).overscrollBehaviorY), 'contain');
  await touchDrag(page, 195, 200, 260, { steps: 12, wait: 40 });
  await page.waitForTimeout(700); // the spring back settles
  assert.deepEqual(await sheet(), { open: true, transform: '', depth: 1 }, 'a slow 60px pull did not spring back');
  // scrolled, a downward drag scrolls the sheet and never closes it
  await page.evaluate(() => { document.querySelector('.exp-lightbox-inner').scrollTop = 600; });
  await touchDrag(page, 195, 300, 600);
  assert.equal((await sheet()).open, true, 'a drag in a scrolled sheet closed it');
  await page.evaluate(() => { document.querySelector('.exp-lightbox-inner').scrollTop = 0; });
  await page.waitForTimeout(200);
  // pinch-zoomed in: the drag moves around the zoomed page
  await page.evaluate(() => Object.defineProperty(window.visualViewport, 'scale', { configurable: true, get: () => 2 }));
  await touchDrag(page, 195, 200, 500);
  assert.equal((await sheet()).open, true, 'a drag while zoomed in closed the sheet');
  await page.evaluate(() => { delete window.visualViewport.scale; });
  await touchDrag(page, 195, 200, 500);
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open') && !(history.state && history.state.overlay));
  // a picture
  const viewer = () => page.evaluate(() => ({ open: !!document.querySelector('.cert-lightbox.open'), transform: document.querySelector('.cert-lightbox-frame').style.transform }));
  await page.$eval('#images-list .cert-card', (c) => c.click());
  await page.waitForSelector('.cert-lightbox.open');
  await page.waitForTimeout(600);
  await touchDrag(page, 195, 400, 460, { steps: 12, wait: 40 });
  await page.waitForTimeout(700);
  assert.deepEqual(await viewer(), { open: true, transform: '' }, 'a slow 60px pull on the picture did not spring back');
  await page.evaluate(() => Object.defineProperty(window.visualViewport, 'scale', { configurable: true, get: () => 2 }));
  await touchDrag(page, 195, 300, 600);
  assert.equal((await viewer()).open, true, 'a drag while zoomed in closed the picture');
  await page.evaluate(() => { delete window.visualViewport.scale; });
  await touchDrag(page, 195, 300, 600);
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open') && !(history.state && history.state.overlay));
  // a wide screenshot still pans sideways
  await page.$eval('#scroller > .rf-cards-scroller-item:not([data-open-exp])', (el) => el.click());
  await page.waitForSelector('.cert-lightbox.open.lb-pan');
  await page.waitForTimeout(600);
  await touchDrag(page, 300, 400, 410, { x1: 80 });
  const pan = await page.evaluate(() => ({ open: !!document.querySelector('.cert-lightbox.open'), left: document.querySelector('.cert-lightbox-frame').scrollLeft, transform: document.querySelector('.cert-lightbox-frame').style.transform }));
  assert.equal(pan.open, true, 'a sideways drag closed the screenshot');
  assert.equal(pan.transform, '', 'a sideways drag pulled the screenshot down');
  assert.ok(pan.left > 100, `the screenshot panned ${pan.left}px sideways`);
  assert.deepEqual(errors, []);
  await page.close();
});

test('modality > a screenshot opened from the See all list is the only thing open; closing it brings the list back on that row (one-modal-at-a-time)', async () => {
  for (const [where, opts] of [['iPhone', PHONE], ['Mac', MAC]]) {
    const { page, errors } = await open({ ...opts, reducedMotion: 'reduce' });
    await page.$eval('[data-proj-all]', (b) => b.click());
    await page.waitForSelector('.exp-lightbox.open .proj-row');
    // the row brought into view first, so the click itself scrolls nothing
    await page.locator('.proj-row', { hasText: 'Classroom' }).evaluate((r) => r.scrollIntoView({ block: 'center' }));
    const at = await page.$eval('.exp-lightbox-inner', (el) => el.scrollTop);
    assert.ok(at > 300, `${where}: the row is not far down the list`);
    await page.locator('.proj-row', { hasText: 'Classroom' }).click();
    await page.waitForSelector('.cert-lightbox.open');
    await page.waitForTimeout(300);
    const one = await page.evaluate(() => ({
      list: !!document.querySelector('.exp-lightbox.open'),
      closeButtons: [...document.querySelectorAll('.exp-lightbox-close, .cert-lightbox-close')].filter((b) => b.checkVisibility({ visibilityProperty: true })).length,
      depth: history.state && history.state.overlay,
    }));
    assert.deepEqual(one, { list: false, closeButtons: 1, depth: 1 }, `${where}: the list is still open under the picture`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open') && !!document.querySelector('.exp-lightbox.open .proj-row'));
    await page.waitForTimeout(200);
    const back = await page.evaluate(() => ({ top: document.querySelector('.exp-lightbox-inner').scrollTop, focus: document.activeElement.textContent, depth: history.state && history.state.overlay,
      taps: getComputedStyle(document.querySelector('.cert-lightbox')).pointerEvents }));
    assert.equal(back.top, at, `${where}: the list did not come back where it was`);
    assert.match(back.focus, /Classroom/, `${where}: not back on the row`);
    assert.deepEqual([back.depth, back.taps], [1, 'none'], `${where}: history depth, and the fading viewer takes taps`);
    // the next row can be opened at once, and the close button leaves history clean
    await page.locator('.proj-row', { hasText: 'Classroom' }).click();
    await page.waitForSelector('.cert-lightbox.open');
    await page.goBack();
    await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open') && !!document.querySelector('.exp-lightbox.open .proj-row'));
    await page.click('.exp-lightbox .exp-lightbox-close');
    await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open') && !(history.state && history.state.overlay));
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('feedback > back in the See all list, the row you came from is filled light grey edge to edge; a keyboard return shows only the blue focus fill (see-all-return-highlight)', async () => {
  const fill = () => {
    const rows = [...document.querySelectorAll('.exp-lightbox .proj-row.is-selected')];
    if (rows.length !== 1) return { marked: rows.length };
    const li = rows[0].closest('li'), r = li.getBoundingClientRect(), box = li.parentNode.getBoundingClientRect(), cs = getComputedStyle(li);
    return { marked: 1, name: rows[0].querySelector('.proj-name').textContent, bg: cs.backgroundColor, edge: [r.left - box.left, box.right - r.right],
      radius: cs.borderRadius, first: li === li.parentNode.firstElementChild, ring: rows[0].matches(':focus-visible') };
  };
  for (const [where, opts] of [['iPhone', PHONE], ['Mac', MAC]]) {
    const { page, errors } = await open({ ...opts, reducedMotion: 'reduce' });
    const tap = (loc) => (opts.hasTouch ? loc.tap() : loc.click());
    await tap(page.locator('[data-proj-all]'));
    await page.waitForSelector('.exp-lightbox.open .proj-row');
    assert.equal(await page.locator('.proj-row.is-selected').count(), 0, `${where}: a row is marked before any was opened`);
    await tap(page.locator('.proj-row', { hasText: 'Sales campaign CRM' }).first());
    await page.waitForSelector('.proj-back');
    await page.waitForTimeout(300);
    await tap(page.locator('.proj-back'));
    await page.waitForSelector('.exp-lightbox.open .proj-row.is-selected');
    await page.waitForTimeout(300);
    const f = await page.evaluate(fill);
    assert.deepEqual([f.marked, f.name, f.ring], [1, 'Sales campaign CRM', false], `${where}: the row that was opened`);
    assert.deepEqual([f.bg, f.edge], ['rgba(0, 0, 0, 0.05)', [0, 0]], `${where}: not a light grey fill from edge to edge`);
    if (f.first) assert.equal(f.radius, '18px 18px 0px 0px', `${where}: the first row's fill does not follow the box's corners`);
    // another row opened: the mark moves with it
    await tap(page.locator('.proj-row', { hasText: 'Chatbot and LINE images' }).first());
    await page.waitForSelector('.proj-back');
    await page.waitForTimeout(300);
    if (opts.hasTouch) {
      await tap(page.locator('.proj-back'));
    } else {
      // by keyboard: only the blue focus fill, no grey under it
      await page.keyboard.press('Enter');
    }
    await page.waitForSelector('.exp-lightbox.open .proj-row.is-selected');
    await page.waitForTimeout(300);
    const g = await page.evaluate(fill);
    assert.deepEqual([g.marked, g.name], [1, 'Chatbot and LINE images'], `${where}: the mark did not move to the row opened last`);
    if (!opts.hasTouch) assert.deepEqual([g.ring, g.bg], [true, 'rgb(18, 100, 206)'], 'Mac, keyboard: grey shows instead of the focus fill');
    assert.deepEqual(errors, []);
    await page.close();
  }
});
