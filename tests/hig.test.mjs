// Apple's Human Interface Guidelines, the parts a visitor at default settings never sees:
// larger text (the browser's text size, or page zoom), VoiceOver, the keyboard, and the
// system settings Reduce Transparency and contrast themes. Each test names the HIG rule.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, styled } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const SMALL = { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true };

/** A page whose default text size is `px` (16 is the browser default; 32 is 200% text). */
async function openAt(opts, px) {
  const page = await ctx.browser.newPage({ reducedMotion: 'reduce', ...opts });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: px, fixed: 13 } });
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(styled, null, { timeout: 8000 });
  return { page, cdp };
}

/** Everything a larger text size could push off a card or off the screen. */
const largeTextReport = () => {
  const W = document.documentElement.clientWidth;
  const right = (el) => el.getBoundingClientRect().right;
  return {
    sideways: document.documentElement.scrollWidth - W,
    hero: ['.hero-name-line', '.hero-eyebrow', '.hero-role', '#hero .btn-pill']
      .flatMap((s) => [...document.querySelectorAll(s)])
      .filter((el) => right(el) > W + 0.5).map((el) => el.className),
    stats: [...document.querySelectorAll('.exp-stat-item')]
      .filter((el) => right(el) > right(el.closest('.exp-card-stats')) + 0.5).map((el) => el.textContent.trim()),
    profile: [...document.querySelectorAll('.profile-featured-body *')]
      .filter((el) => right(el) > right(document.querySelector('.data-box.profile-featured')) + 0.5)
      .map((el) => el.tagName),
    contact: [...document.querySelectorAll('.info-item > div')]
      .filter((el) => right(el) > right(el.closest('.info-item')) + 0.5).map((el) => el.textContent.trim()),
    // a date or period line is never cut by the description's three-line clamp
    dates: [...document.querySelectorAll('#experience .data-box[data-exp] .profile-bio-small:not(.exp-card-highlights)')]
      .filter((el) => /\b(19|20)\d\d\b/.test(el.textContent) && el.textContent.trim().length < 60)
      .filter((el) => el.scrollHeight > el.clientHeight + 1).map((el) => el.textContent.trim()),
  };
};

test('layout > Adaptability: at 200% text nothing is cut off and the page never scrolls sideways', async () => {
  for (const [where, opts] of [['iPhone', PHONE], ['small phone', SMALL], ['iPad', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }]]) {
    const { page } = await openAt(opts, 32);
    const r = await page.evaluate(largeTextReport);
    assert.equal(r.sideways, 0, `${where}: the page scrolls ${r.sideways}px sideways`);
    assert.deepEqual(r.hero, [], `${where}: hero text runs off the screen`);
    assert.deepEqual(r.stats, [], `${where}: experience stats are clipped`);
    assert.deepEqual(r.profile, [], `${where}: the profile card's text runs past the card`);
    assert.deepEqual(r.contact, [], `${where}: a contact tile's text runs past the tile`);
    assert.deepEqual(r.dates, [], `${where}: a date line is cut by the clamp`);
    await page.close();
  }
});

test('layout > Adaptability: at 200% page zoom on an iPhone (a 195px-wide layout) nothing is cut off', async () => {
  const { page } = await openAt({ viewport: { width: 195, height: 422 }, isMobile: true, hasTouch: true }, 16);
  const r = await page.evaluate(largeTextReport);
  assert.equal(r.sideways, 0, `the page scrolls ${r.sideways}px sideways`);
  assert.deepEqual(r.hero, [], 'hero text runs off the screen');
  assert.deepEqual(r.stats, [], 'experience stats are clipped');
  assert.deepEqual(r.profile, [], "the profile card's text runs past the card");
  await page.close();
});

