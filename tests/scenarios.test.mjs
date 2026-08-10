// Full-loop scenario coverage: complete user journeys and component
// interplay — the seams where individual features meet (scroller ×
// filter × scrub × modal × lightbox) and where past bugs lived.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, inkCount } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

const settle = (page, ms = 400) => page.waitForTimeout(ms);

test('full user journey produces zero console errors and zero failed requests', async () => {
  const { page, errors, failed } = await ctx.openPage();
  // walk every section
  for (const id of ['resume', 'experience', 'skill', 'portfolio', 'certificates', 'contact']) {
    await page.evaluate((s) => document.getElementById(s).scrollIntoView(), id);
    await settle(page);
  }
  // exercise every project filter
  const filters = await page.$$eval('.filter-btn', (b) => b.length);
  for (let i = 0; i < filters; i++) {
    await page.$$eval('.filter-btn', (btns, idx) => btns[idx].click(), i);
    await settle(page, 250);
  }
  // paddle both scrollers back and forth
  for (const sel of ['#portfolio [data-scroller-next]', '#portfolio [data-scroller-prev]',
                     '#skill [data-scroller-next]', '#skill [data-scroller-prev]']) {
    await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
    await page.$eval(sel, (el) => el.click());
    await settle(page, 350);
  }
  // open and close every experience modal
  const keys = await page.$$eval('#experience .data-box[data-exp]', (els) => els.map((e) => e.dataset.exp));
  for (const key of keys) {
    await page.$eval(`#experience .data-box[data-exp="${key}"]`, (el) => el.click());
    await page.waitForSelector('.exp-lightbox.open');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  }
  // certificate lightbox open + backdrop close
  await page.$eval('#images-list .cert-card', (el) => el.scrollIntoView({ block: 'center' }));
  await page.$eval('#images-list .cert-card', (el) => el.click());
  await page.waitForSelector('.cert-lightbox.open');
  await page.$eval('.cert-lightbox', (el) => el.click());
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  // bottom, then back to top
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await settle(page, 600);
  assert.deepEqual(errors, [], `console/page errors during journey: ${errors.join(' | ')}`);
  assert.deepEqual(failed, [], `failed requests during journey: ${failed.join(' | ')}`);
  await page.close();
});

test('the two card scrollers are independent', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#portfolio [data-scroller-next]', (el) => el.scrollIntoView({ block: 'center' }));
  await settle(page);
  // paddle the PROJECT scroller only
  await page.$eval('#portfolio [data-scroller-next]', (el) => el.click());
  await page.waitForFunction(() => document.getElementById('scroller').scrollLeft > 100);
  const skillLeft = await page.evaluate(() => document.getElementById('skill-scroller').scrollLeft);
  assert.equal(skillLeft, 0, 'paddling projects moved the SKILL scroller');
  // wait for the project scroller's smooth glide to finish before sampling
  await page.waitForFunction(() => {
    const s = document.getElementById('scroller');
    const done = s._lastL === s.scrollLeft;
    s._lastL = s.scrollLeft;
    return done;
  }, null, { polling: 250, timeout: 5000 });
  // paddle the SKILL scroller only
  const projLeft = await page.evaluate(() => document.getElementById('scroller').scrollLeft);
  await page.$eval('#skill [data-scroller-next]', (el) => el.scrollIntoView({ block: 'center' }));
  await page.$eval('#skill [data-scroller-next]', (el) => el.click());
  await page.waitForFunction(() => document.getElementById('skill-scroller').scrollLeft > 100);
  const projAfter = await page.evaluate(() => document.getElementById('scroller').scrollLeft);
  assert.ok(Math.abs(projAfter - projLeft) < 2, 'paddling skills moved the PROJECT scroller');
  await page.close();
});

