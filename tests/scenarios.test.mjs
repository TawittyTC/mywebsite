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
  // multi-category cards (data-tech="web eng") must appear under BOTH filters
  for (const cat of ['web', 'eng']) {
    await page.$eval(`#skill .filter-btn[data-filter="${cat}"]`, (el) => el.click());
    await settle(page, 300);
    const bad = await page.evaluate((c) =>
      [...document.querySelectorAll('#skill .rf-cards-scroller-item')]
        .filter((i) => {
          const visible = i.style.display !== 'none';
          const belongs = i.dataset.tech.split(/\s+/).includes(c);
          return visible !== belongs;
        }).length, cat);
    assert.equal(bad, 0, `${cat} filter shows/hides the wrong cards`);
  }
  await page.$eval('#skill .filter-btn[data-filter="all"]', (el) => el.click());
  await settle(page, 300);
  const { restored, total } = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#skill .rf-cards-scroller-item')];
    return { restored: cards.filter((i) => i.style.display !== 'none').length, total: cards.length };
  });
  assert.equal(restored, total, 'All did not restore every skill card');
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
  const labelsVisible = () => page.waitForFunction(() =>
    Math.max(...[...document.querySelectorAll('#hero-net-labels .hero-net-label')]
      .map((e) => parseFloat(e.style.opacity || '1'))) > 0.4, null, { timeout: 10000 });
  await labelsVisible(); // first intro fully done (slow CI runners take a while)
  // iOS-style bfcache restore
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  // during the replayed shake every label hides
  await page.waitForFunction(() =>
    Math.max(...[...document.querySelectorAll('#hero-net-labels .hero-net-label')]
      .map((e) => parseFloat(e.style.opacity || '1'))) < 0.1, null, { timeout: 5000 });
  await labelsVisible(); // and they bloom back after the detonation
  await page.close();
});

