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
