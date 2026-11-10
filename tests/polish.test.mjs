// The v2.64 fixes: small defects a visitor could see or feel. Each test
// reproduces the defect's own symptom, so it fails if the defect returns.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, ROOT } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

test('the typed role line says "an" before a vowel and "a" before a consonant', async () => {
  const { page } = await ctx.openPage();
  const seen = { vowel: false, consonant: false };
  const wrong = [];
  for (let i = 0; i < 220 && !(seen.vowel && seen.consonant); i++) {
    const line = (await page.$eval('#hero .hero-role', (el) => el.textContent)).replace(/\s+/g, ' ').trim();
    const m = line.match(/^I'm (an?) (\S.*)$/);
    if (m) {
      const vowel = /^[aeiou]/i.test(m[2]);
      if ((m[1] === 'an') !== vowel) wrong.push(line);
      if (m[2].length > 3) seen[vowel ? 'vowel' : 'consonant'] = true;
    }
    await page.waitForTimeout(100);
  }
  assert.deepEqual(wrong, [], `wrong article in the typed line: ${wrong.join(' | ')}`);
  assert.ok(seen.vowel && seen.consonant, 'expected to see a role that starts with a vowel and one that does not');

  // a formatter may wrap the line: the text before the typed word then ends in a newline and
  // indentation, and the swap must still find the article and keep that whitespace
  const pad = '\n      ';
  await page.$eval('#hero .typed', (el, tail) => { el.previousSibling.nodeValue = "I'm a" + tail; }, pad);
  // the article changes when a role starts: let the word on screen finish and be cleared
  await page.waitForFunction(() => document.querySelector('#hero .typed').textContent === '', null, { timeout: 20000 });
  await page.waitForTimeout(300);
  const again = { vowel: false, consonant: false };
  for (let i = 0; i < 260 && !(again.vowel && again.consonant); i++) {
    const st = await page.$eval('#hero .typed', (el) => ({ lead: el.previousSibling.nodeValue, word: el.textContent }));
    if (st.word.length > 3) {
      const vowel = /^[aeiou]/i.test(st.word);
      assert.equal(st.lead, (vowel ? "I'm an" : "I'm a") + pad, `after a reformat the line reads ${JSON.stringify(st.lead + st.word)}`);
      again[vowel ? 'vowel' : 'consonant'] = true;
    }
    await page.waitForTimeout(100);
  }
  assert.ok(again.vowel && again.consonant, 'expected both kinds of role again after the reformat');
  await page.close();
});

test('an Experience card enters once, without blinking, and lifts under the pointer', async () => {
  const { page } = await ctx.openPage();
  // scroll the first card in at a steady pace and read its opacity every frame
  const opacities = await page.evaluate(async () => {
    const card = document.querySelector('#experience .data-box[data-exp]');
    const top = card.getBoundingClientRect().top + scrollY;
    const out = [];
    let y = top - innerHeight - 200;
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 400));
    await new Promise((done) => {
      (function step() {
        y += 14; scrollTo(0, y);
        out.push(+getComputedStyle(card).opacity);
        if (y < top - innerHeight * 0.3) requestAnimationFrame(step); else done();
      })();
    });
    const t0 = performance.now();
    await new Promise((done) => {
      (function rest() {
        out.push(+getComputedStyle(card).opacity);
        if (performance.now() - t0 < 900) requestAnimationFrame(rest); else done();
      })();
    });
    return out;
  });
  let drop = 0;
  for (let i = 1; i < opacities.length; i++) drop = Math.max(drop, opacities[i - 1] - opacities[i]);
  assert.ok(Math.max(...opacities) > 0.5, 'the card never became visible while it was scrolled in');
  assert.ok(drop < 0.1, `the card's opacity fell by ${drop.toFixed(2)} in one frame while entering (a second entrance restarting it)`);
  assert.equal(opacities.at(-1), 1, 'the card should rest fully opaque');
  assert.doesNotMatch(html, /card-enter/, 'the keyframe entrance must not come back beside the scroll scrub');

  // the lift: same values as a Projects card
  const card = page.locator('#experience .data-box[data-exp]').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await card.hover({ position: { x: 300, y: 60 } });
  await page.waitForTimeout(600);
  const lifted = await card.evaluate((el) => ({ t: getComputedStyle(el).transform, s: getComputedStyle(el).boxShadow }));
  assert.match(lifted.t, /^matrix\(1\.01, 0, 0, 1\.01/, `the card should scale to 1.01 under the pointer, got ${lifted.t}`);
  assert.notEqual(lifted.s, 'none', 'the lifted card should carry its shadow');
  await page.close();
});

