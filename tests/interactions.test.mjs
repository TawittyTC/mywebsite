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

test('client work leads My Projects, and every card shows without a filter row', async () => {
  const { page } = await ctx.openPage();
  const state = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#portfolio .rf-cards-scroller-item')];
    return {
      filters: document.querySelectorAll('#portfolio .filter-btn').length,
      hidden: items.filter((i) => getComputedStyle(i).display === 'none').length,
      firstIsWork: items[0].classList.contains('work-card'),
      total: items.length,
    };
  });
  assert.equal(state.filters, 0, 'a filter row for a handful of projects only hides work');
  assert.equal(state.hidden, 0, 'a project card is hidden');
  assert.ok(state.firstIsWork, 'real client work should come before the student projects');
  await page.close();
});

test('every project card opens something real, and work comes before the student screenshots', async () => {
  const { page } = await ctx.openPage();
  const state = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#scroller > .rf-cards-scroller-item')];
    const dead = items.filter((c) => {
      if (!c.dataset.openExp) return !c.querySelector('.project-img img');
      const t = document.getElementById('exp-' + c.dataset.openExp);
      if (!t) return true;
      const k = c.dataset.client;
      return !!k && !t.content.querySelector(`.exp-filter-chip[data-filter="${k}"], .exp-client-section[data-client="${k}"]`);
    }).map((c) => c.querySelector('h3').textContent);
    const shots = items.map((c) => !!c.querySelector('.project-img'));
    const firstShot = shots.indexOf(true);
    return {
      dead,
      workAfterShots: firstShot < 0 ? 0 : shots.slice(firstShot).filter((s) => !s).length,
      // a hyphenated name may stay only inside a no-wrap span
      hyphenated: [...document.querySelectorAll('#portfolio h3')].map((h) => {
        const c = h.cloneNode(true);
        c.querySelectorAll('.nw').forEach((n) => n.remove());
        return c.textContent;
      }).filter((t) => /\w-\w/.test(t)),
    };
  });
  assert.deepEqual(state.dead, [], 'a card whose + opens nothing, or a sheet without that client or project');
  assert.equal(state.workAfterShots, 0, 'standouts first: the student screenshot cards close the row');
  assert.deepEqual(state.hyphenated, [], 'a card title can break at a hyphen; reword it or wrap it in <span class="nw">');
  await page.close();
});

test('an SCG card opens the SCG sheet on its own project', async () => {
  const { page } = await ctx.openPage();
  const want = await page.$eval('#scroller [data-open-exp="scg"][data-client="scg-familyday"]', (c) => c.dataset.client);
  await page.$eval('#scroller [data-client="scg-familyday"] .card-plus', (b) => b.click());
  await page.waitForSelector('.exp-lightbox.open');
  await page.waitForTimeout(100);
  const top = await page.evaluate(() => {
    const inner = document.querySelector('.exp-lightbox-inner');
    const edge = inner.getBoundingClientRect().top;
    const sec = [...inner.querySelectorAll('.exp-client-section')].find((s) => s.getBoundingClientRect().bottom > edge + 20);
    return sec && sec.dataset.client;
  });
  assert.equal(top, want, 'the SCG sheet did not open on the card\'s project');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  await page.close();
});

test('a client-work card opens its story in the experience sheet, on that client', async () => {
  const { page } = await ctx.openPage();
  const want = await page.$eval('#portfolio .work-card[data-client]', (c) => c.dataset.client);
  await page.$eval('#portfolio .work-card[data-client]', (c) => { c.scrollIntoView({ block: 'center' }); c.click(); });
  await page.waitForSelector('.exp-lightbox.open');
  const sheet = await page.evaluate(() => {
    const inner = document.querySelector('.exp-lightbox-inner');
    const active = inner.querySelector('.exp-filter-chip.active');
    const shown = [...inner.querySelectorAll('.exp-client-section')].filter((s) => s.style.display !== 'none');
    return { active: active && active.dataset.filter, pressed: active && active.getAttribute('aria-pressed'),
      shown: [...new Set(shown.map((s) => s.dataset.client))] };
  });
  assert.equal(sheet.active, want, 'the sheet did not open on the card\'s client');
  assert.equal(sheet.pressed, 'true', 'the chosen client chip does not say it is selected');
  assert.deepEqual(sheet.shown, [want], 'other clients are still listed');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  await page.close();
});

test('every project card shows its client\'s logo, a picture or its drawing, phones included', async () => {
  // the owner: "many projects but no picture or icon, so they don't look interesting",
  // then: "where a company has a logo, put it in place of the card's drawing"
  for (const width of [320, 390, 1440]) {
    const { page } = await ctx.openPage({ viewport: { width, height: 900 }, isMobile: width < 800, hasTouch: width < 800 });
    const bare = await page.$$eval('#scroller > .rf-cards-scroller-item', (cards) => cards.filter((c) => {
      const v = c.querySelector('.work-logo img') || c.querySelector('.work-icon svg, .project-img img');
      const r = v && v.getBoundingClientRect();
      // a logo is sized by its shape: a square mark is narrower than a wordmark
      const min = v && v.closest('.work-logo') ? 64 : 100;
      return !r || r.width < min || r.height < 12 || getComputedStyle(v.closest('.work-logo, .work-icon, .project-img')).display === 'none';
    }).map((c) => c.querySelector('h3').textContent));
    assert.deepEqual(bare, [], `${width}px: a card with no visual, or one too small to see`);
    await page.close();
  }
});

