// Interaction coverage — every clickable/animated thing a visitor
// actually touches, driven in a real browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, inkCount } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

test('experience modal: opens from a card, filters by client, closes with Escape', async () => {
  const { page } = await ctx.openPage();
  await page.evaluate(() => document.getElementById('experience').scrollIntoView());
  await page.waitForSelector('[data-exp="protollcall"]');
  await page.click('[data-exp="protollcall"]');
  await page.waitForSelector('.exp-lightbox.open');
  await page.waitForSelector('.exp-lightbox .exp-filter-chip');
  // pick a specific client chip → other client sections hide
  const filtered = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.exp-lightbox .exp-filter-chip')];
    const target = chips.find((c) => c.dataset.filter && c.dataset.filter !== 'all' && c.dataset.filter !== 'general');
    if (!target) return null;
    target.click();
    const sections = [...document.querySelectorAll('.exp-lightbox .exp-client-section')];
    return {
      chosen: target.dataset.filter,
      shown: sections.filter((s) => s.style.display !== 'none').map((s) => s.dataset.client),
    };
  });
  assert.ok(filtered, 'no client chips found in modal');
  assert.deepEqual(filtered.shown, [filtered.chosen], 'chip did not filter client sections');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  await page.waitForFunction(() => document.body.style.overflow === '');
  await page.close();
});

test('project filters hide non-matching cards and All restores them', async () => {
  const { page } = await ctx.openPage();
  await page.evaluate(() => document.getElementById('portfolio').scrollIntoView());
  await page.waitForSelector('.filter-btn[data-filter]:not([data-filter="all"])');
  const result = await page.evaluate(() => {
    const btn = document.querySelector('.filter-btn[data-filter]:not([data-filter="all"])');
    btn.click();
    const items = [...document.querySelectorAll('.rf-cards-scroller-item')];
    const wrong = items.filter(
      (i) => i.style.display !== 'none' && i.getAttribute('data-tech') !== btn.dataset.filter
    ).length;
    const shown = items.filter((i) => i.style.display !== 'none').length;
    document.querySelector('.filter-btn[data-filter="all"]').click();
    const restored = items.filter((i) => i.style.display !== 'none').length;
    return { filter: btn.dataset.filter, wrong, shown, restored, total: items.length };
  });
  assert.equal(result.wrong, 0, `cards not matching '${result.filter}' stayed visible`);
  assert.ok(result.shown >= 1, 'filter hid everything');
  assert.equal(result.restored, result.total, "'All' did not restore every card");
  await page.close();
});

test('project and skill paddlenav arrows actually scroll their scrollers', async () => {
  const { page } = await ctx.openPage();
  for (const [scroller, next] of [
    ['#scroller', '.paddlenav-arrow-next'],
    ['#skill-scroller', '.skill-paddlenav-arrow-next'],
  ]) {
    await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), scroller);
    await page.waitForTimeout(300);
    const before = await page.$eval(scroller, (el) => el.scrollLeft);
    await page.click(next);
    await page.waitForFunction(
      ([s, prev]) => document.querySelector(s).scrollLeft > prev + 50,
      [scroller, before], { timeout: 4000 }
    );
  }
  await page.close();
});

test('typed role line cycles through roles', async () => {
  const { page } = await ctx.openPage();
  const seen = new Set();
  for (let i = 0; i < 14 && seen.size < 2; i++) {
    const t = (await page.textContent('#hero .typed')).trim();
    if (t.length > 3) seen.add(t);
    await page.waitForTimeout(500);
  }
  assert.ok(seen.size >= 2, `typed line stuck; saw only: ${[...seen].join(' | ')}`);
  await page.close();
});

