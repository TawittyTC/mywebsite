// A card row on a touch screen nudges itself left and back every few seconds
// to show that it scrolls. A finger that lands while a nudge is under way must
// get the row at once: it used to be ignored until the nudge was over, so the
// row slid back under the finger and a drag lost a third of its distance.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

// motion stays on: under reduced motion the rows never nudge
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' };

async function rowInView(page, sel) {
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
  // the row's cards settle in with the scroll reveal
  await page.waitForTimeout(900);
  return page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}

// real touch input: a DOM TouchEvent alone does not scroll anything
async function finger(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }],
  });
  return {
    down: (x, y) => send('touchStart', x, y),
    move: (x, y) => send('touchMove', x, y),
    up: () => send('touchEnd'),
  };
}

// samples the row's scroll position in the page, one per animation frame
const watch = (page, sel, ms) => page.$eval(sel, (el, ms) => new Promise((resolve) => {
  const seen = [], t0 = performance.now();
  (function tick() {
    seen.push(el.scrollLeft);
    if (performance.now() - t0 < ms) requestAnimationFrame(tick); else resolve(seen);
  })();
}), ms);

async function drag(page, f, at, dx) {
  for (let i = 1; i <= 10; i++) {
    await f.move(at.x - (dx * i) / 10, at.y);
    await page.waitForTimeout(16);
  }
}

test('a finger that lands during the nudge gets the row at once, and a drag moves it the whole way', async () => {
  for (const sel of ['#scroller', '#skill-scroller']) {
    const { page } = await ctx.openPage(phone);
    const at = await rowInView(page, sel);
    // wait for a nudge to be under way: the row moving, part way out
    const caught = await page.$eval(sel, (el) => new Promise((resolve) => {
      const t0 = performance.now();
      let last = el.scrollLeft;
      (function tick() {
        const now = el.scrollLeft;
        if (now !== last && now > 10 && now < 70) return resolve(now);
        last = now;
        if (performance.now() - t0 > 8000) return resolve(null);
        requestAnimationFrame(tick);
      })();
    }));
    assert.ok(caught !== null, `${sel}: no nudge seen within 8s`);

    const f = await finger(page);
    await f.down(at.x, at.y);
    await page.waitForTimeout(100);
    // the finger is still: the row must stay where the finger found it
    const held = await watch(page, sel, 400);
    const drift = Math.max(...held) - Math.min(...held);
    assert.ok(drift <= 1, `${sel}: under a still finger the row kept moving by itself (${Math.min(...held)} to ${Math.max(...held)})`);

    const from = held[held.length - 1];
    await drag(page, f, at, 150);
    await f.up();
    await page.waitForTimeout(400);
    const moved = (await page.$eval(sel, (el) => el.scrollLeft)) - from;
    assert.ok(moved >= 140, `${sel}: a 150px drag moved the row ${moved}px`);

    // the visitor has the row: no nudge for a good while (the next would be due in 3s)
    const quiet = await watch(page, sel, 4500);
    assert.ok(Math.max(...quiet) - Math.min(...quiet) <= 1, `${sel}: the row nudged again within 4.5s of a drag`);
    await page.close();
  }
});

test('the nudge comes back after the visitor lets the row be, and a row at rest follows a drag', async () => {
  const { page } = await ctx.openPage(phone);
  const at = await rowInView(page, '#scroller');
  // let the first nudge pass, then take the row while it rests
  await page.waitForTimeout(800);
  const f = await finger(page);
  const from = await page.$eval('#scroller', (el) => el.scrollLeft);
  await f.down(at.x, at.y);
  await drag(page, f, at, 150);
  await f.up();
  await page.waitForTimeout(400);
  const to = await page.$eval('#scroller', (el) => el.scrollLeft);
  assert.ok(to - from >= 140, `a 150px drag on a row at rest moved it ${to - from}px`);
  // the nudge is the owner's design: it must resume (10s after the last scroll, then every 3s)
  const later = await watch(page, '#scroller', 13500);
  assert.ok(Math.max(...later) - Math.min(...later) >= 40, 'the row never nudged again after the visitor let it be');
  await page.close();
});