test('on a touch screen a tapped Experience card does not stay raised', async () => {
  const sel = '#experience .data-box[data-exp]';
  // Touch browsers leave :hover on the last tapped element. The emulation does not, so the state
  // is forced; the pointer run shows that the forced state does lift the card where it should.
  const hovered = async (page) => {
    await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(900);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
    await page.waitForTimeout(600);
    return page.$eval(sel, (el) => ({
      t: getComputedStyle(el).transform, fine: matchMedia('(hover: hover) and (pointer: fine)').matches,
    }));
  };
  const flat = (t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';

  const pointer = await ctx.openPage();
  const lifted = await hovered(pointer.page);
  assert.ok(lifted.fine && !flat(lifted.t), `with a pointer the hovered card should lift, got ${lifted.t}`);
  await pointer.page.close();

  const { page } = await ctx.openPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const stuck = await hovered(page);
  assert.equal(stuck.fine, false, 'the phone run must not count as a fine pointer');
  assert.ok(flat(stuck.t), `on touch a card left in :hover is transformed: ${stuck.t}`);
  // and a real tap opens the sheet and leaves the card flat
  await page.tap(`${sel} h3`);
  await page.waitForSelector('.exp-lightbox.open');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  await page.waitForTimeout(500);
  const t = await page.$eval(sel, (el) => getComputedStyle(el).transform);
  assert.ok(flat(t), `the card is left transformed after a tap: ${t}`);
  await page.close();
});

test('every client logo in the Protollcall sheet is one of the site\'s own files, loads, and sits above its client\'s name', async () => {
  assert.doesNotMatch(html, /logo\.clearbit\.com/, 'the retired Clearbit logo service must not be linked');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const { page, failed } = await ctx.openPage({ viewport, reducedMotion: 'reduce' });
    await page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
    await page.waitForSelector('.exp-lightbox.open');
    const rows = await page.$$eval('.exp-lightbox .exp-client-section-header', async (heads) => {
      const out = [];
      for (const head of heads) {
        const im = head.querySelector('img');
        if (!im) continue;
        im.loading = 'eager';
        try { await im.decode(); } catch (e) { /* reported below */ }
        const name = head.querySelector('h3').getBoundingClientRect();
        const tag = head.querySelector('.exp-client-tag').getBoundingClientRect();
        const box = im.getBoundingClientRect();
        // what the row would be without its logo: does the tag still share the name's row?
        im.style.display = 'none';
        const bare = head.querySelector('.exp-client-tag').getBoundingClientRect().top < head.querySelector('h3').getBoundingClientRect().bottom;
        im.style.display = '';
        out.push({
          client: head.closest('.exp-client-section').dataset.client, src: im.getAttribute('src'),
          attrs: [im.getAttribute('width'), im.getAttribute('height')], natural: im.naturalWidth,
          h: box.height, w: im.naturalHeight ? box.height * im.naturalWidth / im.naturalHeight : 0,
          above: box.bottom <= name.top + 0.5, nameAtEdge: Math.abs(name.left - box.left) < 1,
          tagBesideName: tag.top < name.bottom, tagBesideNameWithoutLogo: bare,
          blend: getComputedStyle(im).mixBlendMode,
          // the img box is the whole row: these two put the picture, unstretched, at its left end
          fit: getComputedStyle(im).objectFit, at: getComputedStyle(im).objectPosition,
          shape: (+im.getAttribute('width') / +im.getAttribute('height')) / (im.naturalWidth / im.naturalHeight),
          taps: getComputedStyle(im).pointerEvents,
        });
      }
      return out;
    });
    assert.equal(rows.length, 22, 'expected the 22 client logos');
    for (const l of rows) {
      const at = `${l.client} at ${viewport.width}px`;
      assert.match(l.src, /^assets\/img\/clients\/[\w-]+\.webp$/, `logo is not a local file: ${l.src}`);
      assert.ok(existsSync(join(ROOT, l.src)), `logo file missing: ${l.src}`);
      assert.ok(l.natural > 0, `logo did not load: ${l.src}`);
      assert.ok(l.attrs.every((v) => /^\d+$/.test(v)), `${at}: width and height must be whole numbers, got ${l.attrs}`);
      assert.ok(l.h > 0 && l.h <= 24 && l.w <= 81, `${at}: the logo is drawn ${l.w.toFixed(1)}x${l.h}, outside 80x24`);
      assert.ok(l.above && l.nameAtEdge, `${at}: the logo must sit on its own row above the name, on the same left edge`);
      assert.equal(l.fit, 'contain', `${at}: the logo would be stretched across its row`);
      assert.equal(l.at, '0% 50%', `${at}: the logo must be drawn at the left end of its row, not ${l.at}`);
      assert.ok(Math.abs(l.shape - 1) < 0.04, `${at}: the size attributes give the logo the wrong shape (${l.shape.toFixed(3)} of the file's)`);
      assert.equal(l.taps, 'none', `${at}: the blank part of the logo's row must not act as the picture`);
      assert.equal(l.tagBesideName, l.tagBesideNameWithoutLogo, `${at}: the logo moved the tag off (or onto) the name's row`);
    }
    // two files carry a white ground of their own; on the grey card it must not show as a box
    for (const c of ['kijsiri', 'mediviss']) {
      assert.equal(rows.find((l) => l.client === c).blend, 'multiply', `${c}: the logo's white ground shows on the grey card`);
    }
    assert.deepEqual(failed, [], 'no request may fail while the sheet is open');
    await page.close();
  }

  // on a dark forced-colours canvas a multiplied picture is all black: the blend is switched off
  const dark = await ctx.openPage({ forcedColors: 'active', colorScheme: 'dark', reducedMotion: 'reduce' });
  await dark.page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
  await dark.page.waitForSelector('.exp-lightbox.open');
  const blends = await dark.page.$$eval('.exp-lightbox .exp-client-section-header img', (imgs) => ({
    forced: matchMedia('(forced-colors: active)').matches, modes: [...new Set(imgs.map((im) => getComputedStyle(im).mixBlendMode))],
  }));
  assert.ok(blends.forced, 'this run should be in forced colours');
  assert.deepEqual(blends.modes, ['normal'], 'in forced colours no sheet logo may be blended into the card');
  await dark.page.close();
});

