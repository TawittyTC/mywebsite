// No word breaks at its hyphen ("multi- / agent"), on the page or in any sheet,
// and nothing scrolls sideways. A break is read from the layout itself: for a
// "-" between two letters or digits, the character before it and the one after
// it must sit on the same line.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from './helpers.mjs';

let ctx;
before(async () => { ctx = await createContext(); });
after(async () => { await ctx.close(); });

const WIDTHS = [320, 390, 430, 768, 1440];

// Strings that may break at their hyphen, each with its reason. Matched against
// the whole whitespace-delimited token that holds the hyphen.
const ALLOWED = [
  {
    token: 'linkedin.com/in/tanapol-chamnanhan/',
    reason: 'a web address, not a word: kept breakable, or on a phone it would push past the screen',
  },
];
const allowed = ALLOWED.map((a) => a.token);

// runs in the page: each "-" between two letters/digits whose neighbours sit on different lines
function breaksIn({ sel, allowed }) {
  const root = sel ? document.querySelector(sel) : document.body;
  const LD = /[\p{L}\p{N}]/u;
  const r = document.createRange();
  const box = (n, i) => { r.setStart(n, i); r.setEnd(n, i + 1); return r.getClientRects()[0]; };
  const where = (el) => {
    const b = el.closest('[id], [class]:not(.nw)') || el;
    return b.tagName.toLowerCase() + (b.id ? '#' + b.id : '.' + [...b.classList].join('.'));
  };
  const breaks = [];
  let looked = 0;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.parentElement.closest('script, style, template, noscript, svg')) continue;
    const s = n.nodeValue;
    for (let i = s.indexOf('-', 1); i > 0 && i < s.length - 1; i = s.indexOf('-', i + 1)) {
      if (!LD.test(s[i - 1]) || !LD.test(s[i + 1])) continue;
      const a = box(n, i - 1), b = box(n, i + 1);
      if (!a || !b || !a.height) continue;   // not rendered (a folded section, a hidden tab)
      looked++;
      if (Math.abs(a.top - b.top) <= Math.max(2, a.height / 2)) continue;
      let x = i, y = i;
      while (x > 0 && !/\s/.test(s[x - 1])) x--;
      while (y < s.length - 1 && !/\s/.test(s[y + 1])) y++;
      const token = s.slice(x, y + 1);
      if (!allowed.includes(token)) breaks.push(`"${token}" in ${where(n.parentElement)}`);
    }
  }
  return { looked, breaks };
}

// runs in the page: compounds in these elements' text that sit in an element that may wrap
function looseCompounds(sel) {
  const out = [];
  document.querySelectorAll(sel).forEach((el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const m = n.nodeValue.match(/[^\W_]+(?:-[^\W_]+)+/g);
      if (m && getComputedStyle(n.parentElement).whiteSpace !== 'nowrap') out.push(...m);
    }
  });
  return out;
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function closeOverlay(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.exp-lightbox.open, .cert-lightbox.open') &&
    !(history.state && history.state.overlay), null, { timeout: 4000 });
}

