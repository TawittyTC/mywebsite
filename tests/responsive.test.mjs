// Responsive + viewport-churn coverage — the class of bugs in-app
// browsers (Facebook/LINE) create by resizing the webview mid-scroll.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, inkCount } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

test('hero holds together at 360 / 768 / 1024 wide', async () => {
  for (const width of [360, 768, 1024]) {
    const { page } = await ctx.openPage({
      viewport: { width, height: 800 }, isMobile: width < 800, hasTouch: width < 800,
    });
    await page.waitForTimeout(1800);
    const name = await page.$eval('#hero .hero-name', (el) => el.getBoundingClientRect());
    assert.ok(name.left >= 0 && name.right <= width + 1, `${width}px: name overflows viewport`);
    assert.ok(await page.evaluate(inkCount()) > 300, `${width}px: constellation blank`);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, `${width}px: horizontal overflow of ${overflow}px in hero`);
    await page.close();
  }
});

test('no horizontal overflow anywhere down the page (390 and 1440)', async () => {
  for (const width of [390, 1440]) {
    const { page } = await ctx.openPage({
      viewport: { width, height: 850 }, isMobile: width < 800, hasTouch: width < 800,
    });
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
    });
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, `${width}px: page has ${overflow}px horizontal overflow`);
    await page.close();
  }
});

test('mobile full scroll leaves no reveal-hidden content behind', async () => {
  const { page } = await ctx.openPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 450) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await page.waitForTimeout(900);
  const stuck = await page.evaluate(() =>
    [...document.querySelectorAll('.js-reveal')]
      .filter((el) => !el.classList.contains('is-visible')).length);
  assert.equal(stuck, 0, `${stuck} elements never revealed on mobile`);
  await page.close();
});

test('webview toolbar churn: nodes never reshuffle, graph never blanks', async () => {
  const { page } = await ctx.openPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  await page.waitForTimeout(2500);
  const grab = () => page.$$eval('#hero-net-labels .hero-net-label',
    (els) => els.map((el) => [parseFloat(el.style.left), parseFloat(el.style.top), parseFloat(el.style.opacity || '1')]));
  const a = await grab();

  // scroll deep, churn the viewport like collapsing/expanding toolbars,
  // then come back to the top
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  for (const h of [944, 844, 944, 844]) {
    await page.setViewportSize({ width: 390, height: h });
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => { window.scrollTo(0, 0); return window.scrollY === 0; });
  await page.waitForTimeout(900);

  const b = await grab();
  const moved = a.map((p, i) => Math.hypot(b[i][0] - p[0], b[i][1] - p[1]));
  assert.ok(Math.max(...moved) < 90, `labels jumped ${Math.max(...moved).toFixed(0)}px — reshuffle`);
  assert.ok(b.filter((p) => p[2] > 0.5).length >= 4, 'labeled nodes lost after viewport churn');
  assert.ok(await page.evaluate(inkCount('#hero-net', 0.45, 0.95)) > 2000, 'cluster blank after churn');
  await page.close();
});

test('desktop window resize: graph rescales without reshuffling', async () => {
  const { page } = await ctx.openPage();
  await page.waitForTimeout(2500);
  const fx = await page.$$eval('#hero-net-labels .hero-net-label',
    (els) => els.map((el) => parseFloat(el.style.left) / window.innerWidth));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.waitForTimeout(900);
  const fx2 = await page.$$eval('#hero-net-labels .hero-net-label',
    (els) => els.map((el) => parseFloat(el.style.left) / window.innerWidth));
  // fractional positions must be preserved (± wander)
  fx.forEach((f, i) => assert.ok(Math.abs(f - fx2[i]) < 0.08,
    `label ${i} moved from ${(f * 100).toFixed(1)}% to ${(fx2[i] * 100).toFixed(1)}% of width`));
  await page.close();
});