test('the self-hosted fonts draw weight 700, not 600 again', async () => {
  const css = readFileSync(join(ROOT, 'assets/fonts/fonts.css'), 'utf8');
  for (const [name, text] of [['index.html', html], ['fonts.css', css]]) {
    assert.equal((text.match(/font-weight: 400 700;/g) || []).length, 3, `${name}: all three @font-face rules must reach 700`);
    assert.doesNotMatch(text, /font-weight: 400 600;/, `${name}: a 400-600 range draws every 700 headline at 600`);
  }
  const { page } = await ctx.openPage();
  const w = await page.evaluate(async () => {
    const thai = 'บริการ';
    await Promise.all([
      document.fonts.load('600 92px Inter'), document.fonts.load('700 92px Inter'),
      document.fonts.load('600 56px "Noto Sans Thai"', thai), document.fonts.load('700 56px "Noto Sans Thai"', thai),
    ]);
    const width = (font, text) => {
      const s = document.createElement('span');
      s.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;letter-spacing:0;font:' + font;
      s.textContent = text;
      document.body.appendChild(s);
      const v = s.getBoundingClientRect().width;
      s.remove();
      return v;
    };
    return {
      latin600: width('600 92px Inter', 'Tanapol Chamnanhan'), latin700: width('700 92px Inter', 'Tanapol Chamnanhan'),
      thai600: width('600 56px "Noto Sans Thai"', thai), thai700: width('700 56px "Noto Sans Thai"', thai),
    };
  });
  assert.ok(w.latin700 > w.latin600 + 2, `Inter 700 is drawn like 600 (${w.latin700} vs ${w.latin600})`);
  assert.ok(w.thai700 > w.thai600 + 2, `Noto Sans Thai 700 is drawn like 600 (${w.thai700} vs ${w.thai600})`);
  await page.close();
});

