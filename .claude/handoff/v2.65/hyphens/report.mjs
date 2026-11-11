// node report.mjs <measure.json> [--words]   summary of one measurement file
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const showWords = process.argv.includes('--words');
let totalBreaks = 0, pageBreaksAll = 0;
for (const w of Object.keys(d).map(Number).sort((a, b) => a - b)) {
  const r = d[w];
  if (r.fatal) { console.log(`${w}: FATAL ${r.fatal}`); continue; }
  const lines = [];
  const pb = r.page.hy.breaks;
  pageBreaksAll += pb.length;
  const ctxs = [['page', r.page], ...Object.entries(r.overlays)];
  const redundant = new Set();
  let ovBreaks = 0, measured = 0, nwN = 0, nwBad = [], side = [], pokes = [], panelBad = [], missing = [];
  const brk = {};
  for (const [name, c] of ctxs) {
    if (c.missing) { missing.push(name); continue; }
    measured += c.hy.measured;
    nwN += c.nw.n;
    for (const b of (c.nw.redundant || [])) redundant.add(b);
    for (const b of c.nw.bad) nwBad.push(`${name}: "${b.text}" span ${b.span} box ${b.box} over ${b.over} lines ${b.lines} in ${b.where}`);
    if (name !== 'page') {
      ovBreaks += c.hy.breaks.length;
      if (c.panel.sw > c.panel.cw) panelBad.push(`${name}: ${c.panel.sw}>${c.panel.cw}`);
    }
    for (const b of c.hy.breaks) { const k = b.word + ' @ ' + b.where; (brk[k] = brk[k] || new Set()).add(name.replace(/^card\d+:/, 'card:')); }
    for (const p of (c.pokes || [])) pokes.push(`${name}: "${p.text}" ${p.left}..${p.right} in ${p.where}`);
  }
  totalBreaks += pb.length + ovBreaks;
  console.log(`\n=== ${w}px: page breaks ${pb.length}; overlay breaks ${ovBreaks}; hyphens measured ${measured}; doc ${r.page.doc.sw}/${r.page.doc.vw}; .nw rendered ${nwN}, not fitting ${nwBad.length}; panels overflowing ${panelBad.length}; text poking out ${pokes.length}; errors ${r.errors.length}; hero "${r.hero.text}" lines ${r.hero.lines} breaks ${r.hero.hy ? r.hero.hy.breaks.length : '?'}`);
  for (const [k, v] of Object.entries(brk)) console.log(`   BREAK ${k}   [${[...v].slice(0, 4).join(', ')}${v.size > 4 ? ', +' + (v.size - 4) : ''}]`);
  for (const s of [...new Set(nwBad)].slice(0, 30)) console.log('   NWFIT ' + s);
  for (const s of panelBad.slice(0, 10)) console.log('   PANEL ' + s);
  for (const s of redundant) console.log('   REDUNDANT ' + s);
  for (const s of [...new Set(pokes)].slice(0, 20)) console.log('   POKE ' + s);
  if (missing.length) console.log('   MISSING ' + missing.join(', '));
  if (r.errors.length) console.log('   ERR ' + r.errors.slice(0, 3).join(' | '));
  const rows = r.page.rows;
  const uneq = [];
  for (const [g, rs] of Object.entries(rows)) rs.forEach((hs, i) => { if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 0.6) uneq.push(`${g} row${i + 1}: ${[...new Set(hs)].join('/')}`); });
  console.log(`   rows: ` + Object.entries(rows).map(([g, rs]) => `${g} ${rs.map((hs) => hs.length + '×' + [...new Set(hs)].join('/')).join(' | ')}`).join(' ;; ').slice(0, 900));
  if (uneq.length) console.log('   UNEQUAL ' + uneq.join(' ;; '));
  if (showWords) {
    const seen = {};
    for (const [name, c] of ctxs) if (!c.missing) for (const [word, nowrap, where] of c.hy.words) { const k = (nowrap ? 'NOWRAP ' : '       ') + word + ' @ ' + where; seen[k] = (seen[k] || 0) + 1; }
    for (const k of Object.keys(seen).sort()) console.log('   W ' + k + ' ×' + seen[k]);
  }
}
console.log(`\nTOTAL breaks (page + overlays, all widths): ${totalBreaks}; page only: ${pageBreaksAll}`);