test('viewport churn never changes the hero height or shoves sections around', async () => {
  const { page } = await ctx.openPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  // wait for heroLock to actually pin (inline height set) before measuring —
  // under CI load the initial lock can land >1.5s in, and churning the
  // viewport before it engages would legitimately lock the churned height
  await page.waitForFunction(() => document.getElementById('hero').style.height !== '');
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => ({
    hero: document.getElementById('hero').offsetHeight,
    resumeTop: document.getElementById('resume').getBoundingClientRect().top + window.scrollY,
  }));
  // in-app toolbar collapse/expand cycles while scrolled mid-page
  await page.evaluate(() => window.scrollTo(0, 1200));
  for (const h of [944, 844, 944, 844]) {
    await page.setViewportSize({ width: 390, height: h });
    await page.waitForTimeout(120);
  }
  // wait until layout is actually STABLE (two identical consecutive
  // measurements) — fixed waits flaked under full-suite CPU load when
  // rAF-deferred resize work landed late
  const measure = () => page.evaluate(() => ({
    hero: document.getElementById('hero').offsetHeight,
    resumeTop: Math.round(document.getElementById('resume').getBoundingClientRect().top + window.scrollY),
  }));
  let after = await measure();
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    const next = await measure();
    if (next.hero === after.hero && next.resumeTop === after.resumeTop) { after = next; break; }
    after = next;
  }
  assert.ok(Math.abs(after.hero - before.hero) <= 3,
    `hero height changed ${before.hero} → ${after.hero} during viewport churn`);
  assert.ok(Math.abs(after.resumeTop - before.resumeTop) <= 3,
    `resume section moved ${(after.resumeTop - before.resumeTop).toFixed(0)}px during viewport churn`);
  await page.close();
});

test('page length is stable while scrolling (no placeholder/CLS jumps)', async () => {
  for (const width of [390, 1440]) {
    const { page } = await ctx.openPage({
      viewport: { width, height: 850 }, isMobile: width < 800, hasTouch: width < 800,
    });
    await page.waitForTimeout(800);
    const before = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => document.body.scrollHeight);
    assert.ok(Math.abs(after - before) <= 32,
      `${width}px: page height jumped ${before} → ${after} while scrolling`);
    await page.close();
  }
});

test('on a phone every control answers a 44px finger (Apple HIG)', async () => {
  const { page } = await ctx.openPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  // the preloader covers the page until it is removed
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 15000 });
  const misses = await page.evaluate(async () => {
    document.getElementById('back-to-top')?.style.setProperty('display', 'none');
    const controls = [...document.querySelectorAll('a, button, summary, [role="button"]')].filter((e) => {
      const r = e.getBoundingClientRect();
      // carousel cards are whole-card targets; the skip link lives off-screen until focused
      return r.width > 0 && r.height > 0 && !e.closest('[data-card-scroller]')
        && !e.classList.contains('skip-link') && getComputedStyle(e).visibility !== 'hidden';
    });
    const out = [];
    for (const el of controls) {
      el.scrollIntoView({ block: 'center' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // a finger landing 21px either side of centre still has to reach this control
      const miss = [[-21, 0], [21, 0], [0, -21], [0, 21]].filter(([dx, dy]) => {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        return !(hit && (hit === el || el.contains(hit)));
      });
      if (miss.length) out.push(`${(el.getAttribute('aria-label') || el.innerText || el.className).trim().slice(0, 40)} (${Math.round(r.width)}×${Math.round(r.height)})`);
    }
    return out;
  });
  assert.deepEqual(misses, [], 'controls a fingertip can miss');
  await page.close();
});

test('hero rotates three roles, strongest first', async () => {
  const { page } = await ctx.openPage();
  const items = await page.$eval('#hero .typed', (el) => el.dataset.typedItems.split(',').map((s) => s.trim()));
  assert.equal(items[0], 'Full-Stack Developer', 'the first role a visitor sees is the headline one');
  assert.ok(items.length <= 3, `${items.length} roles — most visitors scroll on after one or two`);
  await page.close();
});

test('the hero name never loses letters, on 4K screens or with a larger reader font', async () => {
  for (const [width, font] of [[2560, 16], [1665, 20], [2560, 24], [390, 24]]) {
    const { page } = await ctx.openPage({ viewport: { width, height: 900 } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: font, fixed: 13 } });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // the gradient ink is painted only inside each line's own box, so the box must hold every glyph
    const lines = await page.$$eval('.hero-name-line', (els) => els.map((el) => {
      const r = document.createRange(); r.selectNodeContents(el);
      return { text: r.getBoundingClientRect().width, box: el.getBoundingClientRect().width };
    }));
    for (const l of lines) assert.ok(l.text <= l.box + 1, `${width}px / ${font}px font: name ${l.text}px in a ${l.box}px box`);
    await page.close();
  }
});