test('paddle arrows disable at the ends and re-enable after moving', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#portfolio [data-scroller-next]', (el) => el.scrollIntoView({ block: 'center' }));
  await settle(page, 600);
  const atStart = await page.$eval('#portfolio [data-scroller-prev]', (el) => el.disabled);
  assert.equal(atStart, true, 'prev should be disabled at the far left');
  await page.$eval('#portfolio [data-scroller-next]', (el) => el.click());
  await page.waitForFunction(() =>
    !document.querySelector('#portfolio [data-scroller-prev]').disabled, null, { timeout: 4000 });
  // ride to the far right end
  await page.evaluate(() => {
    const s = document.getElementById('scroller');
    s.scrollLeft = s.scrollWidth;
  });
  await page.waitForFunction(() =>
    document.querySelector('#portfolio [data-scroller-next]').disabled, null, { timeout: 4000 });
  await page.close();
});

test('filter cycle leaves every project card visible, settled, and the row rewound', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#portfolio .section-title', (el) => el.scrollIntoView());
  await settle(page, 700);
  // scroll the row, then run through every filter and land back on All
  await page.evaluate(() => { document.getElementById('scroller').scrollLeft = 500; });
  const nBtns = await page.$$eval('#portfolio .filter-btn', (b) => b.length);
  for (let i = 1; i < nBtns; i++) {
    await page.$$eval('#portfolio .filter-btn', (btns, idx) => btns[idx].click(), i);
    await settle(page, 250);
    const rewound = await page.evaluate(() => document.getElementById('scroller').scrollLeft);
    assert.ok(rewound <= 1, `filter did not rewind the scroller (at ${rewound}px)`);
  }
  await page.$eval('#portfolio .filter-btn[data-filter="all"]', (el) => el.click());
  await settle(page, 600);
  const state = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#portfolio .rf-cards-scroller-item')];
    return {
      hidden: items.filter((i) => i.style.display === 'none').length,
      dim: items.filter((i) => getComputedStyle(i).opacity !== '1').length,
      prevDisabled: document.querySelector('#portfolio [data-scroller-prev]').disabled,
    };
  });
  assert.equal(state.hidden, 0, `${state.hidden} cards still hidden after All`);
  assert.equal(state.dim, 0, `${state.dim} cards stuck semi-transparent after filtering`);
  assert.equal(state.prevDisabled, true, 'prev arrow should be disabled after rewind');
  await page.close();
});

test('skills filter shows only its category and never touches project cards', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#skill .section-title', (el) => el.scrollIntoView());
  await settle(page, 500);
  await page.$eval('#skill .filter-btn[data-filter="ai"]', (el) => el.click());
  await settle(page, 300);
  const state = await page.evaluate(() => ({
    shown: [...document.querySelectorAll('#skill .rf-cards-scroller-item')]
      .filter((i) => i.style.display !== 'none').length,
    wrong: [...document.querySelectorAll('#skill .rf-cards-scroller-item')]
      .filter((i) => i.style.display !== 'none' && i.dataset.tech !== 'ai').length,
    projectsHidden: [...document.querySelectorAll('#portfolio .rf-cards-scroller-item')]
      .filter((i) => i.style.display === 'none').length,
  }));
  assert.ok(state.shown >= 1, 'AI filter hid every skill card');
  assert.equal(state.wrong, 0, 'non-AI skill cards remained visible');
  assert.equal(state.projectsHidden, 0, 'skills filter leaked into project cards');
  await page.$eval('#skill .filter-btn[data-filter="all"]', (el) => el.click());
  await settle(page, 300);
  const restored = await page.evaluate(() =>
    [...document.querySelectorAll('#skill .rf-cards-scroller-item')]
      .filter((i) => i.style.display !== 'none').length);
  assert.equal(restored, 8, 'All did not restore every skill card');
  await page.close();
});

test('experience stats count up to their exact data-count values', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#experience .data-box[data-exp]', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1600); // stagger + 700ms count animation
  const wrong = await page.$$eval('#experience .data-box[data-exp]:first-of-type .js-count[data-count]',
    (els) => els
      .filter((el) => el.textContent.trim() !== el.dataset.count)
      .map((el) => `${el.textContent.trim()} != ${el.dataset.count}`));
  assert.deepEqual(wrong, [], `counters did not reach targets: ${wrong.join(', ')}`);
  await page.close();
});