test('footer: live year, employment duration, labelled social + contact links', async () => {
  const { page } = await ctx.openPage();
  assert.equal(await page.textContent('#current-year'), String(new Date().getFullYear()));
  assert.ok((await page.textContent('#protollcall-duration')).trim().length > 0, 'duration empty');
  const social = await page.$$eval('.social-links-footer a', (as) =>
    as.map((a) => ({ href: a.href, label: a.getAttribute('aria-label') || '' }))
  );
  assert.ok(social.length >= 3, 'social links missing');
  for (const s of social) {
    assert.match(s.href, /^https:\/\//, `social link not https: ${s.href}`);
    assert.ok(s.label.length > 3, `social link missing aria-label: ${s.href}`);
  }
  assert.ok(await page.locator('a[href^="mailto:"]').count() >= 1, 'mailto link missing');
  assert.ok(await page.locator('a[href^="tel:"]').count() >= 1, 'tel link missing');
  await page.close();
});

test('certificate lightbox also closes on backdrop click', async () => {
  const { page } = await ctx.openPage();
  await page.evaluate(() => document.getElementById('certificates').scrollIntoView());
  await page.waitForSelector('#images-list .cert-card');
  await page.click('#images-list .cert-card');
  await page.waitForSelector('.cert-lightbox.open');
  await page.click('.cert-lightbox', { position: { x: 8, y: 8 } });
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  await page.close();
});

test('constellation is animating (frames differ)', async () => {
  const { page } = await ctx.openPage();
  await page.waitForTimeout(2600);
  const snap = () => page.evaluate(`(() => {
    const c = document.getElementById('hero-net');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 3; i < d.length; i += 4096) h = (h * 31 + d[i]) | 0;
    return h;
  })()`);
  const a = await snap();
  await page.waitForTimeout(700);
  const b = await snap();
  assert.notEqual(a, b, 'canvas identical across frames — animation stalled');
  await page.close();
});

test('canvas self-heals after its bitmap is wiped (iOS purge class)', async () => {
  const { page } = await ctx.openPage();
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    const c = document.getElementById('hero-net');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  });
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(inkCount()) > 500, 'canvas stayed blank after wipe');
  await page.close();
});

test('reduced motion: constellation still paints and still self-heals', async () => {
  const page = await ctx.browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
  await page.waitForTimeout(800);
  assert.ok(await page.evaluate(inkCount()) > 500, 'no ink under reduced motion');
  await page.evaluate(() => {
    const c = document.getElementById('hero-net');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  });
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(inkCount()) > 500, 'no repaint after wipe under reduced motion');
  await page.close();
});

test('mouse sweep across the hero: nodes repel, no errors', async () => {
  const { page, errors } = await ctx.openPage();
  await page.waitForTimeout(2600);
  for (let x = 700; x <= 1300; x += 60) {
    await page.mouse.move(x, 450);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(inkCount()) > 500, 'canvas empty after mouse sweep');
  assert.deepEqual(errors, [], `errors during mouse sweep:\n${errors.join('\n')}`);
  await page.close();
});

test('name ink follows the nodes (CSS vars driven and changing)', async () => {
  const { page } = await ctx.openPage();
  await page.waitForTimeout(3000);
  const read = () => page.$eval('#hero .hero-name', (el) => ({
    x: el.style.getPropertyValue('--ink-x'),
    c: el.style.getPropertyValue('--ink-c'),
  }));
  const a = await read();
  assert.ok(a.x && a.c, 'ink vars not set');
  await page.waitForTimeout(6000);
  const b = await read();
  assert.ok(a.x !== b.x || a.c !== b.c, 'name ink frozen — not following nodes');
  await page.close();
});

test('animation resumes after scrolling away and back (observer stop/start)', async () => {
  const { page } = await ctx.openPage();
  await page.waitForTimeout(2600);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => { window.scrollTo(0, 0); return window.scrollY === 0; });
  await page.waitForTimeout(400);
  const snap = () => page.evaluate(`(() => {
    const c = document.getElementById('hero-net');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 3; i < d.length; i += 4096) h = (h * 31 + d[i]) | 0;
    return h;
  })()`);
  const a = await snap();
  await page.waitForTimeout(700);
  const b = await snap();
  assert.notEqual(a, b, 'animation did not resume after returning to the hero');
  await page.close();
});
