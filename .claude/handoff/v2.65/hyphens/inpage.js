// In-page measuring helpers (injected with addInitScript). No DOM changes.
window.__hy = (() => {
  const LD = /[\p{L}\p{N}]/u;
  const BLOCKISH = (el) => {
    const d = getComputedStyle(el).display;
    return !(d === 'inline' || d === 'contents');
  };
  const blockOf = (el) => { let b = el; while (b && !BLOCKISH(b)) b = b.parentElement; return b; };
  // a readable, stable name for an element: ids and classes, .nw spans skipped
  const label = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      if (e.classList.contains('nw') || e.classList.contains('svc-nw')) continue;
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(s + '#' + e.id); break; }
      if (e.classList.length) s += '.' + [...e.classList].filter((c) => !/^(is-open|active|open|card-visible|hint|hint-loop|aos-animate|in-view)$/.test(c)).join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  // structural path that does not change when .nw spans are added
  const path = (el, root) => {
    const parts = [];
    for (let e = el; e && e !== root && e.nodeType === 1; e = e.parentElement) {
      const p = e.parentElement;
      if (!p) break;
      const sibs = [...p.children].filter((c) => !(c.classList.contains('nw') || c.classList.contains('svc-nw')));
      const same = sibs.filter((c) => c.tagName === e.tagName);
      let s = e.tagName.toLowerCase();
      if (e.id && !/^(exp-lightbox-title|proj-back-note)$/.test(e.id)) { parts.unshift(s + '#' + e.id); break; }
      if (same.length > 1) s += ':' + (same.indexOf(e) + 1);
      parts.unshift(s);
    }
    return parts.join('/');
  };
  const textNodes = (root) => {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest('script,style,template,noscript,svg')) continue;
      out.push(n);
    }
    return out;
  };
  const charRect = (r, n, i) => { r.setStart(n, i); r.setEnd(n, i + 1); return r.getClientRects()[0]; };

  /** every "-" between two letters/digits: is the next character on another line? */
  function hyphens(root) {
    const nodes = textNodes(root);
    const r = document.createRange();
    const res = { measured: 0, unrendered: 0, breaks: [], words: [] };
    nodes.forEach((n, k) => {
      const s = n.nodeValue;
      for (let i = s.indexOf('-'); i >= 0; i = s.indexOf('-', i + 1)) {
        // neighbours, looking into the adjacent text node of the same block when the "-" ends its node
        let pn = n, pi = i - 1, nn = n, ni = i + 1;
        if (pi < 0) { pn = nodes[k - 1]; pi = pn ? pn.nodeValue.length - 1 : -1; }
        if (ni >= s.length) { nn = nodes[k + 1]; ni = 0; }
        if (!pn || !nn || pi < 0 || !nn.nodeValue.length) continue;
        if ((pn !== n && blockOf(pn.parentElement) !== blockOf(n.parentElement)) ||
            (nn !== n && blockOf(nn.parentElement) !== blockOf(n.parentElement))) continue;
        if (!LD.test(pn.nodeValue[pi]) || !LD.test(nn.nodeValue[ni])) continue;
        const a = charRect(r, n, i), b = charRect(r, nn, ni);
        // the whole token, for the report
        let x = i, y = i;
        while (x > 0 && !/\s/.test(s[x - 1])) x--;
        while (y < s.length - 1 && !/\s/.test(s[y + 1])) y++;
        const word = s.slice(x, y + 1);
        if (!a || !b || (a.width === 0 && a.height === 0)) { res.unrendered++; continue; }
        res.measured++;
        const el = n.parentElement;
        const nowrapParent = getComputedStyle(el).whiteSpace === 'nowrap' || getComputedStyle(el).whiteSpaceCollapse === 'preserve';
        res.words.push([word, nowrapParent ? 1 : 0, label(el)]);
        if (Math.abs(a.top - b.top) > Math.max(2, a.height / 2)) {
          res.breaks.push({ word, where: label(el), tops: [Math.round(a.top), Math.round(b.top)] });
        }
      }
    });
    return res;
  }

  /** .nw / .svc-nw spans that do not fit the content box of their block */
  function nwFit(root) {
    const bad = [], redundant = [];
    let n = 0;
    root.querySelectorAll('.nw, .svc-nw').forEach((sp) => {
      const rs = sp.getClientRects();
      if (!rs.length) return;
      n++;
      if (getComputedStyle(sp.parentElement).whiteSpace === 'nowrap') redundant.push(sp.textContent + ' in ' + label(sp.parentElement));
      const b = blockOf(sp.parentElement);
      const cs = getComputedStyle(b), br = b.getBoundingClientRect();
      const left = br.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      const right = br.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
      const sr = sp.getBoundingClientRect();
      if (rs.length > 1 || sr.width > right - left + 0.5 || sr.right > right + 0.5 || sr.left < left - 0.5) {
        bad.push({ text: sp.textContent, lines: rs.length, span: +sr.width.toFixed(1), box: +(right - left).toFixed(1), over: +(sr.right - right).toFixed(1), where: label(b) });
      }
    });
    return { n, bad, redundant };
  }

  /** boxes whose content is cut (overflow not visible and content larger) */
  function clipped(root, base) {
    const out = {};
    root.querySelectorAll('*').forEach((el) => {
      if (el.closest('svg') || !el.getClientRects().length) return;
      const cs = getComputedStyle(el);
      const ox = cs.overflowX, oy = cs.overflowY;
      const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
      if ((ox !== 'visible' && dx > 1) || (oy !== 'visible' && dy > 1)) out[path(el, base)] = [ox, oy, dx, dy].join(',');
    });
    return out;
  }

  /** heights of every rendered element, keyed by a path that ignores .nw spans */
  function heights(root, base) {
    const out = {};
    root.querySelectorAll('*').forEach((el) => {
      if (el.classList.contains('nw') || el.classList.contains('svc-nw')) return;
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      if (!el.getClientRects().length) return;
      const r = el.getBoundingClientRect();
      if (getComputedStyle(el).display === 'inline') {
        // an inline box: count its lines instead (its own height never changes)
        out[path(el, base)] = 'L' + el.getClientRects().length + '|' + label(el);
        return;
      }
      out[path(el, base)] = (Math.round(r.height * 10) / 10) + '|' + label(el);
    });
    return out;
  }

  /** siblings that share a top edge: their heights */
  function rows(groups) {
    const out = {};
    for (const [name, sel] of Object.entries(groups)) {
      const els = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length);
      const byTop = {};
      els.forEach((e) => {
        const r = e.getBoundingClientRect();
        const k = Math.round(r.top + scrollY);
        (byTop[k] = byTop[k] || []).push(Math.round(r.height * 10) / 10);
      });
      out[name] = Object.keys(byTop).map(Number).sort((a, b) => a - b).map((k) => byTop[k]);
    }
    return out;
  }

  /** panels that scroll sideways */
  function sideways(root) {
    const out = [];
    [root, ...root.querySelectorAll('*')].forEach((el) => {
      if (!el.getClientRects || !el.getClientRects().length || el.closest('svg')) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline') return;
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible') {
        out.push({ where: label(el), sw: el.scrollWidth, cw: el.clientWidth, ox: cs.overflowX });
      }
    });
    return out;
  }

  /** text that pokes out of the viewport or of the open sheet */
  function pokes(root, box) {
    const out = [];
    const lim = box ? box.getBoundingClientRect() : { left: 0, right: document.documentElement.clientWidth };
    const r = document.createRange();
    textNodes(root).forEach((n) => {
      if (!n.nodeValue.trim()) return;
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) {
        if (q.width && (q.right > lim.right + 1 || q.left < lim.left - 1)) {
          // allowed inside a sideways scroller (the card rows, the chip rows)
          let sc = n.parentElement, ok = false;
          for (; sc && sc !== root.parentElement; sc = sc.parentElement) {
            const ox = getComputedStyle(sc).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { const b = sc.getBoundingClientRect(); if (b.right <= lim.right + 1 && b.left >= lim.left - 1) { ok = true; break; } }
          }
          if (!ok) out.push({ text: n.nodeValue.trim().slice(0, 40), left: Math.round(q.left), right: Math.round(q.right), where: label(n.parentElement) });
          break;
        }
      }
    });
    return out;
  }

  return { hyphens, nwFit, clipped, heights, rows, sideways, pokes, label, path };
})();