test('typography > Dynamic Type: card, chip and FAQ text and the social icons grow with the text size; default sizes are kept', async () => {
  const sizes = async (px) => {
    const { page } = await openAt({ viewport: { width: 1280, height: 800 } }, px);
    const r = await page.evaluate(() => {
      const fs = (s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
      const w = (s) => document.querySelector(s).getBoundingClientRect().width;
      return {
        skill: fs('#skill .skill-desc'), faqQ: fs('#services .faq summary'), faqA: fs('#services .faq details > p'),
        chip: fs('#skill .skill-tools li'), footerIcon: w('.social-links-footer .social-icon'),
        profileIcon: w('.profile-featured .social-links .social-icon'),
      };
    });
    await page.close();
    return r;
  };
  const one = await sizes(16), two = await sizes(32);
  assert.deepEqual([one.skill, one.faqQ, one.faqA, one.chip], [17, 19, 17, 14], `default sizes moved: ${JSON.stringify(one)}`);
  assert.deepEqual([one.footerIcon, one.profileIcon], [24, 20], 'default icon sizes moved');
  for (const k of Object.keys(one)) {
    assert.ok(Math.abs(two[k] - one[k] * 2) < 0.6, `${k} is ${two[k]}px at 200% text, expected ${one[k] * 2}px`);
  }
});

test('typography: on 2K screens the sizes written for the 17px root stay as drawn', async () => {
  const page = await ctx.browser.newPage({ viewport: { width: 2560, height: 1440 }, reducedMotion: 'reduce' });
  await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
  const fs = await page.$eval('#skill .skill-desc', (el) => parseFloat(getComputedStyle(el).fontSize));
  assert.equal(fs, 17);
  await page.close();
});

test('voiceover: the typed role line is read as one steady sentence naming all three roles', async () => {
  const { page } = await ctx.openPage(PHONE);
  const said = () => page.locator('#hero .hero-role').ariaSnapshot();
  const first = await said();
  await page.waitForTimeout(700);
  const second = await said();
  assert.equal(first, second, 'what VoiceOver reads changes while the line types');
  assert.match(first, /I'm a Full-Stack Developer, an AI Engineer and a\s+Software Engineer\./);
  // the typed words are still drawn, in the line's grey with the role in blue
  const col = await page.$eval('#hero .hero-role > [aria-hidden]', (el) => getComputedStyle(el).color);
  assert.equal(col, 'rgb(110, 110, 115)');
  await page.close();
});

test('modality: the page behind an open sheet or the full-screen viewer is inert', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open');
  assert.equal(await page.$eval('#main-content', (el) => el.inert), true, 'the page under the sheet is not inert');
  assert.equal(await page.$eval('#footer', (el) => el.inert), true);
  // what the browser hands to VoiceOver: the page's headings are gone from it
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const reach = nodes.filter((n) => !n.ignored && n.role?.value === 'heading' && n.name?.value === 'Resume');
  assert.equal(reach.length, 0, 'VoiceOver can still reach the page under the sheet');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  assert.equal(await page.$eval('#main-content', (el) => el.inert), false, 'the page stays inert after the sheet closed');

  await page.$eval('#images-list .cert-card', (el) => el.click());
  await page.waitForSelector('.cert-lightbox.open');
  assert.equal(await page.$eval('#main-content', (el) => el.inert), true, 'the page under the viewer is not inert');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  assert.equal(await page.$eval('#main-content', (el) => el.inert), false);
  await page.close();
});

test('keyboards: "View projects" and Back to top move keyboard focus along with the page', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.focus('#hero .btn-pill.scrollto');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  const at = await page.evaluate(() => ({ inPortfolio: !!document.activeElement.closest('#portfolio'), y: scrollY }));
  assert.ok(at.inPortfolio, 'the next Tab after "View projects" left the projects section');
  assert.ok(at.y > 3000, `the page jumped back up to y=${at.y}`);

  await page.evaluate(() => scrollTo(0, 6000));
  await page.waitForFunction(() => document.getElementById('back-to-top').classList.contains('visible'));
  await page.click('#back-to-top');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('hero-name')), true,
    'focus stayed on Back to top');
  await page.close();
});

