// The two actions under the hero's role line ("View projects" and "Download
// CV"), and what they ask of the constellation around them: the labelled
// nodes move to a band below the buttons, and the graph's composition follows
// the stylesheet's breakpoint.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, ROOT } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

const phone = (width, height) => ({ viewport: { width, height }, hasTouch: true, isMobile: true });
// the same pseudo-random sequence on every run, so a layout is judged, not a lucky draw
const seeded = (page, seed) => page.addInitScript((s0) => {
  let s = s0;
  Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}, seed);

test('the hero offers "View projects" and "Download CV" under the role line', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.waitForTimeout(900);   // the entrance holds each line back by up to 0.55s, also with reduced motion
  const a = await page.evaluate(() => {
    const row = document.querySelector('#hero .hero-copy > .hero-actions');
    const [pill, more] = row.children;
    const closing = document.querySelector('.cta-row .more');
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom }; };
    return {
      count: row.children.length, after: row.previousElementSibling.className,
      pill: { text: pill.textContent.trim(), href: pill.getAttribute('href'), cls: pill.className, ...box(pill), bg: getComputedStyle(pill).backgroundColor, radius: getComputedStyle(pill).borderRadius },
      more: { text: more.textContent.trim(), href: more.getAttribute('href'), download: more.hasAttribute('download'), ...box(more), color: getComputedStyle(more).color },
      closingHref: closing.getAttribute('href'), role: box(document.querySelector('.hero-role')), name: box(document.querySelector('.hero-name')),
      opacity: getComputedStyle(row).opacity,
    };
  });
  assert.equal(a.count, 2);
  assert.equal(a.after, 'hero-role', 'the actions come straight after the role line');
  assert.equal(a.pill.text, 'View projects');
  assert.equal(a.pill.href, '#portfolio');
  assert.match(a.pill.cls, /\bscrollto\b/);
  assert.equal(a.pill.bg, 'rgb(18, 100, 206)', 'the pill is the site blue');
  assert.equal(a.pill.radius, '980px');
  assert.equal(a.more.text, 'Download CV');
  assert.ok(a.more.download, 'the CV link downloads the file');
  assert.equal(a.more.href, a.closingHref, 'the hero offers the same CV as the closing section');
  assert.ok(existsSync(join(ROOT, a.more.href)), `the CV file is missing: ${a.more.href}`);
  assert.equal(a.more.color, 'rgb(18, 100, 206)');
  assert.equal(a.opacity, '1', 'with reduced motion the actions are simply there');
  // at 1440: on the name's left edge, 32px under the role line, one row, a finger-sized pill
  assert.ok(Math.abs(a.pill.x - a.name.x) < 1, `the pill starts at ${a.pill.x}, the name at ${a.name.x}`);
  assert.ok(Math.abs(a.pill.y - a.role.b - 32) < 1, `the row sits ${(a.pill.y - a.role.b).toFixed(1)}px under the role line, expected 32`);
  assert.ok(a.pill.h >= 44 && a.more.h >= 40, `tap heights ${a.pill.h} and ${a.more.h}`);
  assert.ok(Math.abs((a.pill.y + a.pill.h / 2) - (a.more.y + a.more.h / 2)) < 1.5, 'the pill and the link share one centre line');

  // "View projects" takes the visitor to the Projects section
  await page.$eval('#hero .hero-actions .btn-pill', (el) => el.click());
  const at = await page.evaluate(() => ({ y: scrollY, top: document.getElementById('portfolio').getBoundingClientRect().top + scrollY }));
  assert.ok(Math.abs(at.y - (at.top - 60)) <= 2, `expected to land at ${at.top - 60}, at ${at.y}`);
  await page.close();
});