test('cert grid shows everything at once; exp teasers clamp to three lines', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#certificates', (el) => el.scrollIntoView());
  await page.waitForSelector('#images-list .cert-card');
  // the Show-all disclosure was removed on request — every card visible, no button
  const grid = await page.evaluate(() => ({
    hidden: [...document.querySelectorAll('#images-list > div')]
      .filter((d) => getComputedStyle(d).display === 'none').length,
    btn: !!document.querySelector('.certs-more'),
  }));
  assert.equal(grid.hidden, 0, `${grid.hidden} cert cards hidden — disclosure should be gone`);
  assert.equal(grid.btn, false, 'the Show-all button should no longer exist');
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

test('every section carries its themed wave and the waves actually animate', async () => {
  const { page } = await ctx.openPage();
  // one wave per section: resume, experience, skill, portfolio, certificates
  // (the closing CTA deliberately has none)
  const homes = await page.$$eval('.section-wave', (els) =>
    els.map((el) => el.closest('section')?.id || ''));
  assert.deepEqual(homes, ['resume', 'experience', 'skill', 'portfolio', 'certificates'],
    'expected exactly one wave in each content section, in page order');
  // each themed part is animated (computed style, not just class names)
  const anims = await page.evaluate(() => {
    const name = (sel) => getComputedStyle(document.querySelector(sel)).animationName;
    return {
      flow: name('#resume .wave-flow'),
      dot: name('#experience .wave-dot'),
      bar: name('#skill .wave-bar'),
      signal: name('#portfolio .wave-signal'),
      ribbon: name('#certificates .wave-ribbon'),
    };
  });
  for (const [part, anim] of Object.entries(anims)) {
    assert.notEqual(anim, 'none', `${part} wave is not animated`);
  }
  // solid strokes only — dashed lines were rejected as visually noisy
  const dashed = await page.$$eval('.section-wave path', (els) =>
    els.filter((el) => getComputedStyle(el).strokeDasharray !== 'none').length);
  assert.equal(dashed, 0, `${dashed} wave paths still use dashed strokes`);
  // the Experience spark exists for the SMIL journey animation
  assert.ok(await page.$('#experience .wave-spark'), 'experience spark missing');
  // decorative only: hidden from assistive tech and never intercepts input
  const decorative = await page.$$eval('.section-wave', (els) =>
    els.every((el) => el.getAttribute('aria-hidden') === 'true'));
  assert.ok(decorative, 'waves must be aria-hidden');
  await page.close();
});

test('the SCG timeline pulse rides the connector from the oldest entry to the newest', async () => {
  const { page } = await ctx.openPage();
  const card = '#experience [data-exp="scg"]';
  // the reveal observer arms the animation; scroll the card into view first
  await page.$eval(card, (el) => el.scrollIntoView());
  await page.waitForFunction((sel) => document.querySelector(sel).classList.contains('card-visible'), card);

  // one pulse per connector: the last entry has none below it
  const sparks = await page.$$eval(`${card} .exp-role-spark`, (els) =>
    els.map((el) => getComputedStyle(el).display));
  assert.equal(sparks.length, 2, 'expected a pulse element on each timeline entry');
  assert.deepEqual(sparks, ['block', 'none'], 'only the entry with a connector may show a pulse');

  const orb = await page.$eval(`${card} .exp-role-spark`, (el) => {
    const cs = getComputedStyle(el, '::after');
    const track = el.getBoundingClientRect();
    return { anim: cs.animationName, radius: cs.borderTopLeftRadius, trackH: track.height };
  });
  assert.notEqual(orb.anim, 'none', 'the timeline pulse is not animated');
  assert.ok(parseFloat(orb.radius) >= 3, 'the pulse must be round');

  // node, connector and pulse must sit on one vertical axis — a half-pixel
  // of drift here is plainly visible against a 1.5px line
  const axis = await page.$eval(`${card} .exp-role`, (role) => {
    const mid = (pseudo) => {
      const cs = getComputedStyle(role, pseudo);
      return parseFloat(cs.left) + parseFloat(cs.width) / 2;
    };
    const track = role.querySelector('.exp-role-spark');
    const ts = getComputedStyle(track);
    const os = getComputedStyle(track, '::after');
    return {
      dot: mid('::before'),
      line: mid('::after'),
      orb: parseFloat(ts.left) + parseFloat(ts.width) / 2
        + parseFloat(os.marginLeft) + parseFloat(os.width) / 2,
    };
  });
  assert.ok(Math.abs(axis.line - axis.dot) < 0.5,
    `connector is off the node axis by ${(axis.line - axis.dot).toFixed(2)}px`);
  assert.ok(Math.abs(axis.orb - axis.dot) < 0.5,
    `pulse is off the node axis by ${(axis.orb - axis.dot).toFixed(2)}px`);

  // sample a full cycle: where the orb actually goes, and what colour it is
  const frames = [];
  for (let i = 0; i < 14; i++) {
    frames.push(await page.$eval(`${card} .exp-role-spark`, (el) => {
      const cs = getComputedStyle(el, '::after');
      return { y: el.getBoundingClientRect().top + parseFloat(cs.top),
        rgb: (cs.backgroundColor.match(/\d+/g) || []).map(Number), op: parseFloat(cs.opacity) };
    }));
    await page.waitForTimeout(300);
  }
  const seen = frames.filter((f) => f.op > 0.6);
  assert.ok(seen.length >= 4, 'expected to catch the pulse mid-travel');

  // the two ends of the run are the two nodes themselves, not points near them
  const dots = await page.$$eval(`${card} .exp-role`, (roles) => roles.map((r) => {
    const cs = getComputedStyle(r, '::before');
    return r.getBoundingClientRect().top + parseFloat(cs.top) + parseFloat(cs.height) / 2;
  }));
  const [newest, oldest] = dots;
  const lowest = Math.max(...seen.map((f) => f.y));
  const highest = Math.min(...seen.map((f) => f.y));
  assert.ok(Math.abs(highest - newest) <= 3,
    `pulse should finish on the current node (ended ${highest.toFixed(1)}, node at ${newest.toFixed(1)})`);
  assert.ok(oldest - lowest <= 8,
    `pulse should set out from the older node (started ${lowest.toFixed(1)}, node at ${oldest.toFixed(1)})`);

  // and it changes colour on the way: grey at the bottom, link blue at the top
  const low = seen.reduce((a, b) => (a.y > b.y ? a : b));
  const high = seen.reduce((a, b) => (a.y < b.y ? a : b));
  assert.ok(low.rgb[0] > 150, `pulse should leave the older node grey, got rgb(${low.rgb})`);
  assert.deepEqual(high.rgb.slice(0, 3), [18, 100, 206],
    `pulse should arrive as link blue, got rgb(${high.rgb})`);
  await page.close();
});

test('a sheet grows from the card that opened it and never jumps back when re-grabbed', async () => {
  const { page } = await ctx.openPage();
  const card = '#experience [data-exp="scg"]';
  const scale = () => page.$eval('.exp-lightbox-inner', (el) =>
    new DOMMatrixReadOnly(getComputedStyle(el).transform).a);

  // park the card high in the viewport on purpose: centring it would put its
  // middle on the sheet's own middle and make "is it anchored?" unanswerable
  await page.$eval(card, (el) => el.scrollIntoView({ block: 'start' }));
  await settle(page, 400);
  await page.$eval(card, (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open');
  await page.waitForFunction(() =>
    new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.exp-lightbox-inner')).transform).a > 0.995);

  // The growth point must track the trigger. Pinning it to an exact pixel
  // would be chasing sub-pixel reflow (the scroll lock and the reveal scrub
  // both nudge the card as it opens), so prove the behaviour instead: move
  // the trigger, and the origin has to travel with it and stay on the sheet.
  const originOf = () => page.evaluate(() => {
    const inner = document.querySelector('.exp-lightbox-inner');
    const prev = inner.style.transform;
    inner.style.transform = 'none';
    const h = inner.getBoundingClientRect().height;
    inner.style.transform = prev;
    return { y: parseFloat(getComputedStyle(inner).transformOrigin.split(' ')[1]), h };
  });
  const first = await originOf();
  assert.ok(first.y >= 0 && first.y <= first.h,
    `growth origin ${first.y} sits outside the sheet (0..${first.h})`);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  await page.evaluate(() => window.scrollBy(0, 140));
  await settle(page, 250);
  await page.$eval(card, (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open');
  const second = await originOf();
  assert.ok(Math.abs(second.y - first.y) > 40,
    `growth origin barely moved (${first.y} -> ${second.y}) — it is not following the card`);
  assert.ok(second.y >= 0 && second.y <= second.h,
    `growth origin ${second.y} sits outside the sheet (0..${second.h})`);
  await page.waitForFunction(() =>
    new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.exp-lightbox-inner')).transform).a > 0.995);

  // catch it mid-close and re-open: the motion must carry on from where it
  // is, not restart. Measured inside one frame pair so a slow runner cannot
  // drift the reading.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() =>
    new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.exp-lightbox-inner')).transform).a < 0.99);
  const caught = await page.evaluate((sel) => new Promise((done) => {
    const inner = document.querySelector('.exp-lightbox-inner');
    const read = () => new DOMMatrixReadOnly(getComputedStyle(inner).transform).a;
    const before = read();
    document.querySelector(sel).click();
    requestAnimationFrame(() => requestAnimationFrame(() => done({ before, after: read() })));
  }), card);
  assert.ok(caught.after >= caught.before - 0.01,
    `sheet restarted instead of resuming (${caught.before.toFixed(3)} -> ${caught.after.toFixed(3)})`);

  // and it still lands fully open
  await page.waitForFunction(() =>
    new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.exp-lightbox-inner')).transform).a > 0.995);
  assert.ok(await scale() > 0.995, 'sheet did not settle open after the interruption');
  await page.close();
});

test('type follows the reader\'s own text-size setting, layout and all', async () => {
  const { page } = await ctx.openPage();
  const read = () => page.evaluate(() => ({
    root: parseFloat(getComputedStyle(document.documentElement).fontSize),
    body: parseFloat(getComputedStyle(document.body).fontSize),
    head: parseFloat(getComputedStyle(document.querySelector('.section-title h2')).fontSize),
    small: parseFloat(getComputedStyle(document.querySelector('#footer')).fontSize),
  }));
  const normal = await read();
  assert.ok(Math.abs(normal.root - 17) < 0.5, `default root should still be 17px, got ${normal.root}`);

  // this is the browser's own "default font size" preference, the web's
  // equivalent of Dynamic Type — a px root would simply ignore it
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 24, fixed: 24 } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const larger = await read();

  for (const key of ['root', 'body', 'head', 'small']) {
    const ratio = larger[key] / normal[key];
    assert.ok(Math.abs(ratio - 1.5) < 0.05,
      `${key} should scale 1.5x with a 16 -> 24 setting, scaled x${ratio.toFixed(3)}`);
  }
  await page.close();
});