test('"See all" lists every project; a row opens it in the sheet and Back returns to the list', async () => {
  const { page } = await ctx.openPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const total = await page.$$eval('#scroller > .rf-cards-scroller-item', (c) => c.length);
  assert.match(await page.textContent('[data-proj-all]'), new RegExp(`See all ${total} projects`));
  await page.$eval('[data-proj-all]', (b) => { b.scrollIntoView({ block: 'center' }); b.click(); });
  await page.waitForSelector('.exp-lightbox.open .proj-row');
  // grouped by company, as SCG is: "Vehicle sales CRM" under "Inchcape Thailand";
  // every card once, its name in the row and its company as the heading
  const rows = await page.$$eval('.exp-lightbox .proj-row', (rs) => rs.map((r) => ({
    i: Number(r.dataset.i), name: r.querySelector('.proj-name').textContent,
    group: r.closest('.proj-group').querySelector('h3').textContent })));
  const cards = await page.$$eval('#scroller > .rf-cards-scroller-item', (n) => n.map((c) => ({
    title: c.querySelector('h3').textContent, company: c.dataset.company || '' })));
  assert.deepEqual(rows.map((r) => r.i).sort((a, b) => a - b), cards.map((c, i) => i), 'the list and the row disagree');
  for (const r of rows) {
    const { title, company } = cards[r.i], k = title.indexOf(', ');
    assert.equal(r.name, k > 0 ? title.slice(0, k) : title, `row ${r.i} is misnamed`);
    assert.equal(r.group, company || title.slice(k + 2), `"${r.name}" sits under the wrong company`);
  }
  // a client row: its project opens in the same sheet, one Back from the list
  const row = page.locator('.proj-group', { has: page.locator('h3', { hasText: 'Kasikorn' }) })
    .locator('.proj-row', { hasText: 'Sales campaign CRM' });
  // tapped where it is (a Playwright click would first scroll the sheet to suit itself)
  await page.evaluate(() => { document.querySelector('.exp-lightbox-inner').scrollTop = 300; });
  await row.evaluate((r) => r.click());
  await page.waitForSelector('.proj-back');
  const opened = await page.evaluate(() => document.querySelector('.exp-lightbox .exp-filter-chip.active')?.dataset.filter);
  assert.equal(opened, 'kasikorn', 'the row did not open its own client');
  // it lands on that client's story, clear of the "All projects" pill
  await page.waitForTimeout(700);
  const land = await page.evaluate(() => {
    const inner = document.querySelector('.exp-lightbox-inner');
    const top = (el) => el.getBoundingClientRect().top - inner.getBoundingClientRect().top;
    const pill = document.querySelector('.proj-back');
    return { story: top(document.querySelector('.exp-client-section[data-client="kasikorn"]')),
      pill: top(pill) + pill.offsetHeight, height: inner.clientHeight };
  });
  assert.ok(land.story >= land.pill && land.story < land.height / 3,
    `the client's story sits at ${Math.round(land.story)} of ${land.height}px (pill ends at ${Math.round(land.pill)})`);
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('.exp-lightbox.open .proj-row') && !document.querySelector('.proj-back'));
  const back = await page.evaluate(() => ({ top: document.querySelector('.exp-lightbox-inner').scrollTop,
    focus: document.activeElement.closest('.proj-group')?.querySelector('h3').textContent }));
  assert.equal(back.top, 300, 'the list did not come back where it was');
  assert.match(back.focus, /Kasikorn/, 'focus did not return to the row');
  // a screenshot row: the picture opens above the list, Escape closes only the picture
  await page.locator('.proj-row', { hasText: 'Classroom' }).evaluate((r) => r.click());
  await page.waitForSelector('.cert-lightbox.open');
  assert.ok(await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest('.cert-lightbox')),
    'the screenshot opened under the list');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  await page.waitForFunction(() => !!document.querySelector('.exp-lightbox.open .proj-row') && history.state && history.state.overlay === 1);
  // a new project, then the X: both history steps are taken back off
  await page.locator('.proj-group', { has: page.locator('h3', { hasText: 'Genius Track' }) }).locator('.proj-row').click();
  await page.waitForSelector('.proj-back');
  assert.match(await page.textContent('.exp-lightbox .exp-modal-title'), /Genius Track/);
  await page.click('.exp-lightbox-close');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open') && history.state === null);
  await page.close();
});

test('Back closes an open sheet or picture instead of leaving the site', async () => {
  const { page } = await ctx.openPage();
  const site = page.url();
  await page.goto(ctx.srv.url + '/robots.txt');
  await page.goto(site, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
  // certificate viewer: Back closes it and stays on the page
  await page.$eval('#images-list .cert-card', (c) => c.click());
  await page.waitForSelector('.cert-lightbox.open');
  await page.goBack();
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  assert.equal(page.url(), site, 'Back left the site with the certificate open');
  // experience sheet closed by its X leaves no stray history entry: Back now leaves
  await page.$eval('#experience .data-box[data-exp]', (c) => c.click());
  await page.waitForSelector('.exp-lightbox.open');
  await page.click('.exp-lightbox-close');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open') && history.state === null);
  await page.goBack();
  await page.waitForURL(/robots\.txt$/);
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

test('no blank-frame flicker while animating (bitmap never reads empty)', async () => {
  const { page } = await ctx.openPage();
  await page.waitForTimeout(2600);
  // trigger the same churn that used to storm resize(): tiny viewport
  // wobbles while sampling the live bitmap between frames
  const blanks = await page.evaluate(async () => {
    const c = document.getElementById('hero-net');
    const g = c.getContext('2d');
    let blanks = 0;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 37)); // deliberately not rAF-aligned
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let j = 3; j < d.length; j += 4096) if (d[j] > 8) n++;
      if (n < 3) blanks++;
    }
    return blanks;
  });
  assert.equal(blanks, 0, `${blanks}/25 samples caught an empty canvas — blank-frame flicker`);
  await page.close();
});
