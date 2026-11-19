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
const settle = (loc) => loc.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
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
    // the Education and role-period lines are 13px only on phones, and only there take the darker grey
    const edu = await page.$eval('#resume p.profile-bio-small', (el) => ({ color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize) }));
    assert.equal(edu.color, edu.size <= 14.5 ? GREY_SMALL : GREY, `${where}: an Education line at ${edu.size}px is ${edu.color}`);
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
    const r = await page.$eval('.footer-copy-link', (a) => {
      const cs = getComputedStyle(a);
      return { line: cs.textDecorationLine, thick: cs.textDecorationThickness, off: parseFloat(cs.textUnderlineOffset) / parseFloat(cs.fontSize), color: cs.color };
    });
    assert.equal(r.line, 'underline', `${where}: no underline at rest`);
    assert.equal(r.thick, '1px', `${where}: underline thickness`);
    assert.ok(Math.abs(r.off - 0.2) < 0.01, `${where}: underline offset is ${r.off.toFixed(3)}em`);
    assert.equal(r.color, BLUE, `${where}: the name changed colour`);
    if (where === 'Mac') {
      // under the pointer it behaves like the site's other links: darker, without the line
      const a = page.locator('.footer-copy-link');
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
    await page.waitForSelector('.exp-lightbox.open .exp-modal-overview');   // (the client lists start folded on phones)
    for (const sel of ['.exp-lightbox.open .exp-modal-overview', '.exp-lightbox.open .exp-client-section ul']) {
      const [x] = await sizes(page, sel);
      assert.deepEqual([x.size, x.lh], [15, 20], `${where}: ${sel} is ${x.size}/${x.lh}`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${where}: the page scrolls sideways`);
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
  await page.close();
});
