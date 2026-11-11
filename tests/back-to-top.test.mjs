// Back to top on a touch screen: it floats in the right-hand column, over the row paddles and
// the "+" of a certificate or a question. It may be there while the visitor scrolls back up;
// two seconds after the scrolling stops it has to be gone, so a tap reaches what is under it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const DEEP = 6000; // well past the first screen, with room to scroll both ways

async function open(opts) {
  const { page, errors } = await ctx.openPage(opts);
  // every wait below is counted from the last scroll event, on the page's own clock
  await page.evaluate(() => {
    window.__lastScroll = performance.now();
    addEventListener('scroll', () => { window.__lastScroll = performance.now(); }, { passive: true });
  });
  return { page, errors };
}

/** Scroll to y and let the page's own scroll handler run (it works once per frame). */
const scrollTo = (page, y) => page.evaluate((to) => new Promise((done) => {
  window.scrollTo(0, to);
  requestAnimationFrame(() => requestAnimationFrame(done));
}), y);

/** Scroll by dy in small steps, the way a finger does (negative = back up the page). */
async function scrollBy(page, dy, each = 20) {
  const from = await page.evaluate(() => scrollY);
  for (let k = 1; k <= Math.abs(dy) / each; k++) await scrollTo(page, from + Math.sign(dy) * each * k);
}

/** What a visitor gets from the button, `ms` after the last scroll event (0 = right now). */
const look = (page, ms = 0) => page.evaluate((wait) => new Promise((done) => {
  setTimeout(() => {
    const b = document.getElementById('back-to-top');
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    done({
      shown: b.classList.contains('visible'),
      opacity: Number(cs.opacity),
      pointerEvents: cs.pointerEvents,
      takesTap: Boolean(hit) && b.contains(hit),
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      scrollY: Math.round(scrollY),
      sinceScroll: Math.round(performance.now() - window.__lastScroll),
    });
  }, wait ? Math.max(0, wait - (performance.now() - window.__lastScroll)) : 0);
}), ms);

const faded = (page) => page.waitForFunction(
  () => getComputedStyle(document.getElementById('back-to-top')).opacity === '0', null, { timeout: 2000 });

function assertOut(s, when) {
  assert.ok(s.shown, `${when}: the button should be out (${JSON.stringify(s)})`);
  assert.equal(s.opacity, 1, `${when}: the button should be fully drawn`);
  assert.equal(s.pointerEvents, 'auto', `${when}: the button should take a tap`);
  assert.ok(s.takesTap, `${when}: a tap on its centre should reach the button`);
}
function assertGone(s, when) {
  assert.equal(s.shown, false, `${when}: the button is still out ${s.sinceScroll}ms after the last scroll`);
  assert.equal(s.pointerEvents, 'none', `${when}: a hidden button must not take taps`);
  assert.equal(s.takesTap, false, `${when}: a tap at (${s.x}, ${s.y}) still lands on Back to top`);
}