test('the hero pair is the closing section\'s pair, at the same size', async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 2560, height: 1440 }]) {
    const { page } = await ctx.openPage({ viewport, reducedMotion: 'reduce' });
    const s = await page.evaluate(() => {
      const pick = (sel) => {
        const el = document.querySelector(sel), cs = getComputedStyle(el), r = el.getBoundingClientRect();
        return {
          h: Math.round(r.height * 10) / 10, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing,
          padding: cs.padding, color: cs.color, background: cs.backgroundColor, radius: cs.borderRadius, family: cs.fontFamily,
        };
      };
      const chev = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.width, r.height].map((v) => Math.round(v * 10) / 10).join('x'); };
      return {
        heroPill: pick('#hero .hero-actions .btn-pill'), ctaPill: pick('.cta-row .cta-pill'),
        heroMore: pick('#hero .hero-actions .more'), ctaMore: pick('.cta-row .more'),
        heroChev: chev('#hero .hero-actions .chev'), ctaChev: chev('.cta-row .chev'),
      };
    });
    assert.deepEqual(s.heroPill, s.ctaPill, `${viewport.width}px: the two pills differ`);
    assert.deepEqual(s.heroMore, s.ctaMore, `${viewport.width}px: the two CV links differ`);
    assert.equal(s.heroChev, s.ctaChev, `${viewport.width}px: the chevrons differ`);
    await page.close();
  }
});

test('on every screen the actions fit on one row, centred on a phone, and nothing overflows', async () => {
  for (const [w, h] of [[320, 568], [344, 882], [360, 640], [390, 844], [430, 932], [768, 1024], [992, 800], [993, 700], [1024, 768], [1440, 900], [1920, 1080], [2560, 1440], [844, 390]]) {
    const { page } = await ctx.openPage({ ...(w < 900 ? phone(w, h) : { viewport: { width: w, height: h } }), reducedMotion: 'reduce' });
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, h: b.height }; };
      const hint = document.querySelector('.hero-scroll-hint');
      return {
        sw: document.documentElement.scrollWidth, vw: innerWidth, hero: r('#hero'), copy: r('.hero-copy'), role: r('.hero-role'),
        pill: r('.hero-actions .btn-pill'), more: r('.hero-actions .more'),
        hint: getComputedStyle(hint).display === 'none' ? null : r('.hero-scroll-hint'),
      };
    });
    const at = `${w}x${h}`;
    assert.equal(m.sw, m.vw, `${at}: the page is wider than the screen`);
    assert.ok(Math.abs(m.pill.t - m.more.t) < 4 && m.more.l > m.pill.r, `${at}: the two actions are not on one row`);
    assert.ok(m.pill.l >= 8 && m.more.r <= m.vw - 8, `${at}: the row touches the screen edge (${m.pill.l.toFixed(0)} to ${m.more.r.toFixed(0)})`);
    assert.ok(m.pill.b <= m.hero.b - 8, `${at}: the actions reach the bottom of the hero`);
    assert.ok(m.pill.h >= 44, `${at}: the pill is ${m.pill.h}px tall`);
    if (w <= 992) {
      const mid = (m.pill.l + m.more.r) / 2;
      assert.ok(Math.abs(mid - m.vw / 2) < 1.5, `${at}: the row is centred at ${mid.toFixed(1)}, the screen at ${m.vw / 2}`);
      assert.ok(Math.abs(m.pill.t - m.role.b - 24) < 1.5, `${at}: the row sits ${(m.pill.t - m.role.b).toFixed(1)}px under the role line, expected 24`);
    } else {
      assert.ok(Math.abs(m.pill.l - m.copy.l) < 1, `${at}: the row should start on the copy's left edge`);
    }
    if (m.hint) {
      const apart = m.hint.l >= m.more.r || m.hint.r <= m.pill.l || m.hint.t >= m.pill.b || m.hint.b <= m.pill.t;
      assert.ok(apart, `${at}: the scroll chevron and the actions overlap`);
    }
    await page.close();
  }
});

