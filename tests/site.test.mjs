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

test('hero renders name, typed role and the multi-agent constellation', async () => {
  const { page } = await openPage();
  assert.match(await page.textContent('#hero h1'), /Tanapol Chamnanhan/);
  await page.waitForFunction(() => document.querySelector('#hero .typed')?.textContent.length > 0);
  assert.equal(await page.locator('#hero-net').count(), 1, 'constellation canvas missing');
  const labels = await page.$$eval('#hero-net-labels .hero-net-label', (els) => els.map((e) => e.textContent));
  assert.deepEqual(labels.sort(), ['ASR', 'CRM', 'IVR', 'LLM', 'POS', 'TTS'], 'labeled nodes missing');
  // canvas actually drew something
  const painted = await page.evaluate(() => {
    const c = document.getElementById('hero-net');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  });
  assert.ok(painted, 'constellation canvas is blank');
  await page.close();
});

test('scroll parallax moves and fades the hero copy', async () => {
  const { page } = await openPage();
  const before = await page.$eval('#hero .hero-copy', (el) => ({
    transform: el.style.transform, opacity: getComputedStyle(el).opacity,
  }));
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForFunction(
    (prev) => document.querySelector('#hero .hero-copy').style.transform !== prev,
    before.transform, { timeout: 5000 }
  );
  const after = await page.$eval('#hero .hero-copy', (el) => ({
    transform: el.style.transform, opacity: getComputedStyle(el).opacity,
  }));
  assert.ok(Number(after.opacity) < Number(before.opacity), 'hero copy did not fade on scroll');
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

test('sticky nav: 6 section links, glass state after scroll, active link tracks section', async () => {
  const { page } = await openPage();
  assert.equal(await page.locator('#site-nav .site-nav-links a').count(), 6);
  assert.ok(!(await page.$eval('#site-nav', (n) => n.classList.contains('scrolled'))), 'nav should start transparent');
  await page.evaluate(() => document.getElementById('experience').scrollIntoView());
  await page.waitForFunction(() => document.getElementById('site-nav').classList.contains('scrolled'));
  await page.waitForFunction(() =>
    document.querySelector('#site-nav a[href="#experience"]').classList.contains('active')
  );
  await page.close();
});

test('hero stays clean: no CTA buttons, no orb ring', async () => {
  const { page } = await openPage();
  assert.equal(await page.locator('#hero .hero-btn').count(), 0, 'CTA buttons should be removed');
  assert.equal(await page.locator('#hero .hero-orb-ring').count(), 0, 'orb ring should be removed');
  // Projects stay reachable through the nav instead
  await page.click('#site-nav a[href="#portfolio"]');
  await page.waitForFunction(() => {
    const r = document.getElementById('portfolio').getBoundingClientRect();
    return r.top > -50 && r.top < 200;
  }, null, { timeout: 5000 });
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