test('on a touch screen Back to top leaves two seconds after the scrolling stops and returns on the next scroll up', async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const tag = reducedMotion === 'reduce' ? 'reduced motion' : 'phone';
    const { page, errors } = await open({ ...PHONE, reducedMotion });
    assert.equal(await page.evaluate(() => matchMedia('(hover: none)').matches), true, 'this run must count as a touch screen');
    assertGone(await look(page), `${tag}, top of the page`);

    await scrollTo(page, DEEP);
    assert.equal((await look(page)).scrollY, DEEP, 'the page should be long enough to scroll this far');
    assertGone(await look(page, 400), `${tag}, after scrolling down`);

    await scrollBy(page, -200);
    assertOut(await look(page, 600), `${tag}, after scrolling 200px back up`);
    assertOut(await look(page, 1500), `${tag}, 1.5s after the scrolling stopped`);

    // the defect: it stayed here, over the paddles and the "+" buttons, until the next scroll down
    const later = await look(page, 2400);
    assertGone(later, `${tag}, 2.4s after the scrolling stopped`);
    await faded(page);

    // the browser's bar sliding in or out resizes the window: that must not bring it back
    await page.setViewportSize({ width: 390, height: 760 });
    await page.waitForTimeout(300);
    assertGone(await look(page), `${tag}, after the window got shorter`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    assertGone(await look(page), `${tag}, after the window got taller again`);

    // 30px is not enough to bring it out, 60px is: the rule it always had
    await scrollBy(page, -20, 10);
    assert.equal((await look(page)).shown, false, `${tag}: 20px up should not bring it out`);
    await scrollBy(page, -40, 10);
    assertOut(await look(page, 600), `${tag}, after a further 60px up`);

    await scrollBy(page, 20);
    assertGone(await look(page), `${tag}, at the first scroll down`);
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('on a touch screen Back to top stays while the page keeps moving, and for as long as a keyboard is on it', async () => {
  const { page, errors } = await open(PHONE);
  await scrollTo(page, DEEP);
  await page.waitForTimeout(300);

  // momentum: scroll events keep arriving for longer than two seconds
  const missing = await page.evaluate(() => new Promise((done) => {
    const b = document.getElementById('back-to-top');
    const from = scrollY;
    const gaps = [];
    let n = 0;
    const id = setInterval(() => {
      if (n > 5 && !b.classList.contains('visible')) gaps.push(`${n * 100}ms`);
      n += 1;
      window.scrollTo(0, from - n * 10);
      if (n === 32) { clearInterval(id); done(gaps); }
    }, 100);
  }));
  assert.deepEqual(missing, [], `the button went away while the page was still scrolling up, at ${missing.join(', ')}`);
  assertOut(await look(page, 1500), '1.5s after 3.2s of scrolling');
  assertGone(await look(page, 2400), '2.4s after 3.2s of scrolling');
  await faded(page);

  // a keyboard or switch user who reaches it keeps it in sight for as long as the focus is there
  await scrollBy(page, -60);
  assertOut(await look(page, 600), 'after 60px up');
  await page.keyboard.press('Shift+Tab'); // the button is the last control in the page
  const focus = await page.evaluate(() => {
    const b = document.getElementById('back-to-top');
    return { on: document.activeElement === b, ring: b.matches(':focus-visible') };
  });
  assert.deepEqual(focus, { on: true, ring: true }, 'Shift+Tab should put keyboard focus on the button');
  const focused = await look(page, 2600);
  assert.equal(focused.opacity, 1, `with keyboard focus the button must stay in sight (${JSON.stringify(focused)})`);
  assert.equal(focused.pointerEvents, 'auto');
  assert.ok(focused.takesTap, 'with keyboard focus the button must still work');
  await page.evaluate(() => document.activeElement.blur());
  await faded(page);
  assertGone(await look(page), 'once the focus has moved on');
  assert.deepEqual(errors, []);
  await page.close();
});

test('on a touch screen Back to top does not leave from under a finger, and the tap still goes to the top', async () => {
  const { page, errors } = await open(PHONE);
  await scrollTo(page, DEEP);
  await page.waitForTimeout(300);
  await scrollBy(page, -200);
  const out = await look(page, 1200);
  assertOut(out, 'after 200px up');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: out.x, y: out.y }] });
  await page.waitForTimeout(2600); // the two seconds run out with the finger still down
  assertOut(await look(page), 'held for 2.6s');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => scrollY === 0, null, { timeout: 8000 });
  await faded(page);
  assertGone(await look(page), 'back at the top');

  // a finger that slides off without tapping: the two seconds start again from the release
  await scrollTo(page, DEEP);
  await page.waitForTimeout(300);
  await scrollBy(page, -200);
  const again = await look(page, 600);
  assertOut(again, 'out again');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: again.x, y: again.y }] });
  await page.waitForTimeout(2300);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.waitForTimeout(1200);
  assertOut(await look(page), '1.2s after the finger left');
  await page.waitForTimeout(1300);
  assertGone(await look(page), '2.5s after the finger left');
  assert.equal((await look(page)).scrollY, DEEP - 200, 'a cancelled touch must not scroll the page');
  assert.deepEqual(errors, []);
  await page.close();
});

test('turning the phone does not bring Back to top out', async () => {
  const { page, errors } = await open(PHONE);
  await scrollTo(page, DEEP);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const b = document.getElementById('back-to-top');
    window.__cameOut = [];
    new MutationObserver(() => {
      if (b.classList.contains('visible')) window.__cameOut.push(Math.round(scrollY));
    }).observe(b, { attributes: true, attributeFilter: ['class'] });
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1500);
  const turned = await look(page);
  // the reflow and the hero pinned to the new height move the page up with no finger on it
  assert.ok(DEEP - turned.scrollY > 30, `the turn should move the page up by more than the 30px rule, moved ${DEEP - turned.scrollY}px`);
  const cameOut = await page.evaluate(() => window.__cameOut);
  assert.deepEqual(cameOut, [], `the turn brought the button out at scrollY ${cameOut.join(', ')}`);
  assertGone(turned, 'after the turn');

  // and a real scroll up still does, on the turned screen
  await scrollBy(page, -80);
  assertOut(await look(page, 600), 'after 80px up on the turned screen');
  assertGone(await look(page, 2400), '2.4s later on the turned screen');
  assert.deepEqual(errors, []);
  await page.close();
});

test('with a mouse Back to top stays for as long as the visitor is past the first screen', async () => {
  const { page, errors } = await open();
  assert.equal(await page.evaluate(() => matchMedia('(hover: none)').matches), false, 'this run must count as a pointer device');
  assertGone(await look(page), 'top of the page');
  await scrollTo(page, 2000);
  assertOut(await look(page, 600), 'past 0.9 screens');
  assertOut(await look(page, 3000), '3s later with no scrolling');
  // a press held past two seconds changes nothing either
  const { x, y } = await look(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  assertOut(await look(page), 'pressed for 2.3s');
  await page.mouse.up();
  await page.waitForFunction(() => scrollY === 0, null, { timeout: 8000 });
  await faded(page);
  assertGone(await look(page), 'back at the top');
  assert.deepEqual(errors, []);
  await page.close();
});
