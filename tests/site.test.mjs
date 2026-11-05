// End-to-end site tests — run with: npm test
// Boots a local static server, drives the real page in Chromium and
// checks the behaviours that have broken (or could break) before:
// missing assets, cert grid count, parallax, reveals, reduced motion.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

let browser, srv;

before(async () => {
  srv = await startServer(ROOT);
  browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
});

after(async () => {
  await browser?.close();
  srv?.server.close();
});

/**
 * Open the page, wait for the intro loader to clear (it blocks scrolling
 * and clicks while visible) and collect page errors / failed requests.
 * Third-party requests (analytics, consent banner) are ignored — they are
 * unreachable from sandboxes and are not bugs in this site.
 */
async function openPage(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  const errors = [];
  const failed = [];
  const sameOrigin = (url) => url.startsWith(srv.url);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const src = m.location()?.url || '';
    if (src === '' || sameOrigin(src)) errors.push(`${m.text()} (${src})`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && sameOrigin(r.url())) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
  return { page, errors, failed };
}

// ---------- Static integrity (no browser needed) ----------

test('index.html references only assets that exist on disk', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"?#]+)/g)].map((m) => m[1]);
  assert.ok(refs.length > 10, 'expected to find asset references');
  const missing = [...new Set(refs)].filter((p) => {
    try { readFileSync(join(ROOT, p)); return false; } catch { return true; }
  });
  assert.deepEqual(missing, [], `missing assets: ${missing.join(', ')}`);
});

test('main.js and main.min.js agree on certificate count, and every cert file exists', () => {
  const src = readFileSync(join(ROOT, 'assets/js/main.js'), 'utf8');
  const min = readFileSync(join(ROOT, 'assets/js/main.min.js'), 'utf8');
  const srcCount = Number(src.match(/i <= (\d+); i\+\+/)?.[1]);
  const minCount = Number(min.match(/<=(\d+);/)?.[1]);
  assert.ok(srcCount >= 33, `cert loop in main.js should be >= 33, got ${srcCount}`);
  assert.equal(srcCount, minCount, 'main.min.js is out of sync with main.js — run ./build.sh');
  for (let i = 1; i <= srcCount; i++) {
    assert.doesNotThrow(
      () => readFileSync(join(ROOT, `assets/img/certificate/img-${i}.avif`)),
      `certificate img-${i}.avif referenced by the loop but missing on disk`
    );
  }
});

test('cache-busting versions are consistent for each min asset', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const asset of ['assets/css/style.min.css', 'assets/js/main.min.js']) {
    const versions = [...html.matchAll(new RegExp(`${asset.replace(/[./]/g, '\\$&')}\\?v=([0-9.]+)`, 'g'))].map((m) => m[1]);
    assert.ok(versions.length >= 1, `no versioned reference to ${asset}`);
    assert.equal(new Set(versions).size, 1, `${asset} referenced with mixed versions: ${versions.join(', ')}`);
  }
});

// ---------- Browser behaviour ----------

test('page loads with no console errors and no failed asset requests', async () => {
  const { page, errors, failed } = await openPage();
  await page.waitForTimeout(1200);
  assert.deepEqual(failed, [], `failed requests:\n${failed.join('\n')}`);
  assert.deepEqual(errors, [], `console errors:\n${errors.join('\n')}`);
  await page.close();
});