test('the certificate grid draws small copies; the viewer opens at full size and settles on the original', async () => {
  for (let i = 1; i <= 33; i++) {
    assert.ok(existsSync(join(ROOT, `assets/img/certificate/thumb/img-${i}.avif`)), `small copy of certificate ${i} is missing`);
  }
  // (no service worker here: it would answer the original from its cache and skip the delay below)
  const { page, failed } = await ctx.openPage({ serviceWorkers: 'block' });
  await page.$eval('#images-list', (el) => el.scrollIntoView());
  const tiles = await page.$$eval('#images-list .cert-card img', async (imgs) => {
    for (const im of imgs) { im.loading = 'eager'; try { await im.decode(); } catch (e) { /* reported below */ } }
    return imgs.map((im) => ({
      src: im.getAttribute('src'), w: im.naturalWidth, h: im.naturalHeight,
      fw: +im.getAttribute('data-full-w'), fh: +im.getAttribute('data-full-h'),
    }));
  });
  assert.equal(tiles.length, 33);
  tiles.forEach((t, i) => {
    assert.equal(t.src, `assets/img/certificate/thumb/img-${i + 1}.avif`, 'the grid must draw the small copy');
    assert.ok(t.w > 0 && t.w <= 840 && t.h <= 630, `small copy ${i + 1} is ${t.w}x${t.h}; it must fit 840x630`);
    assert.ok(t.fw > 0 && t.fh > 0, `certificate ${i + 1} does not name its original's size`);
    assert.ok(Math.abs(t.w / t.h - t.fw / t.fh) < 0.01, `small copy ${i + 1} has a different shape from its original`);
  });

  // hold the 9333x6600 original back so the stand-in can be seen
  await page.route('**/assets/img/certificate/img-13.avif', async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  const read = () => page.$eval('.cert-lightbox img', (im) => ({
    src: im.getAttribute('src'), w: im.offsetWidth, h: im.offsetHeight, natural: im.naturalWidth,
  }));
  for (const idx of [12, 0]) {
    await page.$$eval('#images-list .cert-card', (cards, i) => {
      cards[i].scrollIntoView({ block: 'center' });
      cards[i].click();
    }, idx);
    await page.waitForSelector('.cert-lightbox.open');
    const opened = await read();
    if (idx === 12) {
      assert.match(opened.src, /certificate\/thumb\/img-13\.avif$/, 'the viewer should open on the tile\'s copy while the original is on its way');
    }
    // a certificate has no caption, so its frame is the full 92vw by 92vh
    const t = tiles[idx];
    const fit = Math.min(1, 1440 * 0.92 / t.fw, 900 * 0.92 / t.fh);
    assert.ok(Math.abs(opened.w - t.fw * fit) <= 1 && Math.abs(opened.h - t.fh * fit) <= 1,
      `certificate ${idx + 1} opened at ${opened.w}x${opened.h}, expected ${(t.fw * fit).toFixed(0)}x${(t.fh * fit).toFixed(0)}`);
    await page.waitForFunction((n) => {
      const im = document.querySelector('.cert-lightbox img');
      return im.getAttribute('src') === `assets/img/certificate/img-${n}.avif` && im.complete && im.naturalWidth > 0;
    }, idx + 1);
    const settled = await read();
    assert.equal(settled.natural, t.fw, `the viewer should end on the original (${t.fw}px wide), got ${settled.natural}px`);
    assert.ok(Math.abs(settled.w - opened.w) <= 1 && Math.abs(settled.h - opened.h) <= 1,
      `the picture changed size when the original arrived: ${opened.w}x${opened.h} -> ${settled.w}x${settled.h}`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));
  }
  assert.deepEqual(failed, [], 'no certificate request may fail');
  await page.close();
});