test('each experience card opens ITS OWN modal (title matches its template)', async () => {
  const { page } = await ctx.openPage();
  const keys = await page.$$eval('#experience .data-box[data-exp]', (els) => els.map((e) => e.dataset.exp));
  assert.ok(keys.length >= 3, 'expected several experience cards');
  for (const key of keys) {
    await page.$eval(`#experience .data-box[data-exp="${key}"]`, (el) => el.scrollIntoView({ block: 'center' }));
    await settle(page, 300);
    await page.$eval(`#experience .data-box[data-exp="${key}"]`, (el) => el.click());
    await page.waitForSelector('.exp-lightbox.open');
    const ok = await page.evaluate((k) => {
      const tpl = document.getElementById('exp-' + k);
      const want = tpl.content.querySelector('.exp-modal-title').textContent.trim();
      const got = document.querySelector('.exp-lightbox.open .exp-modal-title');
      const company = tpl.content.querySelector('.exp-modal-company').textContent.trim();
      const gotCompany = document.querySelector('.exp-lightbox.open .exp-modal-company');
      return { want, got: got && got.textContent.trim(), company, gotCompany: gotCompany && gotCompany.textContent.trim() };
    }, key);
    assert.equal(ok.got, ok.want, `${key}: modal title mismatch`);
    assert.equal(ok.gotCompany, ok.company, `${key}: modal company mismatch`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  }
  // body scroll must be restored after the deferred unlock
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'body scroll not restored');
  await page.close();
});

test('certificate lightbox shows the exact card clicked, replays, and unlocks scroll', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#images-list', (el) => el.scrollIntoView());
  await page.waitForSelector('#images-list .cert-card img');
  await page.$eval('.certs-more', (btn) => btn.click()); // disclose the full grid
  for (const idx of [3, 7]) {
    const expected = await page.$$eval('#images-list .cert-card img', (imgs, i) => imgs[i].src, idx);
    await page.$$eval('#images-list .cert-card', (cards, i) => {
      cards[i].scrollIntoView({ block: 'center' });
      cards[i].click();
    }, idx);
    await page.waitForSelector('.cert-lightbox.open');
    const shown = await page.$eval('.cert-lightbox img', (i) => i.src);
    assert.equal(shown, expected, `lightbox shows wrong certificate for card ${idx}`);
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden',
      'body should be scroll-locked while the lightbox is open');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  }
  assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'scroll lock not released');
  await page.close();
});

test('3D business card sways on its own and stays static under reduced motion', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#biz-scene', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(700);
  const a = await page.$eval('#biz-card', (el) => el.style.transform);
  await page.waitForTimeout(500);
  const b = await page.$eval('#biz-card', (el) => el.style.transform);
  assert.ok(a.includes('rotate'), `card is not tilting (transform: "${a}")`);
  assert.notEqual(a, b, 'card transform frozen — sway loop not running');
  // contacts on the card are real links
  const links = await page.$$eval('#biz-card a', (els) => els.map((e) => e.getAttribute('href')));
  assert.ok(links.some((h) => h.startsWith('mailto:')), 'no mailto link on the card');
  assert.ok(links.some((h) => h.startsWith('tel:')), 'no tel link on the card');
  await page.close();

  const { page: rp } = await ctx.openPage({ reducedMotion: 'reduce' });
  await rp.$eval('#biz-scene', (el) => el.scrollIntoView({ block: 'center' }));
  await rp.waitForTimeout(600);
  assert.equal(await rp.$eval('#biz-card', (el) => el.style.transform), '',
    'card must stand still under reduced motion');
  await rp.close();
});

test('hero intro replays when the page returns from the back-forward cache', async () => {
  const { page } = await ctx.openPage();
  await page.waitForTimeout(2400); // first intro fully done
  const before = await page.$$eval('#hero-net-labels .hero-net-label',
    (els) => Math.max(...els.map((e) => parseFloat(e.style.opacity || '1'))));
  assert.ok(before > 0.4, 'labels should be visible after the first intro');
  // iOS-style bfcache restore
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForTimeout(350); // mid-shake of the replay
  const during = await page.$$eval('#hero-net-labels .hero-net-label',
    (els) => Math.max(...els.map((e) => parseFloat(e.style.opacity || '1'))));
  assert.ok(during < 0.1, `labels should hide during the replayed shake (got ${during})`);
  await page.waitForTimeout(1700); // replay finished
  const after = await page.$$eval('#hero-net-labels .hero-net-label',
    (els) => Math.max(...els.map((e) => parseFloat(e.style.opacity || '1'))));
  assert.ok(after > 0.4, 'labels should return after the replayed intro');
  await page.close();
});

