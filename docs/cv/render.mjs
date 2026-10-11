// Renders docs/cv/cv.html to assets/cv/Tanapol-Chamnanhan-CV.pdf (one A4 page).
// Edit cv.html, then: CHROMIUM_PATH=/path/to/chromium node docs/cv/render.mjs
import { chromium } from '../../node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../assets/cv/Tanapol-Chamnanhan-CV.pdf');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.goto('file://' + join(here, 'cv.html'), { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const bottom = await page.evaluate(() => document.querySelector('footer').getBoundingClientRect().bottom);
if (bottom > 1085) console.warn(`content ends at ${Math.round(bottom)}px — it will spill onto a second page`);
await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true });
await browser.close();
console.log('wrote', out);
