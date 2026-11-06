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

test('no hyphenated word can break at its hyphen, on the page or in any sheet', async () => {
  const { page } = await ctx.openPage();
  const loose = await page.evaluate(() => {
    const out = [];
    const scan = (root, where) => {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = tw.nextNode())) {
        const el = n.parentElement;
        if (!el || el.closest('script, style, svg, noscript, head')) continue;
        for (const m of n.data.matchAll(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g)) {
          if (!el.closest('.nw, .svc-nw')) out.push(`${where}: ${m[0]}`);
        }
      }
    };
    window.__scanHyphens = (root, where) => { out.length = 0; scan(root, where); return out.slice(); };
    scan(document.body, 'page');
    document.querySelectorAll('template[id^="exp-"]').forEach((t) => scan(t.content, t.id));
    return out.slice();
  });
  // text that JS copies out of the page keeps the wrapper: the "See all" list ...
  await page.$eval('[data-proj-all]', (b) => b.click());
  await page.waitForSelector('.exp-lightbox.open .proj-row');
  loose.push(...await page.evaluate(() => window.__scanHyphens(document.querySelector('.exp-lightbox-inner'), 'all projects')));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  // ... and every screenshot card's caption
  const shots = await page.$$eval('#scroller > .rf-cards-scroller-item', (cs) => cs
    .map((c, i) => (c.querySelector('.project-img img') && !c.dataset.openExp ? i : -1)).filter((i) => i >= 0));
  assert.ok(shots.length >= 4, `only ${shots.length} screenshot cards`);
  for (const i of shots) {
    await page.evaluate((k) => document.querySelectorAll('#scroller > .rf-cards-scroller-item')[k].click(), i);
    await page.waitForSelector('.cert-lightbox.open');
    loose.push(...await page.evaluate(() => window.__scanHyphens(document.querySelector('.cert-lightbox-caption'), 'caption')));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  }
  assert.deepEqual(loose, [], 'wrap each hyphenated word in <span class="nw"> so a line never ends on its hyphen');
  await page.close();
});