test('progressive disclosure: certs open at six, expand on demand; exp teasers clamp', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#certificates', (el) => el.scrollIntoView());
  await page.waitForSelector('#images-list .cert-card');
  const before = await page.evaluate(() => ({
    visible: [...document.querySelectorAll('#images-list > div')]
      .filter((d) => getComputedStyle(d).display !== 'none').length,
    total: document.querySelectorAll('#images-list > div').length,
    btn: document.querySelector('.certs-more').textContent,
  }));
  assert.equal(before.visible, 6, `expected 6 visible cert cards, got ${before.visible}`);
  assert.ok(before.total > 6, 'grid should hold the full set behind the fold');
  assert.match(before.btn, new RegExp(`Show all ${before.total}`), 'button should state the real total');
  await page.$eval('.certs-more', (b) => b.click());
  const after = await page.evaluate(() => ({
    visible: [...document.querySelectorAll('#images-list > div')]
      .filter((d) => getComputedStyle(d).display !== 'none').length,
    btnGone: !document.querySelector('.certs-more'),
  }));
  assert.equal(after.visible, before.total, 'expand did not reveal every certificate');
  assert.ok(after.btnGone, 'the Show-all button should remove itself');
  // experience teaser clamps to three lines; the modal carries the full story
  const clamp = await page.$$eval('#experience .data-box[data-exp] .profile-bio-small',
    (els) => els
      .map((el) => ({ clamped: getComputedStyle(el).webkitLineClamp, h: el.offsetHeight, sh: el.scrollHeight }))
      .sort((a, b) => (b.sh - b.h) - (a.sh - a.h))[0]); // the most-overflowing card
  assert.equal(String(clamp.clamped), '3', 'experience description is not line-clamped');
  assert.ok(clamp.h < clamp.sh, 'clamp has no effect — teaser shows everything');
  // the highlight-chip row shares the type class but must stay flex —
  // clamping it once shattered the pills across lines
  const chips = await page.$eval('#experience .data-box[data-exp] .exp-card-highlights',
    (el) => ({ display: getComputedStyle(el).display, clamp: getComputedStyle(el).webkitLineClamp }));
  assert.equal(chips.display, 'flex', 'chip row lost its flex layout');
  assert.notEqual(String(chips.clamp), '3', 'chip row must not be line-clamped');
  await page.close();
});

test('320px (small phones): no horizontal overflow anywhere', async () => {
  const { page } = await ctx.openPage({
    viewport: { width: 320, height: 680 }, isMobile: true, hasTouch: true,
  });
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 2, `320px viewport has ${overflow}px horizontal overflow`);
  await page.close();
});

test('reduced motion: modals and lightbox still fully functional', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.$eval('#experience .data-box[data-exp]', (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  await page.$eval('#images-list .cert-card', (el) => el.click());
  await page.waitForSelector('.cert-lightbox.open');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  await page.close();
});

test('violent jump-scrolling then landing anywhere leaves nothing half-faded', async () => {
  const { page } = await ctx.openPage();
  await settle(page, 600);
  await page.evaluate(async () => {
    const H = document.body.scrollHeight;
    const stops = [H, 0, H * 0.6, H * 0.2, H, 0.4 * H, H];
    for (const y of stops) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
  });
  await settle(page, 700); // engine settles from live geometry
  const stuck = await page.evaluate(() =>
    [...document.querySelectorAll('.js-reveal')]
      .filter((el) => !el.classList.contains('is-visible')).length);
  assert.equal(stuck, 0, `${stuck} elements left un-settled after jump-scrolling to bottom`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 700);
  assert.ok(await page.evaluate(inkCount()) > 300, 'hero constellation broken after jump-scrolling');
  await page.close();
});