test('images > alt text: each certificate is named by what is printed on it', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  const r = await page.$$eval('#images-list button.cert-img', (bs) => bs.map((b) => ({
    label: b.getAttribute('aria-label'), alt: b.querySelector('img').alt, lang: b.lang,
    mark: b.querySelector('.cert-expand-btn').getAttribute('aria-hidden'),
  })));
  assert.equal(r.length, 32, 'expected 32 certificate buttons');
  assert.ok(r.every((x) => x.mark === 'true'), "the corner '+' is only a picture of the tile's action");
  assert.ok(r.every((x) => x.alt && !/^Tanapol Certificate \d+$/.test(x.alt)), 'a certificate still has a numbered alt');
  // the second scan of #21 is gone, so every certificate has a name of its own
  assert.equal(new Set(r.map((x) => x.label)).size, 32, 'certificate buttons share names');
  assert.ok(r.filter((x) => /[฀-๿]/.test(x.label)).every((x) => x.lang === 'th'), 'a Thai name is not marked as Thai');
  await page.$eval('#images-list .cert-card', (el) => el.click());
  await page.waitForSelector('.cert-lightbox.open');
  assert.match(await page.$eval('.cert-lightbox', (el) => el.getAttribute('aria-label')), /^Certificate: /);
  await page.close();
});

test('collections: one Tab stop per collection, and the arrow keys move inside it', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  // the project row
  const stops = await page.$$eval('#scroller .card-plus', (bs) => bs.filter((b) => b.tabIndex === 0).length);
  assert.equal(stops, 1, 'the project row should be one Tab stop');
  await page.focus('#scroller .card-plus[tabindex="0"]');
  await page.keyboard.press('ArrowRight');
  const second = await page.evaluate(() => [...document.querySelectorAll('#scroller .card-plus')].indexOf(document.activeElement));
  assert.equal(second, 1, 'ArrowRight did not move to the next card');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('#scroller')), false, 'Tab stayed inside the row');
  // the certificate grid, three columns on a Mac
  await page.focus('#images-list button.cert-img[tabindex="0"]');
  await page.keyboard.press('ArrowDown');
  const down = await page.evaluate(() => [...document.querySelectorAll('#images-list button.cert-img')].indexOf(document.activeElement));
  assert.equal(down, 3, 'ArrowDown did not move one row down the grid');
  await page.keyboard.press('End');
  const end = await page.evaluate(() => [...document.querySelectorAll('#images-list button.cert-img')].indexOf(document.activeElement));
  assert.equal(end, 31, 'End did not move to the last of the 32 certificates');
  // the See-all list
  await page.$eval('[data-proj-all]', (el) => el.click());
  await page.waitForSelector('.proj-row');
  await page.focus('.proj-row[tabindex="0"]');
  await page.keyboard.press('ArrowDown');
  const row = await page.evaluate(() => [...document.querySelectorAll('.proj-row')].indexOf(document.activeElement));
  assert.equal(row, 1, 'ArrowDown did not move to the next row');
  await page.keyboard.press('Escape');
  // the whole page: about 145 Tab stops before, now far fewer
  const all = await page.evaluate(() => [...document.querySelectorAll('a[href], button, [tabindex]')]
    .filter((el) => el.tabIndex >= 0 && !el.disabled && el.getClientRects().length && !el.closest('[inert]')).length);
  assert.ok(all < 70, `${all} Tab stops`);
  await page.close();
});

test('focus: a focused card or certificate is outlined whole in the system ring, and a focused See-all row fills', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.keyboard.press('Tab');   // keyboard modality
  await page.focus('#scroller .card-plus[tabindex="0"]');
  assert.equal(await page.$eval('#scroller .card-plus[tabindex="0"]', (b) => getComputedStyle(b.closest('.rf-cards-scroller-item')).outlineStyle), 'auto');
  await page.focus('#images-list button.cert-img[tabindex="0"]');
  assert.equal(await page.$eval('#images-list button.cert-img[tabindex="0"]', (b) => getComputedStyle(b.closest('.cert-card')).outlineStyle), 'auto');
  await page.$eval('[data-proj-all]', (el) => el.click());
  await page.waitForSelector('.proj-row');
  await page.focus('.proj-row[tabindex="0"]');
  assert.equal(await page.$eval('.proj-row[tabindex="0"]', (b) => getComputedStyle(b.parentNode).backgroundColor), 'rgb(18, 100, 206)');
  await page.close();
});