test('a focused control keeps its own shape, and one without a shape gets the 6px corner', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.keyboard.press('Tab');   // keyboard modality: focus() then shows the ring
  // A sheet and the viewer put focus on their close button as they open, so the resting shape
  // is read after a blur; the focused one a frame or two after focus (a transition, however
  // short, would otherwise still report the resting value).
  const probe = (sel) => page.$eval(sel, async (el) => {
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    el.scrollIntoView({ block: 'center' });
    el.blur();
    await frames();
    const rest = getComputedStyle(el).borderRadius;
    el.focus({ preventScroll: true });
    await frames();
    return { rest, focused: getComputedStyle(el).borderRadius, ring: el.matches(':focus-visible'), outline: getComputedStyle(el).outlineStyle };
  });
  // [selector, the ring's corner]: null = the control's own resting radius, which must not be 0
  const check = async (controls, where) => {
    for (const [sel, want] of controls) {
      const r = await probe(sel);
      assert.ok(r.ring, `${where} ${sel} should show its focus ring when focused from the keyboard`);
      assert.notEqual(r.outline, 'none', `${where} ${sel} lost its focus ring`);
      if (want === null) {
        assert.notEqual(r.rest, '0px', `${where} ${sel} was expected to have a shape of its own`);
        assert.equal(r.focused, r.rest, `${where} ${sel} changes shape while focused (${r.rest} -> ${r.focused})`);
      } else {
        assert.equal(r.focused, want, `${where} ${sel}: the focus ring's corner is ${r.focused}, expected ${want}`);
      }
    }
  };
  await check([
    ['#portfolio [data-scroller-next]', null], ['.filter-btn', null], ['#images-list .cert-expand-btn', null],
    ['#back-to-top', null], ['a.btn-pill', null], ['.skip-link', null],
    // these draw no box of their own; the round "+" is drawn by an inner element
    ['#experience .exp-card-cta', '50%'], ['button.more.proj-all', '6px'], ['a.more', '6px'], ['.footer-contact-link', '6px'],
    // neither a link nor a button: the Skills row is a scroll region the keyboard can stop on
    ['#skill-scroller', '6px'],
  ], 'page:');

  // the certificate viewer's round close button, where focus lands when it opens
  await page.$eval('#images-list .cert-expand-btn', (el) => el.click());
  await page.waitForSelector('.cert-lightbox.open');
  await check([['.cert-lightbox.open .cert-lightbox-close', null]], 'viewer:');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.cert-lightbox.open'));

  await page.$eval('#experience [data-exp="protollcall"] .exp-card-cta', (el) => el.click());
  await page.waitForSelector('.exp-lightbox.open');
  await check([['.exp-lightbox.open .exp-lightbox-close', null], ['.exp-lightbox.open .exp-filter-chip', null]], 'sheet:');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));

  // the See-all list, then a project opened from it with Enter: focus lands on the "All projects" pill
  await page.$eval('[data-proj-all]', (el) => el.click());
  await page.waitForSelector('.proj-row');
  await check([['.proj-row', '6px']], 'See-all list:');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.proj-back');
  const pill = await page.$eval('.proj-back', (el) => {
    const focused = getComputedStyle(el).borderRadius, ring = el.matches(':focus-visible');
    el.blur();
    return { focused, ring, rest: getComputedStyle(el).borderRadius };
  });
  assert.ok(pill.ring, 'the "All projects" pill should hold keyboard focus when a row is opened with Enter');
  assert.notEqual(pill.rest, '0px');
  assert.equal(pill.focused, pill.rest, `the "All projects" pill changes shape while focused (${pill.rest} -> ${pill.focused})`);
  await page.close();
});