test('up to 992px the hero copy is centred on the screen', async () => {
  // "margin: 0" on the column pinned it to the left edge wherever it is narrower than the
  // screen: the centred name sat 30px left of centre at 600px, 50px at 820px, 136px at 992px
  for (const [w, h] of [[390, 844], [600, 960], [768, 1024], [820, 1180], [992, 800], [844, 390]]) {
    const { page } = await ctx.openPage({ ...phone(w, h), reducedMotion: 'reduce' });
    await page.waitForTimeout(900);
    const off = await page.evaluate(() => {
      const mid = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return (r.left + r.right) / 2; };
      return { name: mid('.hero-name') - innerWidth / 2, role: mid('.hero-role') - innerWidth / 2 };
    });
    assert.ok(Math.abs(off.name) < 1.5 && Math.abs(off.role) < 1.5,
      `${w}x${h}: the name is ${off.name.toFixed(1)}px and the role line ${off.role.toFixed(1)}px off the centre of the screen`);
    await page.close();
  }
});

test('the glow stays behind the name, not behind the middle of a taller copy block', async () => {
  for (const opts of [{ viewport: { width: 1440, height: 900 } }, phone(390, 844)]) {
    const { page } = await ctx.openPage({ ...opts, reducedMotion: 'reduce' });
    await page.waitForTimeout(900);
    const g = await page.evaluate(() => {
      const copy = document.querySelector('.hero-copy'), c = copy.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(copy, '::before').top);   // the glow's centre line (it is pulled up by half its height)
      const eyebrow = document.querySelector('.hero-eyebrow').getBoundingClientRect(), role = document.querySelector('.hero-role').getBoundingClientRect();
      return { glow: c.top + top, words: (eyebrow.top + role.bottom) / 2 };
    });
    assert.ok(Math.abs(g.glow - g.words) <= 3,
      `${opts.viewport.width}px: the glow is centred at ${g.glow.toFixed(1)}, the eyebrow-to-role block at ${g.words.toFixed(1)}`);
    await page.close();
  }
});

// What a visitor sees of the six labels, sampled for 3 s after the intro on three seeded loads
async function labels(opts) {
  const sum = {}; let overlaps = 0, onCopy = 0, cut = 0, looks = 0;
  for (const seed of [11, 222, 3333]) {
    const page = await ctx.browser.newPage({ serviceWorkers: 'block', ...opts });
    await seeded(page, seed);
    await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
    await page.waitForTimeout(2600);
    const r = await page.evaluate(async () => {
      const out = { sum: {}, overlaps: 0, onCopy: 0, cut: 0, looks: 0 };
      const hit = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 150));
        const hero = document.querySelector('#hero').getBoundingClientRect(), copy = document.querySelector('.hero-copy').getBoundingClientRect();
        const ls = [...document.querySelectorAll('.hero-net-label')].map((l) => ({ t: l.textContent, op: +getComputedStyle(l).opacity, r: l.getBoundingClientRect() }));
        for (const l of ls) out.sum[l.t] = (out.sum[l.t] || 0) + l.op;
        const vis = ls.filter((l) => l.op > 0.3);
        for (let a = 0; a < vis.length; a++) for (let b = a + 1; b < vis.length; b++) if (hit(vis[a].r, vis[b].r)) out.overlaps++;
        for (const l of vis) {
          if (hit(l.r, copy)) out.onCopy++;
          if (l.r.right > hero.right - 1 || l.r.left < hero.left + 1 || l.r.bottom > hero.bottom - 1) out.cut++;
        }
        out.looks++;
      }
      return out;
    });
    for (const [t, v] of Object.entries(r.sum)) sum[t] = (sum[t] || 0) + v;
    overlaps += r.overlaps; onCopy += r.onCopy; cut += r.cut; looks += r.looks;
    await page.close();
  }
  const mean = Object.fromEntries(Object.entries(sum).map(([t, v]) => [t, v / looks]));
  return { mean, shown: Object.values(mean).filter((v) => v > 0.6).length, total: Object.values(mean).reduce((a, v) => a + v, 0), overlaps, onCopy, cut };
}

