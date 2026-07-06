// Static integrity — no browser needed. Guards the mistakes that are
// easy to make while editing: broken metadata, stale service-worker
// versions, missing alt text, bloated assets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

test('every JSON-LD block parses and declares a type', () => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length >= 1, 'expected JSON-LD structured data');
  for (const [, body] of blocks) {
    const data = JSON.parse(body); // throws on corruption
    assert.ok(data['@context'] || data['@type'], 'JSON-LD block missing @context/@type');
  }
});

test('every internal anchor points at an existing id', () => {
  const anchors = [...html.matchAll(/href="#([a-zA-Z][\w-]*)"/g)].map((m) => m[1]);
  const missing = [...new Set(anchors)].filter((id) => !new RegExp(`id="${id}"`).test(html));
  assert.deepEqual(missing, [], `anchors without targets: ${missing.join(', ')}`);
});

test('essential metadata present (title, description, og:image, lang)', () => {
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<meta name="description"[\s\r\n]*content="[^"]+"/);
  assert.match(html, /<meta property="og:image" content="https?:[^"]+"/);
  assert.match(html, /<html[^>]+lang="/);
});

test('every <img> declares alt text', () => {
  const imgs = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
  const missing = imgs.filter((t) => !/\balt=/.test(t));
  assert.deepEqual(missing.map((t) => t.slice(0, 60)), [], 'images without alt');
});

test('service worker precache matches the versions index.html actually uses', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  for (const asset of ['assets/css/style.min.css', 'assets/js/main.min.js']) {
    const inHtml = html.match(new RegExp(`${asset.replace(/[./]/g, '\\$&')}\\?v=([0-9.]+)`))?.[1];
    const inSw = sw.match(new RegExp(`${asset.replace(/[./]/g, '\\$&')}\\?v=([0-9.]+)`))?.[1];
    assert.equal(inSw, inHtml, `${asset}: sw.js has v=${inSw}, index.html has v=${inHtml} — update sw.js PRECACHE + bump CACHE`);
  }
});

test('service worker serves navigations network-first', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /mode === 'navigate'/, 'sw.js must special-case navigations');
  assert.match(sw, /catch\(\(\) => caches\.match/, 'navigations should fall back to cache only when offline');
  assert.doesNotMatch(sw, /'\.\/'/, 'do not precache the HTML shell — it pins visitors to old builds');
});

test('robots.txt and sitemap.xml exist and agree on the site URL', () => {
  assert.ok(existsSync(join(ROOT, 'robots.txt')));
  const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /tawittytc\.github\.io\/mywebsite/);
});

test('asset size budgets hold', () => {
  const budget = (p, max) => {
    const kb = statSync(join(ROOT, p)).size / 1024;
    assert.ok(kb <= max, `${p} is ${kb.toFixed(0)}KB (budget ${max}KB)`);
  };
  budget('assets/js/main.min.js', 45);
  budget('assets/css/style.min.css', 60);
  for (const f of readdirSync(join(ROOT, 'assets/img/certificate'))) {
    budget(`assets/img/certificate/${f}`, 80);
  }
});

test('main.min.js ships clean (no console.log, no unsupported syntax)', () => {
  const min = readFileSync(join(ROOT, 'assets/js/main.min.js'), 'utf8');
  assert.doesNotMatch(min, /console\.log/, 'stray console.log in production bundle');
  assert.doesNotMatch(min, /\?\./, 'optional chaining breaks older Safari');
  assert.doesNotMatch(min, /\w\?\?\w/, 'nullish coalescing breaks older Safari');
});