test('Resume sub-headings sit on the stylesheet\'s own margins', async () => {
  assert.doesNotMatch(html, /class="resume-title mt-5"/, 'mt-5 overrides the section\'s own heading margins');
  for (const [width, expected] of [[1440, ['0px', '72px', '72px']], [390, ['0px', '56px', '56px']]]) {
    const { page } = await ctx.openPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const r = await page.evaluate(() => {
      const gap = (sec, first) => Math.round(document.querySelector(`${sec} ${first}`).getBoundingClientRect().top -
        document.querySelector(`${sec} .section-title`).getBoundingClientRect().bottom);
      return {
        margins: [...document.querySelectorAll('#resume .resume-title')].map((h) => getComputedStyle(h).marginTop),
        resume: gap('#resume', '.resume-title'), experience: gap('#experience', '.data-box'),
      };
    });
    assert.deepEqual(r.margins, expected, `heading margins at ${width}px`);
    assert.ok(Math.abs(r.resume - r.experience) <= 1,
      `at ${width}px "Profile" starts ${r.resume}px under its section header, the first Experience card ${r.experience}px`);
    await page.close();
  }
});

test('the hero chevron is a working link; no node, line or label is drawn through it and the label seeded on it stays readable', async () => {
  // 993 and 1024 are the compact layout, where a labelled node ("POS") is seeded on the chevron's spot
  for (const [width, height] of [[993, 700], [1024, 768], [1440, 900]]) {
    const { page } = await ctx.openPage({ viewport: { width, height } });
    await page.waitForTimeout(3000);   // the intro burst is over, the keep-out is in force
    const box = await page.$eval('.hero-scroll-hint', (el) => {
      const r = el.querySelector('svg').getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return {
        tag: el.tagName, href: el.getAttribute('href'), reaches: el.contains(hit), w: b.width, h: b.height,
        x: r.left, y: r.top, sw: r.width, sh: r.height,
      };
    });
    assert.equal(box.tag, 'A');
    assert.equal(box.href, '#resume');
    assert.ok(box.reaches, 'a click on the chevron must reach the link');
    assert.ok(box.w >= 44 && box.h >= 44, `the chevron's hit area is ${box.w}x${box.h}, under 44px`);

    // 40 looks: no ink under the chevron (its own 22px box plus the 10px bounce), no label on
    // its hit area, and the label seeded nearest to it never fades
    let inked = 0, covered = 0, posLow = 1, labels = 0;
    for (let i = 0; i < 40; i++) {
      const look = await page.evaluate(({ x, y, sw, sh }) => {
        const c = document.querySelector('#hero-net');
        const cr = c.getBoundingClientRect();
        const k = c.width / cr.width;
        const d = c.getContext('2d').getImageData(Math.floor((x - cr.left) * k), Math.floor((y - 10 - cr.top) * k),
          Math.ceil(sw * k), Math.ceil((sh + 20) * k)).data;
        let n = 0;
        for (let p = 3; p < d.length; p += 4) if (d[p] > 8) n++;
        const hint = document.querySelector('.hero-scroll-hint').getBoundingClientRect();
        let on = 0, pos = 1, count = 0;
        document.querySelectorAll('.hero-net-label').forEach((l) => {
          const op = +getComputedStyle(l).opacity, r = l.getBoundingClientRect();
          count++;
          if (l.textContent === 'POS') pos = op;
          if (op > 0.05 && r.right > hint.left && r.left < hint.right && r.bottom > hint.top && r.top < hint.bottom) on++;
        });
        return { ink: n > 0 ? 1 : 0, on, pos, count };
      }, box);
      inked += look.ink; covered += look.on; posLow = Math.min(posLow, look.pos); labels = look.count;
      await page.waitForTimeout(120);
    }
    assert.equal(labels, 6, 'the constellation names six systems');
    assert.equal(inked, 0, `at ${width}px the constellation was drawn through the chevron in ${inked} of 40 looks`);
    assert.equal(covered, 0, `at ${width}px a label sat on the chevron in ${covered} of 40 looks`);
    assert.ok(posLow >= 0.9, `at ${width}px the "POS" label faded to ${posLow.toFixed(2)}; it must stay readable, clear of the chevron`);

    // and it takes the visitor to the next section
    await page.mouse.click(box.x + box.sw / 2, box.y + box.sh / 2);
    await page.waitForTimeout(1100);
    const at = await page.evaluate(() => ({ y: scrollY, resume: document.getElementById('resume').getBoundingClientRect().top + scrollY }));
    assert.ok(Math.abs(at.y - (at.resume - 60)) <= 2, `the chevron should scroll to Resume (${at.resume - 60}), stopped at ${at.y}`);
    await page.close();
  }
});

