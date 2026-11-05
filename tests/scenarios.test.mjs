// Full-loop scenario coverage: complete user journeys and component
// interplay — the seams where individual features meet (scroller ×
// filter × reveal × modal × lightbox) and where past bugs lived.
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
  // exercise every filter chip
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

test('filter cycle leaves every skill card visible, settled, and the row rewound', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#skill .section-title', (el) => el.scrollIntoView());
  await settle(page, 700);
  // scroll the row, then run through every filter and land back on All
  await page.evaluate(() => { document.getElementById('skill-scroller').scrollLeft = 500; });
  const nBtns = await page.$$eval('#skill .filter-btn', (b) => b.length);
  for (let i = 1; i < nBtns; i++) {
    await page.$$eval('#skill .filter-btn', (btns, idx) => btns[idx].click(), i);
    await settle(page, 250);
    const rewound = await page.evaluate(() => document.getElementById('skill-scroller').scrollLeft);
    assert.ok(rewound <= 1, `filter did not rewind the scroller (at ${rewound}px)`);
  }
  await page.$eval('#skill .filter-btn[data-filter="all"]', (el) => el.click());
  await settle(page, 600);
  const state = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#skill .rf-cards-scroller-item')];
    return {
      hidden: items.filter((i) => i.style.display === 'none').length,
      dim: items.filter((i) => getComputedStyle(i).opacity !== '1').length,
      prevDisabled: document.querySelector('#skill [data-scroller-prev]').disabled,
      pressed: [...document.querySelectorAll('#skill .filter-btn')].map((b) => b.getAttribute('aria-pressed')),
    };
  });
  assert.equal(state.hidden, 0, `${state.hidden} cards still hidden after All`);
  assert.equal(state.dim, 0, `${state.dim} cards stuck semi-transparent after filtering`);
  assert.equal(state.prevDisabled, true, 'prev arrow should be disabled after rewind');
  assert.deepEqual(state.pressed, ['true', ...Array(state.pressed.length - 1).fill('false')],
    'only All should be marked selected');
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

test('experience stats show their exact data-count values, in one number format, without counting up', async () => {
  const { page } = await ctx.openPage();
  const card = '#experience .data-box[data-exp]:first-of-type';
  const read = () => page.$$eval(`${card} .js-count[data-count]`, (els) => els
    .filter((el) => el.textContent.trim() !== Number(el.dataset.count).toLocaleString('en-US'))
    .map((el) => `${el.textContent.trim()} != ${Number(el.dataset.count).toLocaleString('en-US')}`));
  // final before the card is ever on screen, and the same once it has entered:
  // a number that never changes does not tick up from 0
  assert.deepEqual(await read(), [], 'counters are not written final');
  await page.$eval(card, (el) => el.scrollIntoView({ block: 'center' }));
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(150);
    // one format across the page: 2,000 (with a thousands separator), never 2000
    const wrong = await read();
    assert.deepEqual(wrong, [], `counters changed on entry: ${wrong.join(', ')}`);
  }
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

test('the business card tilts only with the pointer, rests flat without it, and stays still under reduced motion', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('#biz-scene', (el) => el.scrollIntoView({ block: 'center' }));
  await page.mouse.move(2, 2); // the pointer is nowhere near the card
  await page.waitForTimeout(600);
  // owner decision: no idle sway, so with nothing pointing at it nothing moves
  const idle = () => page.$eval('#biz-card', (el) => el.style.transform);
  const a = await idle();
  await page.waitForTimeout(700);
  assert.equal(await idle(), a, 'card moved with no pointer input (idle sway)');
  assert.ok(!/rotate[XY]\((?!0(\.0+)?deg)/.test(a), `card rests tilted with no pointer input: "${a}"`);
  // the pointer over its top-right corner tilts it toward that corner
  const box = await page.$eval('#biz-card', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  await page.mouse.move(box.x + box.w * 0.85, box.y + box.h * 0.2, { steps: 4 });
  await page.waitForTimeout(500);
  const tilted = await idle();
  const deg = (t, axis) => parseFloat((t.match(new RegExp(`rotate${axis}\\((-?[\\d.]+)deg`)) || [0, 0])[1]);
  assert.notEqual(tilted, a, 'card did not follow the pointer');
  assert.ok(deg(tilted, 'Y') > 2 && deg(tilted, 'X') > 1, `tilt is not toward the pointer: "${tilted}"`);
  assert.ok(Math.abs(deg(tilted, 'Y')) <= 6.01 && Math.abs(deg(tilted, 'X')) <= 4.01, `tilt is more than a few degrees: "${tilted}"`);
  // the pointer leaves: it eases back flat and then stops drawing
  await page.mouse.move(2, 2, { steps: 4 });
  await page.waitForTimeout(1200);
  assert.equal(await idle(), '', 'card did not settle flat after the pointer left');
  // contacts on the card are real links
  const links = await page.$$eval('#biz-card a', (els) => els.map((e) => e.getAttribute('href')));
  assert.ok(links.some((h) => h.startsWith('mailto:')), 'no mailto link on the card');
  assert.ok(links.some((h) => h.startsWith('tel:')), 'no tel link on the card');
  // the light pools stand still
  const pools = await page.$eval('#biz-card .biz-light', (el) =>
    ['::before', '::after'].map((p) => getComputedStyle(el, p).animationName));
  assert.deepEqual(pools, ['none', 'none'], 'the light pools still drift');
  await page.close();

  const { page: rp } = await ctx.openPage({ reducedMotion: 'reduce' });
  await rp.$eval('#biz-scene', (el) => el.scrollIntoView({ block: 'center' }));
  const rb = await rp.$eval('#biz-card', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * 0.85, y: r.top + r.height * 0.2 };
  });
  await rp.mouse.move(rb.x, rb.y, { steps: 4 });
  await rp.waitForTimeout(600);
  assert.equal(await rp.$eval('#biz-card', (el) => el.style.transform), '',
    'card must stand still under reduced motion');
  await rp.close();
});