test('hero renders name, eyebrow and the multi-agent constellation', async () => {
  const { page } = await openPage();
  assert.match(await page.textContent('#hero h1'), /Tanapol Chamnanhan/);
  // sentence case, set as written: no uppercase transform, no wide tracking
  assert.equal((await page.textContent('#hero .hero-eyebrow')).trim(), 'Software engineer · Bangkok');
  const eyebrow = await page.$eval('#hero .hero-eyebrow', (el) => {
    const cs = getComputedStyle(el);
    return { transform: cs.textTransform, tracking: parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) };
  });
  assert.equal(eyebrow.transform, 'none', 'the eyebrow is uppercased again');
  assert.ok(eyebrow.tracking >= 0 && eyebrow.tracking <= 0.02, `eyebrow tracking ${eyebrow.tracking.toFixed(3)}em is not normal or slightly open`);
  assert.equal((await page.textContent('#hero .hero-role')).trim(), 'Full-stack developer and AI engineer');
  assert.equal(await page.locator('#hero-net').count(), 1, 'constellation canvas missing');
  const labels = await page.$$eval('#hero-net-labels .hero-net-label', (els) => els.map((e) => e.textContent));
  assert.deepEqual(labels.sort(), ['ASR', 'CRM', 'IVR', 'LLM', 'POS', 'TTS'], 'labeled nodes missing');
  // canvas actually draws (the intro blob fades in from zero, so poll
  // rather than sampling one instant that may land before first paint)
  const painted = await page.waitForFunction(() => {
    const c = document.getElementById('hero-net');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  assert.ok(painted, 'constellation canvas is blank');
  await page.close();
});

test('hero is rigid during scroll: no parallax transform, nodes stay put', async () => {
  const { page } = await openPage();
  await page.waitForTimeout(2600);
  const before = await page.$$eval('#hero-net-labels .hero-net-label',
    (els) => els.map((el) => [parseFloat(el.style.left), parseFloat(el.style.top)]));
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  assert.equal(
    await page.$eval('#hero .hero-copy', (el) => el.style.transform || ''),
    '', 'hero copy must not carry a scroll parallax transform'
  );
  const after = await page.$$eval('#hero-net-labels .hero-net-label',
    (els) => els.map((el) => [parseFloat(el.style.left), parseFloat(el.style.top)]));
  const moved = before.map((p, i) => Math.hypot(after[i][0] - p[0], after[i][1] - p[1]));
  assert.ok(Math.max(...moved) < 70, `nodes shifted ${Math.max(...moved).toFixed(0)}px across a scroll round-trip`);
  await page.close();
});

test('certificates section renders every certificate and all images decode', async () => {
  const { page, failed } = await openPage();
  await page.evaluate(() => document.getElementById('certificates').scrollIntoView());
  await page.waitForSelector('#images-list img');
  const expected = Number(
    readFileSync(join(ROOT, 'assets/js/main.js'), 'utf8').match(/i <= (\d+); i\+\+/)[1]
  );
  await page.waitForFunction(
    (n) => document.querySelectorAll('#images-list img').length === n, expected
  );
  // images are lazy — walk through the whole grid so every one loads
  await page.evaluate(async () => {
    const sec = document.getElementById('certificates');
    const from = sec.offsetTop, to = from + sec.offsetHeight;
    for (let y = from; y <= to; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('#images-list img')].every((i) => i.complete && i.naturalWidth > 0)
  );
  assert.deepEqual(failed.filter((f) => f.includes('certificate')), [], 'certificate images failed to load');
  await page.close();
});

test('certificate lightbox opens on click and closes with Escape', async () => {
  const { page } = await openPage();
  await page.evaluate(() => document.getElementById('certificates').scrollIntoView());
  await page.waitForSelector('#images-list .cert-card');
  await page.click('#images-list .cert-card');
  await page.waitForSelector('.cert-lightbox.open');
  assert.ok(await page.$eval('.cert-lightbox img', (i) => i.src.includes('certificate/')));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  await page.close();
});

test('scrolling the whole page leaves no reveal-hidden content behind', async () => {
  const { page } = await openPage();
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await page.waitForTimeout(900);
  const stuck = await page.evaluate(() =>
    [...document.querySelectorAll('.js-reveal')]
      .filter((el) => !el.classList.contains('is-visible'))
      .map((el) => el.className)
  );
  assert.deepEqual(stuck, [], `elements never revealed: ${stuck.join(' | ')}`);
  await page.close();
});

test('reveals: a block fades and rises 12px once as it enters, then stays put', async () => {
  const { page } = await openPage();
  await page.waitForTimeout(600);
  const sel = '#experience .data-box.js-reveal';
  // (bootstrap sets scroll-behavior: smooth, so wait for the scroll to arrive)
  const park = (frac) => page.evaluate(async ([s, f]) => {
    const el = document.querySelector(s);
    let y = 0;
    for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
    const target = Math.max(0, Math.round(y - window.innerHeight * f));
    window.scrollTo(0, target);
    await new Promise((resolve) => {
      const t0 = performance.now();
      (function poll() {
        if (Math.abs(window.scrollY - target) <= 2 || performance.now() - t0 > 5000) resolve();
        else setTimeout(poll, 50);
      })();
    });
  }, [sel, frac]);
  // still below the fold: armed, hidden, and not moved by the scroll
  await park(1.3);
  await page.waitForTimeout(400);
  const waiting = await page.$eval(sel, (el) => ({
    visible: el.classList.contains('is-visible'), opacity: getComputedStyle(el).opacity, inline: el.style.cssText }));
  assert.equal(waiting.visible, false, 'a block below the fold was revealed early');
  assert.equal(waiting.opacity, '0', 'a waiting block should be hidden');
  assert.equal(waiting.inline, '', 'the scroll position must not write styles onto a block (no scrub)');
  // it enters: one short fade-and-rise on the one curve
  await park(0.6);
  await page.waitForFunction((s) => document.querySelector(s).classList.contains('is-visible'), sel);
  const anim = await page.$eval(sel, (el) => {
    const a = el.getAnimations()[0];
    if (!a) return null;
    const k = a.effect.getKeyframes();
    const t = a.effect.getTiming();
    return { from: [String(k[0].opacity), k[0].transform], to: [String(k.at(-1).opacity), k.at(-1).transform],
      duration: t.duration, delay: t.delay, easing: t.easing, iterations: t.iterations };
  });
  assert.ok(anim, 'the entering block did not animate');
  assert.deepEqual(anim.from, ['0', 'translateY(12px)'], 'the reveal should start 12px low and transparent');
  assert.deepEqual(anim.to, ['1', 'none'], 'the reveal should land in place, fully opaque');
  assert.ok(anim.duration >= 300 && anim.duration <= 500, `reveal lasts ${anim.duration}ms`);
  assert.ok(anim.delay <= 250, `reveal waits ${anim.delay}ms`);
  assert.equal(anim.iterations, 1, 'the reveal must play once');
  assert.match(anim.easing, /cubic-bezier\(0\.22, 1, 0\.36, 1\)/, `reveal easing is ${anim.easing}`);
  // done: in place, opaque, nothing left running or written inline
  await page.waitForTimeout(800);
  const done = await page.$eval(sel, (el) => ({ opacity: getComputedStyle(el).opacity,
    transform: getComputedStyle(el).transform, running: el.getAnimations().length, inline: el.style.cssText }));
  assert.deepEqual(done, { opacity: '1', transform: 'none', running: 0, inline: '' }, 'the block did not settle clean');
  // scrolling back up never hides it again, and coming back never replays it
  await park(1.3);
  await page.waitForTimeout(300);
  await park(0.6);
  await page.waitForTimeout(100);
  const again = await page.$eval(sel, (el) => ({ visible: el.classList.contains('is-visible'),
    opacity: getComputedStyle(el).opacity, running: el.getAnimations().length }));
  assert.deepEqual(again, { visible: true, opacity: '1', running: 0 }, 'the reveal reversed or replayed');
  await page.close();
});

test('prefers-reduced-motion: no parallax, no reveal-gating, titles visible', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(400);
  const heroTransform = await page.$eval('#hero .hero-copy', (el) => el.style.transform || '');
  assert.equal(heroTransform, '', 'parallax should be disabled under reduced motion');
  // The reveal system must never arm under reduced motion
  assert.equal(await page.locator('.js-reveal').count(), 0, 'js-reveal applied under reduced motion');
  const hiddenTitles = await page.evaluate(() =>
    [...document.querySelectorAll('.section-title')]
      .filter((el) => getComputedStyle(el).opacity !== '1').length
  );
  assert.equal(hiddenTitles, 0, 'section titles hidden under reduced motion');
  await page.close();
});

test('mobile viewport renders hero and certificates', async () => {
  const { page, errors } = await openPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  assert.match(await page.textContent('#hero h1'), /Tanapol/);
  await page.evaluate(() => document.getElementById('certificates').scrollIntoView());
  await page.waitForSelector('#images-list img');
  assert.deepEqual(errors, [], `mobile console errors:\n${errors.join('\n')}`);
  await page.close();
});

test('hero stays clean: no navbar, no CTA buttons, no wash; the name is solid text', async () => {
  const { page } = await openPage();
  assert.equal(await page.locator('#site-nav').count(), 0, 'navbar should be removed');
  assert.equal(await page.locator('#hero .hero-btn').count(), 0, 'CTA buttons should be removed');
  const lines = await page.$$eval('#hero .hero-name-line', (els) => els.map((el) => {
    const cs = getComputedStyle(el);
    return { clip: cs.webkitBackgroundClip || cs.backgroundClip, bg: cs.backgroundImage, fill: cs.webkitTextFillColor };
  }));
  assert.equal(lines.length, 2, 'expected two name lines');
  for (const l of lines) {
    assert.notEqual(l.clip, 'text', 'the name is still gradient text');
    assert.equal(l.bg, 'none', 'the name carries a background image');
    assert.equal(l.fill, 'rgb(29, 29, 31)', 'the name is not solid #1D1D1F');
  }
  // no radial colour wash behind the copy or behind the closing headline
  const washes = await page.evaluate(() => ['#hero .hero-copy', '#contact'].map((s) =>
    getComputedStyle(document.querySelector(s), '::before').backgroundImage));
  washes.forEach((w) => assert.ok(!/gradient/.test(w), `colour wash still behind the copy: ${w}`));
  const cta = await page.$eval('#contact .cta-headline', (el) => getComputedStyle(el).backgroundImage);
  assert.equal(cta, 'none', 'the closing headline is still gradient text');
  await page.close();
});

test('back-to-top appears after scrolling and returns to top', async () => {
  const { page } = await openPage();
  assert.ok(!(await page.$eval('#back-to-top', (b) => b.classList.contains('visible'))), 'hidden at top');
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForFunction(() => document.getElementById('back-to-top').classList.contains('visible'));
  await page.click('#back-to-top');
  await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 5000 });
  await page.close();
});