test('an SCG card opens the SCG sheet on its own project', async () => {
  const { page } = await ctx.openPage();
  const want = await page.$eval('#scroller [data-open-exp="scg"][data-client="scg-familyday"]', (c) => c.dataset.client);
  await page.$eval('#scroller [data-client="scg-familyday"] .card-plus', (b) => b.click());
  await page.waitForSelector('.exp-lightbox.open');
  await page.waitForTimeout(100);
  const { top, clear } = await page.evaluate(() => {
    const inner = document.querySelector('.exp-lightbox-inner');
    // the sheet scrolls under its top bar: what shows starts at the bar's foot
    const edge = inner.querySelector('.exp-lightbox-bar').getBoundingClientRect().bottom;
    const sec = [...inner.querySelectorAll('.exp-client-section')].find((s) => s.getBoundingClientRect().bottom > edge + 20);
    return { top: sec && sec.dataset.client, clear: sec && sec.getBoundingClientRect().top >= edge };
  });
  assert.equal(top, want, 'the SCG sheet did not open on the card\'s project');
  assert.ok(clear, 'the project opened with its top under the sheet\'s bar');
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

test('with a mouse, "All projects" goes back to the list; the title clears the pill by 16px', async () => {
  const { page } = await ctx.openPage();
  await page.$eval('[data-proj-all]', (b) => { b.scrollIntoView({ block: 'center' }); b.click(); });
  await page.waitForSelector('.exp-lightbox.open .proj-row');
  await page.locator('.proj-group', { has: page.locator('h3', { hasText: 'Genius Track' }) }).locator('.proj-row').click();
  await page.waitForSelector('.proj-back');
  await page.waitForTimeout(300);
  const geo = await page.evaluate(() => {
    const pill = document.querySelector('.proj-back').getBoundingClientRect();
    const title = document.querySelector('.exp-lightbox .exp-modal-title').getBoundingClientRect();
    const hit = document.elementFromPoint(pill.left + pill.width / 2, pill.top + pill.height / 2);
    return { gap: title.top - pill.bottom, hitsPill: !!(hit && hit.closest('.proj-back')),
      closeSlop: getComputedStyle(document.querySelector('.exp-lightbox-close'), '::after').width };
  });
  assert.ok(geo.gap >= 16, `the title starts ${Math.round(geo.gap)}px under the pill`);
  // each bar button's hit-slop is its own 44px, not the whole bar
  assert.ok(geo.hitsPill, 'the close button\'s hit area covers the "All projects" pill');
  assert.equal(geo.closeSlop, '44px', 'the close button\'s hit area spans the bar');
  const box = await page.locator('.proj-back').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => document.querySelector('.exp-lightbox.open .proj-row') && !document.querySelector('.proj-back'));
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

test('the hero role line is static text that stays put', async () => {
  const { page } = await ctx.openPage();
  assert.equal(await page.locator('#hero .typed, [data-typed-items]').count(), 0, 'a typing effect is back in the hero');
  // let the one-time entrance finish, then the line must simply sit there
  await page.waitForFunction(() => document.querySelector('#hero .hero-role').getAnimations().every((a) => a.playState === 'finished'));
  const read = () => page.$eval('#hero .hero-role', (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return { text: el.textContent.replace(/\s+/g, ' ').trim(), x: Math.round(r.x), w: Math.round(r.width),
      shown: r.width > 0 && r.height > 0 && cs.visibility === 'visible' && +cs.opacity > 0.9 };
  });
  const first = await read();
  assert.equal(first.text, 'Full-stack developer and AI engineer');
  assert.ok(first.shown, 'the role line is not visible');
  // no typing and no deleting: the words and their box hold still
  await page.waitForTimeout(1200);
  assert.deepEqual(await read(), first, 'the role line changed on its own');
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

test('a pointer open puts no focus ring on the close button; the keyboard ring stays round', async () => {
  const { page } = await ctx.openPage();
  const close = () => page.evaluate(() => {
    const c = document.querySelector('.exp-lightbox.open .exp-lightbox-close, .cert-lightbox.open .cert-lightbox-close');
    return { ring: c.matches(':focus-visible'), focused: document.activeElement === c, radius: getComputedStyle(c).borderRadius };
  });
  for (const [open, sel] of [['#experience .data-box[data-exp="protollcall"]', '.exp-lightbox.open'], ['#images-list .cert-card', '.cert-lightbox.open']]) {
    await page.locator(open).first().scrollIntoViewIfNeeded();
    await page.click(open);
    await page.waitForSelector(sel);
    const byPointer = await close();
    assert.ok(!byPointer.ring && !byPointer.focused, `${sel}: a click put focus and its ring on the close button`);
    // Tab from the dialog lands on the close button: the ring follows its round shape
    await page.keyboard.press('Tab');
    const byKeys = await close();
    assert.ok(byKeys.focused && byKeys.ring, `${sel}: Tab did not reach the close button`);
    assert.equal(byKeys.radius, '50%', `${sel}: the focus ring squared the round close button`);
    await page.keyboard.press('Escape');
    await page.waitForFunction((s) => !document.querySelector(s), sel);
  }
  // the experience card's round "+": the ring follows the circle, not its square button
  await page.locator('#experience .exp-card-cta').first().scrollIntoViewIfNeeded();
  await page.$eval('#experience .exp-card-cta', (b) => b.focus());
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const plus = await page.$eval('#experience .exp-card-cta', (b) => ({ ring: b.matches(':focus-visible'), radius: getComputedStyle(b).borderRadius }));
  assert.ok(plus.ring, 'Tab did not put a ring on the experience card\'s "+"');
  assert.equal(plus.radius, '50%', 'the focus ring squared the round "+"');
  await page.close();
});

test('a card opened by a click hands focus back to its own button on close, so Tab carries on from there', async () => {
  const { page } = await ctx.openPage();
  const cases = [
    ['#experience .data-box[data-exp="scg"] h3', '.exp-lightbox', '.exp-lightbox-close', '.data-box', '.exp-card-cta'],
    ['#scroller > [data-open-exp] h3', '.exp-lightbox', '.exp-lightbox-close', '.rf-cards-scroller-item', '.card-plus'],
    ['#scroller > .rf-cards-scroller-item:not([data-open-exp]):has(.project-img img) h3', '.cert-lightbox', '.cert-lightbox-close', '.rf-cards-scroller-item', '.card-plus'],
    ['#images-list .cert-card img', '.cert-lightbox', '.cert-lightbox-close', '.cert-card', '.cert-expand-btn'],
  ];
  const where = (open, [card, btn, box]) => page.$eval(open, (el, [card, btn, box]) => {
    const a = document.activeElement;
    return { own: a === el.closest(card).querySelector(btn), inDialog: !!a.closest(box), ring: a.matches(':focus-visible'),
      name: a.className || a.tagName };
  }, [card, btn, box]);
  for (const [open, box, closeSel, card, btn] of cases) {
    await page.locator(open).first().scrollIntoViewIfNeeded();
    await page.click(open);
    await page.waitForSelector(`${box}.open`);
    await page.click(`${box}.open ${closeSel}`);
    await page.waitForFunction((b) => !document.querySelector(`${b}.open`), box);
    for (const wait of [100, 1200]) {
      await page.waitForTimeout(wait);
      const f = await where(open, [card, btn, box]);
      assert.ok(f.own && !f.inDialog, `${open}: ${wait}ms after close, focus is on ${f.name}, not the card's own button`);
      assert.ok(!f.ring, `${open}: a pointer close put a focus ring on the card's button`);
    }
    const y = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('Tab');
    const next = await page.evaluate(() => ({ y: window.scrollY, skip: document.activeElement.matches('.skip-link') }));
    assert.ok(!next.skip && next.y > 0, `${open}: Tab after closing jumped to the top of the page (${y} → ${next.y})`);
  }
  await page.close();
});

test('a tap anywhere on the screenshot caption closes it, the swipe hint included', async () => {
  const { page } = await ctx.openPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const open = () => page.evaluate(() => [...document.querySelectorAll('#scroller > .rf-cards-scroller-item')]
    .find((c) => c.textContent.includes('Real Time Pulse')).click());
  await open();
  await page.waitForSelector('.cert-lightbox.open.lb-pan .cert-lightbox-hint');
  // a tap on the wide picture pans it, so it keeps the viewer open
  const img = await page.locator('.cert-lightbox img').boundingBox();
  await page.touchscreen.tap(195, img.y + img.height / 2);
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => document.querySelector('.cert-lightbox').classList.contains('open')), 'a tap on the panning picture closed it');
  const hint = await page.locator('.cert-lightbox-hint').boundingBox();
  await page.touchscreen.tap(hint.x + hint.width / 2, hint.y + hint.height / 2);
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
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

test('the constellation runs one loop: a tab coming back never adds one, and reduced motion wakes 4 times a second', async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await ctx.browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
    // a hidden tab: Chrome holds queued frames and runs them on return
    await page.addInitScript(() => {
      let hidden = false;
      const held = [], raf = window.requestAnimationFrame.bind(window);
      Object.defineProperty(document, 'hidden', { get: () => hidden });
      Object.defineProperty(document, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible') });
      // loop calls, and the distinct frames they ran in: one loop makes
      // one call a frame, however busy or slow the machine is
      window.__loops = 0; window.__frames = 0;
      let lastTs = -1;
      window.requestAnimationFrame = (cb) => raf(function run(ts) {
        if (hidden) { held.push(run); return; }
        if (/\.loader/.test(String(cb))) {   // the constellation's loop
          window.__loops++;
          if (ts !== lastTs) { window.__frames++; lastTs = ts; }
        }
        return cb(ts);
      });
      window.__tab = (hide) => {
        hidden = hide;
        document.dispatchEvent(new Event('visibilitychange'));
        if (!hide) held.splice(0).forEach((f) => raf(f));
      };
    });
    await page.goto(ctx.srv.url + '/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
    const still = reducedMotion === 'reduce';
    // the still picture's wake count is sampled once the page has settled
    await page.waitForTimeout(still ? 1800 : 800);
    const rate = async (ms = 1000) => {
      const read = () => page.evaluate(() => [window.__loops, window.__frames]);
      const [l0, f0] = await read();
      await page.waitForTimeout(ms);
      const [l1, f1] = await read();
      return { loops: l1 - l0, frames: f1 - f0 };
    };
    const before = await rate(still ? 2000 : 1000);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.__tab(true));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__tab(false));
      await page.waitForTimeout(200);
    }
    const after = await rate();
    if (still) {
      assert.ok(before.loops >= 4 && before.loops <= 12, `reduced motion: the still picture woke ${before.loops} times in 2 seconds`);
      assert.ok(after.loops <= 6, `reduced motion: ${after.loops} wakes a second after the tab came back`);
    } else {
      assert.ok(before.loops > 20, `the constellation is not running (${before.loops} frames a second)`);
      assert.ok(after.loops > 20, `the constellation stopped after the tab came back (${after.loops} frames a second)`);
      for (const [when, r] of [['at load', before], ['after the tab came back', after]]) {
        assert.ok(r.loops / r.frames <= 1.05, `stacked loops ${when}: ${r.loops} calls over ${r.frames} frames`);
      }
    }
    await page.close();
  }
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

test('the name stays solid dark text while the constellation runs (no ink sweep)', async () => {
  // owner decision: the name is solid #1D1D1F with no gradient or shimmer;
  // the constellation no longer repaints it
  const { page } = await ctx.openPage();
  await page.waitForTimeout(3000);
  const read = () => page.$$eval('#hero .hero-name-line', (els) => els.map((el) => {
    const cs = getComputedStyle(el);
    return [cs.color, cs.webkitTextFillColor, cs.backgroundImage, cs.webkitBackgroundClip || cs.backgroundClip,
      el.parentElement.style.cssText].join(' | ');
  }));
  const a = await read();
  for (const v of a) assert.equal(v, 'rgb(29, 29, 31) | rgb(29, 29, 31) | none | border-box | ', `name not solid: ${v}`);
  await page.waitForTimeout(4000);
  assert.deepEqual(await read(), a, 'the name changed while the constellation ran');
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
      // every 16th pixel: the calm drift can park a sparser grid over only a
      // few faint lines for a whole second, which read like an empty canvas
      // (a real blank frame is 0 here; a drawn one is hundreds)
      let n = 0;
      for (let j = 3; j < d.length; j += 64) if (d[j] > 8) n++;
      if (n < 3) blanks++;
    }
    return blanks;
  });
  assert.equal(blanks, 0, `${blanks}/25 samples caught an empty canvas — blank-frame flicker`);
  await page.close();
});