test('the business card keeps its coloured light inside the glass', async () => {
  // owner decision: the Liquid Glass look stays, but no light spills past
  // the card's edge and nothing outside it is tinted
  const { page } = await ctx.openPage();
  await page.$eval('#biz-scene', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const card = document.getElementById('biz-card');
    const light = card.querySelector(':scope > .biz-light');
    const scene = document.getElementById('biz-scene');
    const lc = light && getComputedStyle(light);
    // every shadow outside the card must be a neutral grey
    const outer = getComputedStyle(card).boxShadow.split(/,(?![^(]*\))/).filter((x) => !/inset/.test(x));
    const tinted = outer.filter((x) => {
      const m = x.match(/rgba?\((\d+), (\d+), (\d+)/);
      return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 4;
    });
    return {
      light: !!light,
      clipped: lc && lc.overflow === 'hidden' && lc.position === 'absolute' && lc.inset === '0px',
      pools: ['::before', '::after'].map((p) => getComputedStyle(scene, p).content),
      tinted,
    };
  });
  assert.ok(r.light, 'the light pools are not inside the card');
  assert.ok(r.clipped, 'the light layer does not clip to the card');
  assert.deepEqual(r.pools, ['none', 'none'], 'light pools still sit behind the card, outside its edge');
  assert.deepEqual(r.tinted, [], `coloured shadow outside the card: ${r.tinted.join(' / ')}`);
  await page.close();
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

test('cert grid shows everything at once; exp teasers end inside their three-line clamp', async () => {
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
  // each certificate is named for what it is, not "Certificate 7"
  const alts = await page.$$eval('#images-list img', (imgs) => imgs.map((i) => i.alt));
  const vague = alts.filter((a) => !/^Certificate: \S/.test(a) || /\bCertificate \d+$/.test(a));
  assert.deepEqual(vague, [], 'a certificate image without its real name in the alt text');
  // each experience teaser is one short sentence that ends inside the
  // three-line clamp (the clamp stays as a guard): no sentence is cut off
  // with an ellipsis, on a desktop or a phone; the modal carries the full story
  const teasers = (pg) => pg.$$eval('#experience .data-box[data-exp] .profile-bio-small:not(.exp-card-highlights)',
    (els) => els.map((el) => ({ text: el.textContent.trim().slice(0, 40), clamped: getComputedStyle(el).webkitLineClamp,
      h: el.clientHeight, sh: el.scrollHeight })));
  const phone = await ctx.openPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const [w, list] of [[1440, await teasers(page)], [390, await teasers(phone.page)]]) {
    for (const t of list) {
      assert.equal(String(t.clamped), '3', `${w}px: "${t.text}" lost its three-line clamp`);
      assert.ok(t.sh <= t.h + 1, `${w}px: "${t.text}…" runs past three lines and is cut off`);
    }
  }
  await phone.page.close();
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

test('every section carries its themed wave, drawn in once and then still', async () => {
  const { page } = await ctx.openPage();
  // one wave per section: resume, experience, skill, portfolio, certificates, services
  // (the closing CTA deliberately has none)
  const homes = await page.$$eval('.section-wave', (els) =>
    els.map((el) => el.closest('section')?.id || ''));
  assert.deepEqual(homes, ['resume', 'experience', 'skill', 'portfolio', 'certificates', 'services'],
    'expected exactly one wave in each content section, in page order');
  // solid strokes only — dashed lines were rejected as visually noisy
  const dashed = await page.$$eval('.section-wave path', (els) =>
    els.filter((el) => getComputedStyle(el).strokeDasharray !== 'none').length);
  assert.equal(dashed, 0, `${dashed} wave paths still use dashed strokes`);
  // decorative only: hidden from assistive tech and never intercepts input
  const decorative = await page.$$eval('.section-wave', (els) =>
    els.every((el) => el.getAttribute('aria-hidden') === 'true'));
  assert.ok(decorative, 'waves must be aria-hidden');
  // owner decision: each wave draws in once as its title arrives, then stays
  // still. Walk every section so each draw gets armed, sampling as it plays
  const looping = [];
  for (const id of homes) {
    await page.$eval(`#${id} .section-wave`, (el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(120);
    looping.push(...await page.$eval(`#${id} .section-wave`, (host) => {
      const bad = [];
      for (const el of [host, ...host.querySelectorAll('*')]) {
        const cs = getComputedStyle(el);
        if (cs.animationName !== 'none' && cs.animationIterationCount.split(',').some((n) => n.trim() === 'infinite')) {
          bad.push(`${el.tagName} ${cs.animationName}`);
        }
      }
      host.getAnimations({ subtree: true }).forEach((an) => {
        if (an.effect.getTiming().iterations === Infinity) bad.push(`animation ${an.animationName || an.id}`);
      });
      // SMIL is invisible to getAnimations: no repeatCount="indefinite" either
      host.querySelectorAll('animate, animateMotion, animateTransform, set').forEach((el) => {
        if (el.getAttribute('repeatCount') === 'indefinite' || el.getAttribute('repeatDur') === 'indefinite') {
          bad.push(`SMIL ${el.tagName}`);
        }
      });
      return bad.map((b) => `${host.closest('section').id}: ${b}`);
    }));
  }
  assert.deepEqual(looping, [], `wave parts still loop forever: ${looping.join(' | ')}`);
  // and once drawn nothing in any wave is still running
  await page.waitForTimeout(900);
  const running = await page.$$eval('.section-wave', (els) => els.flatMap((el) =>
    el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running')
      .map(() => el.closest('section').id)));
  assert.deepEqual(running, [], `waves still moving after their draw: ${running.join(', ')}`);
  await page.close();
});

test('the SCG timeline is still: its nodes and connector share one axis and nothing travels it', async () => {
  const { page } = await ctx.openPage();
  const card = '#experience [data-exp="scg"]';
  await page.$eval(card, (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(700);

  // node and connector must sit on one vertical axis — a half-pixel
  // of drift here is plainly visible against a 1.5px line
  const axis = await page.$eval(`${card} .exp-role`, (role) => {
    const mid = (pseudo) => {
      const cs = getComputedStyle(role, pseudo);
      return parseFloat(cs.left) + parseFloat(cs.width) / 2;
    };
    return { dot: mid('::before'), line: mid('::after') };
  });
  assert.ok(Math.abs(axis.line - axis.dot) < 0.5,
    `connector is off the node axis by ${(axis.line - axis.dot).toFixed(2)}px`);
  // the newest entry carries the blue node, the older one stays grey
  const nodes = await page.$$eval(`${card} .exp-role`, (roles) =>
    roles.map((r) => getComputedStyle(r, '::before').backgroundColor));
  assert.equal(nodes.length, 2, 'expected two timeline entries');
  assert.equal(nodes[0], 'rgb(18, 100, 206)', 'the current entry should carry the blue node');
  assert.notEqual(nodes[1], nodes[0], 'the older entry should not be blue');

  // owner decision: nothing on a job card moves on its own — no orb rides
  // the connector, and no element in the card runs an animation
  assert.equal(await page.$$eval(`${card} .exp-role-spark`, (els) => els.length), 0,
    'the travelling timeline orb is still in the card');
  const moving = await page.$eval(card, (el) => {
    const out = [];
    for (const n of [el, ...el.querySelectorAll('*')]) {
      for (const p of ['', '::before', '::after']) {
        const cs = getComputedStyle(n, p || null);
        if (cs.animationName !== 'none') out.push(`${n.className}${p} ${cs.animationName}`);
      }
    }
    return out;
  });
  assert.deepEqual(moving, [], `animated parts in the job card: ${moving.join(' | ')}`);
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
  // would be chasing sub-pixel reflow (the scroll lock can nudge the card
  // as it opens), so prove the behaviour instead: move
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
  // closing also takes the sheet's history entry back off; scroll once it has
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open') && history.state === null);
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