test('after a resize that makes the chevron appear or move, no label sits on it and "POS" stays readable', async () => {
  // one resize per load: the chevron appears at 993px; the hero's height settles after its width
  for (const [from, to] of [[[992, 700], [993, 700]], [[900, 800], [1024, 800]], [[1024, 1366], [1000, 1220]], [[1024, 768], [1000, 600]]]) {
    const { page, errors } = await ctx.openPage({ viewport: { width: from[0], height: from[1] } });
    await page.waitForTimeout(2500);
    await page.setViewportSize({ width: to[0], height: to[1] });
    await page.waitForTimeout(1500);
    let inked = 0, covered = 0, posLow = 1;
    for (let i = 0; i < 25; i++) {
      const look = await page.evaluate(() => {
        const el = document.querySelector('.hero-scroll-hint');
        const hint = el.getBoundingClientRect(), g = el.querySelector('svg').getBoundingClientRect();
        const c = document.querySelector('#hero-net'), cr = c.getBoundingClientRect(), k = c.width / cr.width;
        const d = c.getContext('2d').getImageData(Math.floor((g.left - cr.left) * k), Math.floor((g.top - 10 - cr.top) * k),
          Math.ceil(g.width * k), Math.ceil((g.height + 20) * k)).data;
        let n = 0;
        for (let p = 3; p < d.length; p += 4) if (d[p] > 8) n++;
        let on = 0, pos = 1;
        document.querySelectorAll('.hero-net-label').forEach((l) => {
          const op = +getComputedStyle(l).opacity, r = l.getBoundingClientRect();
          if (l.textContent === 'POS') pos = op;
          if (op > 0.05 && r.right > hint.left && r.left < hint.right && r.bottom > hint.top && r.top < hint.bottom) on++;
        });
        return { shown: hint.width > 0, ink: n > 0 ? 1 : 0, on, pos };
      });
      assert.ok(look.shown, `the chevron should be on screen at ${to[0]}px`);
      inked += look.ink; covered += look.on; posLow = Math.min(posLow, look.pos);
      await page.waitForTimeout(120);
    }
    const step = `${from.join('x')} -> ${to.join('x')}`;
    assert.equal(inked, 0, `${step}: the constellation was drawn through the chevron in ${inked} of 25 looks`);
    assert.equal(covered, 0, `${step}: a label sat on the chevron in ${covered} of 25 looks`);
    assert.ok(posLow >= 0.9, `${step}: the "POS" label faded to ${posLow.toFixed(2)}`);
    assert.deepEqual(errors, [], `${step}: script errors`);
    await page.close();
  }
});

test('in a short window the copy grid does not cover the chevron link', async () => {
  for (const [width, height] of [[1280, 500], [993, 440]]) {
    const { page } = await ctx.openPage({ viewport: { width, height } });
    const reach = await page.$eval('.hero-scroll-hint', (el) => {
      const b = el.getBoundingClientRect();
      return [[0.5, 0.5], [0.5, 0.2], [0.5, 0.8], [0.2, 0.5], [0.8, 0.5]]
        .filter(([fx, fy]) => el.contains(document.elementFromPoint(b.left + b.width * fx, b.top + b.height * fy))).length;
    });
    assert.equal(reach, 5, `at ${width}x${height} only ${reach} of 5 points on the chevron reach the link`);
    await page.close();
  }
});

test('with reduced motion the chevron takes the visitor to Resume without a glide', async () => {
  const { page } = await ctx.openPage({ reducedMotion: 'reduce' });
  await page.$eval('.hero-scroll-hint', (el) => el.click());
  const at = await page.evaluate(() => ({ y: scrollY, resume: document.getElementById('resume').getBoundingClientRect().top + scrollY }));
  assert.ok(Math.abs(at.y - (at.resume - 60)) <= 2, `expected an immediate move to ${at.resume - 60}, at ${at.y}`);
  await page.close();
});
