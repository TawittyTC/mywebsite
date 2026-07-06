// Shared test context: static server + Chromium + instrumented page opener.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

export async function createContext() {
  const srv = await startServer(ROOT);
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});

  /** Open the page, wait for the loader to clear, collect errors. */
  async function openPage(opts = {}) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
    const errors = [];
    const failed = [];
    const sameOrigin = (url) => url.startsWith(srv.url);
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const src = m.location()?.url || '';
      if (src === '' || sameOrigin(src)) errors.push(`${m.text()} (${src})`);
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && sameOrigin(r.url())) failed.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(srv.url + '/index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => !document.querySelector('.loader'), null, { timeout: 8000 });
    return { page, errors, failed };
  }

  return {
    srv,
    browser,
    openPage,
    close: async () => { await browser.close(); srv.server.close(); },
  };
}

/** Count painted (non-transparent) canvas pixels inside an optional band. */
export function inkCount(sel = '#hero-net', yFrom = 0, yTo = 1) {
  return `(() => {
    const c = document.querySelector('${sel}');
    if (!c) return -1;
    const y = Math.round(c.height * ${yFrom});
    const h = Math.max(1, Math.round(c.height * (${yTo} - ${yFrom})));
    const d = c.getContext('2d').getImageData(0, y, c.width, h).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  })()`;
}
