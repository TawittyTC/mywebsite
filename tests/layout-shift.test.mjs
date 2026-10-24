// Layout shift (CLS) when the async stylesheet lands after the first paint.
// On the live site style.min.css usually applies after the first frame (the
// HTML is still streaming in). Chrome counts every box that moves then, even
// under the opaque loader, so the inline critical CSS must already lay out
// the first screen exactly as style.css will.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

async function clsWithLateStylesheet(viewport, mobile) {
  const page = await ctx.browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  await page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__shifts.push({ v: e.value, nodes: e.sources.map((s) => s.node ? (s.node.id || s.node.className || s.node.nodeName) : '?') });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  // hold the stylesheet until the page has painted once
  await page.route(/style\.min\.css/, async (route) => {
    for (let i = 0; i < 100; i++) {
      const painted = await page.evaluate(() => performance.getEntriesByType('paint').length > 0).catch(() => false);
      if (painted) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await new Promise((r) => setTimeout(r, 150));
    await route.continue();
  });
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
  await page.waitForTimeout(500);
  const shifts = await page.evaluate(() => window.__shifts);
  await page.close();
  // hadRecentInput is not filtered: device emulation sets it, a real phone does not
  const total = shifts.reduce((a, s) => a + s.v, 0);
  const worst = shifts.reduce((a, s) => (s.v > a.v ? s : a), { v: 0, nodes: [] });
  return { total, worst };
}

test('nothing on the first screen moves when the stylesheet lands late', async () => {
  for (const [width, height, mobile] of [[1350, 940, false], [412, 823, true], [412, 823, false], [844, 390, true]]) {
    const { total, worst } = await clsWithLateStylesheet({ width, height }, mobile);
    assert.ok(total < 0.05,
      `${width}x${height}${mobile ? ' (phone)' : ''}: CLS ${total.toFixed(3)}, worst shift ${worst.v.toFixed(3)} moved ${worst.nodes.join(', ')}`);
  }
});