async function measureAt(width) {
  const { page, errors } = await ctx.openPage({
    viewport: { width, height: width < 700 ? 844 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  await page.evaluate(async () => {
    document.querySelectorAll('.faq details').forEach((d) => { d.open = true; });
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    scrollTo(0, 0);
  });
  await settle(page);
  const breaks = [], wide = [], loose = [];
  const pg = await page.evaluate(breaksIn, { sel: null, allowed });
  let looked = pg.looked;
  breaks.push(...pg.breaks.map((b) => `${width}px page: ${b}`));
  const doc = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  if (doc[0] !== doc[1]) wide.push(`${width}px page: scrollWidth ${doc[0]} in a ${doc[1]}px viewport`);

  // each experience sheet from its card, one project sheet per template, the See-all list
  const openers = await page.evaluate(() => {
    const out = [...document.querySelectorAll('#experience .data-box[data-exp]')]
      .map((c) => `#experience .data-box[data-exp="${c.dataset.exp}"]`);
    const seen = new Set();
    document.querySelectorAll('#scroller > .rf-cards-scroller-item[data-open-exp]').forEach((c) => {
      if (seen.has(c.dataset.openExp)) return;
      seen.add(c.dataset.openExp);
      out.push(`#scroller > [data-open-exp="${c.dataset.openExp}"]` + (c.dataset.client ? `[data-client="${c.dataset.client}"]` : ''));
    });
    return out.concat('[data-proj-all]');
  });
  for (const sel of openers) {
    await page.$eval(sel, (el) => el.click());
    await page.waitForSelector('.exp-lightbox.open .exp-lightbox-inner > div');
    // on a phone each client story is folded to its name: open them all
    await page.evaluate(() => document.querySelectorAll('.exp-lightbox-inner .exp-clients-folded .exp-client-section:not(.is-open) .exp-client-section-header').forEach((h) => h.click()));
    await settle(page);
    const r = await page.evaluate(breaksIn, { sel: '.exp-lightbox-inner', allowed });
    const s = await page.$eval('.exp-lightbox-inner', (el) => ({
      sw: el.scrollWidth, cw: el.clientWidth, title: (el.querySelector('.exp-modal-title') || el).textContent.slice(0, 80).replace(/\s+/g, ' ').trim(),
    }));
    const name = sel === '[data-proj-all]' ? 'See-all list' : `sheet "${s.title}"`;
    looked += r.looked;
    breaks.push(...r.breaks.map((b) => `${width}px ${name}: ${b}`));
    if (s.sw > s.cw) wide.push(`${width}px ${name}: scrollWidth ${s.sw} > clientWidth ${s.cw}`);
    if (sel === '[data-proj-all]') {
      loose.push(...(await page.evaluate(looseCompounds, '.exp-lightbox-inner .proj-name, .exp-lightbox-inner .proj-group h3'))
        .map((c) => `${width}px See-all list: "${c}"`));
    }
    await closeOverlay(page);
  }

  // the screenshot viewer names its card in a caption
  const shots = await page.$$eval('#scroller > .rf-cards-scroller-item:not([data-open-exp])', (els) => els.length);
  for (let i = 0; i < shots; i++) {
    await page.evaluate((i) => document.querySelectorAll('#scroller > .rf-cards-scroller-item:not([data-open-exp])')[i].click(), i);
    await page.waitForSelector('.cert-lightbox.open');
    await settle(page);
    const r = await page.evaluate(breaksIn, { sel: '.cert-lightbox-caption', allowed });
    breaks.push(...r.breaks.map((b) => `${width}px viewer caption: ${b}`));
    loose.push(...(await page.evaluate(looseCompounds, '.cert-lightbox-caption')).map((c) => `${width}px viewer caption: "${c}"`));
    await closeOverlay(page);
  }
  await page.close();
  return { width, looked, breaks, wide, loose, errors };
}

test('no word breaks at its hyphen and nothing scrolls sideways, on the page and in every sheet', async () => {
  const runs = await Promise.all(WIDTHS.map(measureAt));
  // the page and its templates hold about 240 such hyphens, and the opened sheets show
  // each template at least once: far fewer measured means a sheet did not open
  for (const r of runs) assert.ok(r.looked >= 240, `${r.width}px: only ${r.looked} hyphens were measured`);
  assert.deepEqual(runs.flatMap((r) => r.wide), [], 'something is wider than the screen or its sheet');
  const breaks = runs.flatMap((r) => r.breaks);
  assert.deepEqual(breaks, [], `${breaks.length} words break at their hyphen`);
  assert.deepEqual(runs.flatMap((r) => r.loose), [], 'a name copied from a card can break at its hyphen');
  assert.deepEqual(runs.flatMap((r) => r.errors), []);
});

test('on a touch phone the caption that asks to swipe keeps the card name\'s compound together', async () => {
  const { page } = await ctx.openPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  const card = await page.evaluateHandle(() => [...document.querySelectorAll('#scroller > .rf-cards-scroller-item:not([data-open-exp])')]
    .find((c) => /\w-\w/.test(c.querySelector('h3').textContent)));
  assert.ok(await card.evaluate((c) => !!c), 'expected a screenshot card with a hyphenated name');
  await card.evaluate((c) => c.click());
  await page.waitForSelector('.cert-lightbox.open.lb-pan');
  const caption = await page.$eval('.cert-lightbox-caption', (el) => el.textContent);
  assert.match(caption, /Swipe to see the whole screen/);
  assert.deepEqual(await page.evaluate(looseCompounds, '.cert-lightbox-caption'), [], `the caption "${caption}" can break at a hyphen`);
  await page.close();
});
