// A returning visitor sees a new deploy on the next plain visit, not ten
// minutes later. GitHub Pages sends "Cache-Control: max-age=600"; the service
// worker used to fetch the page through the browser's cache, which kept the
// old page for those ten minutes unless the visitor reloaded.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { ROOT } from './helpers.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.xml': 'application/xml',
};

// a GitHub Pages-like server: every file with max-age=600 and an ETag; the page carries the build number
let build = 1, up = true, server, base, browser;
before(async () => {
  server = createServer((req, res) => {
    if (!up) { req.socket.destroy(); return; }
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    let body = readFileSync(file);
    if (path.endsWith('index.html')) body = Buffer.from(body.toString().replace('<head>', `<head><meta name="x-build" content="${build}">`));
    const etag = '"' + createHash('md5').update(body).digest('hex').slice(0, 16) + '"';
    const headers = { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ETag: etag };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    res.writeHead(200, headers).end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => { await browser.close(); server.close(); });

const builtAs = (page) => page.evaluate(() => document.querySelector('meta[name="x-build"]')?.content);

test('a returning visitor gets a new deploy on the next plain visit, and the cached page when offline', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  build = 1;
  await page.goto(base, { waitUntil: 'load' });
  // the service worker registers when the page is idle; wait until it controls the page
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto(base, { waitUntil: 'load' });
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker should control the page');
  assert.equal(await builtAs(page), '1');

  // a deploy, then the visitor comes back at once (well inside the 10 minutes)
  build = 2;
  await page.goto(base, { waitUntil: 'load' });
  assert.equal(await builtAs(page), '2', 'a plain visit right after a deploy showed the old page from the browser cache');

  // nothing new: the page still comes (a 304 behind the scenes) and stays the same
  await page.goto(base, { waitUntil: 'load' });
  assert.equal(await builtAs(page), '2');

  // offline: the service worker answers with the page it kept
  up = false;
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  assert.equal(await builtAs(page), '2', 'offline, the kept page should be shown');
  up = true;
  await context.close();
});