test('on a phone the labelled nodes sit below the buttons: none on the copy, none cut off, none on another', async () => {
  // [screen, labels that must be clearly shown (mean opacity over .6), least total opacity of the six].
  // The floors are what the live site showed before the buttons existed (5, 3, 3, 6, 6 of six).
  for (const [w, h, shown, total] of [[360, 740, 5, 4.6], [360, 640, 3, 3.4], [390, 664, 3, 3.6], [390, 844, 6, 5.5], [430, 932, 6, 5.6]]) {
    const l = await labels(phone(w, h));
    const at = `${w}x${h}`, seen = JSON.stringify(Object.fromEntries(Object.entries(l.mean).map(([t, v]) => [t, +v.toFixed(2)])));
    assert.equal(Object.keys(l.mean).length, 6, 'the constellation names six systems');
    assert.equal(l.onCopy, 0, `${at}: a label sits on the copy block or its buttons`);
    assert.equal(l.cut, 0, `${at}: a label is cut by the edge of the hero`);
    assert.equal(l.overlaps, 0, `${at}: two labels overlap`);
    assert.ok(l.shown >= shown, `${at}: ${l.shown} of 6 labels are clearly shown, expected at least ${shown}: ${seen}`);
    assert.ok(l.total >= total, `${at}: the six labels add up to ${l.total.toFixed(2)}, expected at least ${total}: ${seen}`);
  }
});

test('on a phone held sideways the six labels stand beside the copy, all of them readable', async () => {
  // under the copy there is no room left (the live site showed 3 of 6 there, some on top of each other)
  for (const [w, h] of [[844, 390], [932, 430], [667, 375]]) {
    const l = await labels(phone(w, h));
    const at = `${w}x${h}`, seen = JSON.stringify(Object.fromEntries(Object.entries(l.mean).map(([t, v]) => [t, +v.toFixed(2)])));
    assert.equal(l.onCopy, 0, `${at}: a label sits on the copy block or its buttons`);
    assert.equal(l.cut, 0, `${at}: a label is cut by the edge of the hero`);
    assert.equal(l.overlaps, 0, `${at}: two labels overlap`);
    assert.ok(l.shown >= 6, `${at}: ${l.shown} of 6 labels are clearly shown: ${seen}`);
  }
});

test('from 993px the graph takes the field to the right of the copy, and all six labels show', async () => {
  // at 993 to 1024px the compact graph used to stay under a left-hand copy block, hiding two labels
  for (const [w, h] of [[993, 700], [1024, 768], [1280, 720]]) {
    const l = await labels({ viewport: { width: w, height: h } });
    const at = `${w}x${h}`, seen = JSON.stringify(Object.fromEntries(Object.entries(l.mean).map(([t, v]) => [t, +v.toFixed(2)])));
    assert.equal(l.onCopy, 0, `${at}: a label sits on the copy block or its buttons`);
    assert.equal(l.cut, 0, `${at}: a label is cut by the edge of the hero`);
    assert.equal(l.overlaps, 0, `${at}: two labels overlap`);
    assert.ok(l.shown >= 6, `${at}: ${l.shown} of 6 labels are clearly shown: ${seen}`);
  }
  // and at 992px it is still the phone composition: the labels are below the copy
  const page = await ctx.browser.newPage({ viewport: { width: 992, height: 1000 }, serviceWorkers: 'block' });
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
  await page.waitForTimeout(2600);
  const below = await page.evaluate(() => {
    const copy = document.querySelector('.hero-copy').getBoundingClientRect();
    return [...document.querySelectorAll('.hero-net-label')].filter((l) => l.getBoundingClientRect().top > copy.bottom).length;
  });
  assert.equal(below, 6, 'at 992px every labelled node should sit below the centred copy');
  await page.close();
});