test('mobile: constellation never draws inside the hero copy block', async () => {
  const { page } = await openPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  await page.waitForTimeout(4000); // let nodes drift toward the text
  const inked = await page.evaluate(() => {
    const c = document.getElementById('hero-net');
    const hr = document.getElementById('hero').getBoundingClientRect();
    const cr = document.querySelector('#hero .hero-copy').getBoundingClientRect();
    const dpr = c.width / hr.width;
    const x = Math.max(0, Math.round((cr.left - hr.left) * dpr));
    const y = Math.max(0, Math.round((cr.top - hr.top) * dpr));
    const d = c.getContext('2d')
      .getImageData(x, y, Math.round(cr.width * dpr), Math.round(cr.height * dpr)).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  });
  assert.equal(inked, 0, `${inked} canvas pixels drawn over the hero text`);
  await page.close();
});

test('mobile: resize while scrolled (in-app toolbar) does not blank the constellation', async () => {
  const { page } = await openPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  await page.waitForTimeout(2500);
  // scroll deep into the page, then resize (like an in-app browser
  // collapsing its toolbars mid-scroll), then return to the top
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.setViewportSize({ width: 390, height: 944 });
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  // most labeled nodes must still be visible
  const visible = await page.$$eval('#hero-net-labels .hero-net-label',
    (els) => els.filter((el) => parseFloat(el.style.opacity || '1') > 0.5).length);
  assert.ok(visible >= 4, `only ${visible}/6 labeled nodes visible after mid-scroll resize`);
  // and the cluster area must actually contain ink
  const inked = await page.evaluate(() => {
    const c = document.getElementById('hero-net');
    const d = c.getContext('2d').getImageData(0, Math.round(c.height * 0.55), c.width, Math.round(c.height * 0.4)).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  });
  assert.ok(inked > 2000, `cluster area nearly empty (${inked} px) after mid-scroll resize`);
  await page.close();
});