test('focus: closing the viewer returns focus to the tile that opened it, even after a click', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.$eval('#images-list .cert-card', (el) => el.scrollIntoView({ block: 'center' }));
  const y = await page.evaluate(() => scrollY);
  await page.click('#images-list .cert-card');
  await page.waitForSelector('.cert-lightbox.open');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  const r = await page.evaluate(() => ({ first: document.activeElement === document.querySelector('#images-list button.cert-img'), y: scrollY }));
  assert.ok(r.first, 'focus did not return to the certificate');
  assert.equal(r.y, y, 'the page moved');
  await page.close();
});

test("buttons > hit regions: the viewer's close button reaches 44 x 44", async () => {
  const { page } = await ctx.openPage({ ...PHONE, reducedMotion: 'reduce' });
  await page.$eval('#images-list .cert-card', (el) => el.click());
  await page.waitForSelector('.cert-lightbox.open');
  const miss = await page.$eval('.cert-lightbox-close', (b) => {
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    return [[21, 0], [-21, 0], [0, 21], [0, -21]].filter(([dx, dy]) => !b.contains(document.elementFromPoint(x + dx, y + dy)));
  });
  assert.deepEqual(miss, []);
  await page.close();
});

test('focus: a paddle that turns off at the end of its row hands focus to the other paddle', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.focus('#skill [data-scroller-next]');
  for (let i = 0; i < 12; i++) {
    if (await page.$eval('#skill [data-scroller-next]', (b) => b.disabled)) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
  }
  assert.equal(await page.$eval('#skill [data-scroller-next]', (b) => b.disabled), true);
  assert.equal(await page.evaluate(() => document.activeElement.matches('#skill [data-scroller-prev]')), true, 'focus was dropped');
  await page.close();
});

test('pointing devices: on an iPad with a trackpad, Back to top comes back when the pointer reaches its corner', async () => {
  const { page } = await ctx.openPage({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => scrollTo(0, 6000));
  await page.waitForTimeout(200);
  await page.evaluate(() => scrollTo(0, 5000));
  await page.waitForTimeout(2800);
  assert.equal(await page.$eval('#back-to-top', (b) => b.classList.contains('visible')), false, 'expected it to have left');
  const r = await page.$eval('#back-to-top', (b) => { const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
  await page.mouse.move(r.x, r.y);
  await page.waitForTimeout(100);
  assert.equal(await page.$eval('#back-to-top', (b) => b.classList.contains('visible')), true);
  await page.close();
});

test('voiceover: a filter says what it left on screen', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.click('#skill .filter-btn[data-filter="ai"]');
  const said = await page.$eval('#skill [role="status"]', (el) => el.textContent);
  const n = await page.$$eval('#skill .rf-cards-scroller-item', (els) => els.filter((e) => e.style.display !== 'none').length);
  assert.equal(said, `Showing ${n} skill${n === 1 ? '' : 's'}: AI`);
  await page.close();
});

test('feedback: a copy the browser refuses says so and selects the text', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); });
  await page.click('.contact-strip a.info-item[href^="tel:"]');
  await page.waitForSelector('.toast.is-shown');
  const t = await page.evaluate(() => ({ text: document.querySelector('.toast-text').textContent, tick: document.querySelector('.toast-check').hidden, sel: String(getSelection()) }));
  assert.match(t.text, /^Couldn't copy/);
  assert.equal(t.tick, true, 'a failure shows the success tick');
  assert.match(t.sel, /962 437 210/);
  await page.close();
});

test('materials: Reduce Transparency makes Back to top and "All projects" opaque; contrast themes keep the pill edge', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  assert.equal(await page.$eval('#back-to-top', (b) => getComputedStyle(b).backdropFilter), 'none');
  await page.close();
  const forced = await ctx.openPage({ forcedColors: 'active' });
  assert.equal(await forced.page.$eval('#hero .btn-pill', (b) => getComputedStyle(b).borderTopWidth), '1px');
  await forced.page.close();
});
