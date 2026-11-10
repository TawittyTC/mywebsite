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
  const { page } = await ctx.openPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const sel = '#experience .data-box[data-exp]';
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  await page.tap(`${sel} h3`);
  await page.waitForSelector('.exp-lightbox.open');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open'));
  await page.waitForTimeout(500);
  const t = await page.$eval(sel, (el) => getComputedStyle(el).transform);
  assert.ok(t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)', `the card is left transformed after a tap: ${t}`);
  await page.close();
});

test('every client logo in the Protollcall sheet is one of the site\'s own files and loads', async () => {
  assert.doesNotMatch(html, /logo\.clearbit\.com/, 'the retired Clearbit logo service must not be linked');
  const { page, failed } = await ctx.openPage();
  await page.$eval('#experience [data-exp="protollcall"]', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);
  await page.click('#experience [data-exp="protollcall"] .exp-card-btn');
  await page.waitForSelector('.exp-lightbox.open');
  const logos = await page.$$eval('.exp-lightbox .exp-client-section-header img', async (imgs) => {
    for (const im of imgs) { im.loading = 'eager'; try { await im.decode(); } catch (e) { /* reported below */ } }
    return imgs.map((im) => ({ src: im.getAttribute('src'), natural: im.naturalWidth, h: im.offsetHeight, w: im.offsetWidth }));
  });
  assert.equal(logos.length, 22, 'expected the 22 client logos');
  for (const l of logos) {
    assert.match(l.src, /^assets\/img\/clients\/[\w-]+\.webp$/, `logo is not a local file: ${l.src}`);
    assert.ok(existsSync(join(ROOT, l.src)), `logo file missing: ${l.src}`);
    assert.ok(l.natural > 0, `logo did not load: ${l.src}`);
    assert.ok(l.h > 0 && l.h <= 24 && l.w <= 80, `logo ${l.src} is drawn ${l.w}x${l.h}, outside the 80x24 heading slot`);
  }
  assert.deepEqual(failed, [], 'no request may fail while the sheet is open');
  await page.close();
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
  const { page, failed } = await ctx.openPage();
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

test('round controls stay round while they hold focus', async () => {
  const { page } = await ctx.openPage();
  for (const sel of ['#portfolio [data-scroller-next]', '.filter-btn', '#portfolio .card-plus', '#images-list .cert-expand-btn']) {
    const r = await page.$eval(sel, (el) => {
      el.scrollIntoView({ block: 'center' });
      const rest = getComputedStyle(el).borderRadius;
      el.focus({ preventScroll: true });
      return { rest, focused: getComputedStyle(el).borderRadius, ring: el.matches(':focus-visible'), outline: getComputedStyle(el).outlineStyle };
    });
    assert.ok(r.ring, `${sel} should show its focus ring when focused from the keyboard`);
    assert.notEqual(r.outline, 'none', `${sel} lost its focus ring`);
    assert.equal(r.focused, r.rest, `${sel} changes shape while focused (${r.rest} -> ${r.focused})`);
  }
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

test('the hero chevron is a working link and the constellation never draws through it', async () => {
  for (const [width, height] of [[1024, 768], [1440, 900]]) {
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

    // no ink under the chevron (its own 22px box plus the 10px bounce) across 40 looks
    let inked = 0;
    for (let i = 0; i < 40; i++) {
      inked += await page.evaluate(({ x, y, sw, sh }) => {
        const c = document.querySelector('#hero-net');
        const cr = c.getBoundingClientRect();
        const k = c.width / cr.width;
        const d = c.getContext('2d').getImageData(Math.floor((x - cr.left) * k), Math.floor((y - 10 - cr.top) * k),
          Math.ceil(sw * k), Math.ceil((sh + 20) * k)).data;
        let n = 0;
        for (let p = 3; p < d.length; p += 4) if (d[p] > 8) n++;
        return n > 0 ? 1 : 0;
      }, box);
      await page.waitForTimeout(120);
    }
    assert.equal(inked, 0, `at ${width}px the constellation was drawn through the chevron in ${inked} of 40 looks`);

    // and it takes the visitor to the next section
    await page.mouse.click(box.x + box.sw / 2, box.y + box.sh / 2);
    await page.waitForTimeout(1100);
    const at = await page.evaluate(() => ({ y: scrollY, resume: document.getElementById('resume').getBoundingClientRect().top + scrollY }));
    assert.ok(Math.abs(at.y - (at.resume - 60)) <= 2, `the chevron should scroll to Resume (${at.resume - 60}), stopped at ${at.y}`);
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
