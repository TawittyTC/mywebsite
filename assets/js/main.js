/**
 * Template Name: MyResume - v4.9.2
 * Template URL: https://bootstrapmade.com/free-html-bootstrap-template-my-resume/
 * Author: BootstrapMade.com
 * License: https://bootstrapmade.com/license/
 */
(function () {
  "use strict";

  /**
   * Easy selector helper function
   */
  const select = (el, all = false) => {
    el = el.trim();
    if (all) {
      return [...document.querySelectorAll(el)];
    } else {
      return document.querySelector(el);
    }
  };

  /**
   * Easy event listener function
   */
  const on = (type, el, listener, all = false) => {
    let selectEl = select(el, all);
    if (selectEl) {
      if (all) {
        selectEl.forEach((e) => e.addEventListener(type, listener));
      } else {
        selectEl.addEventListener(type, listener);
      }
    }
  };

  /**
   * Scrolls to an element with offset
   */
  const scrollto = (el, duration = 600) => {
    let element = select(el);
    if (!element) return;
    let start = window.scrollY;
    let target = element.getBoundingClientRect().top + window.scrollY - 60;
    let startTime = null;
    const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      let progress = Math.min((timestamp - startTime) / duration, 1);
      window.scrollTo(0, start + (target - start) * ease(progress));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };


  /**
   * Scrool with ofset on links with a class name .scrollto
   */
  on(
    "click",
    ".scrollto",
    function (e) {
      if (select(this.hash)) {
        e.preventDefault();
        scrollto(this.hash);
      }
    },
    true
  );

  /**
   * Scroll with ofset on page load with hash links in the url
   */
  window.addEventListener("load", () => {
    if (window.location.hash) {
      if (select(window.location.hash)) {
        scrollto(window.location.hash);
      }
    }
  });

  /**
   * Preloader — the stylesheet fades it as soon as it applies (style.css);
   * this only takes the element away once it has faded, or on load, and
   * no later than 2s from navigation start
   */
  let preloader = select(".loader");
  if (preloader) {
    let done = false;
    const hideLoader = () => {
      if (done) return;
      done = true;
      preloader.style.transition = 'opacity .25s cubic-bezier(.22, 1, .36, 1)';
      preloader.style.opacity = '0';
      setTimeout(() => { if (preloader.parentNode) preloader.remove(); }, 260);
    };
    preloader.addEventListener("animationend", (e) => {
      if (e.target === preloader && /^loader-(out|gone)$/.test(e.animationName)) hideLoader();
    });
    // On load only once the stylesheet has applied (it gives the loader its
    // loader-gone fade): load no longer waits for the analytics and consent
    // scripts, so it can now come before the stylesheet, and lifting the
    // loader then would show the page unstyled
    window.addEventListener("load", () => {
      if (/loader-gone/.test(getComputedStyle(preloader).animationName)) hideLoader();
    });
    // Failsafe: never block the page for more than 2s from navigation start
    setTimeout(hideLoader, Math.max(0, 2000 - performance.now()));
  }


})();

/**
 * Work the first screen does not show (arming the scroll reveals, the card
 * rows, the back-to-top state) waits until the page has painted once, then
 * runs as its own small task. A phone paints the hero and can answer a tap
 * in between, and the layout those jobs measure is already fresh, so the
 * measuring costs nothing extra. The timer covers a tab where frames stall.
 */
function afterPaint(fn) {
  var go = function () {
    if (!go) return;
    go = null;
    setTimeout(fn, 0);
  };
  requestAnimationFrame(function () { if (go) go(); });
  setTimeout(function () { if (go) go(); }, 200);
}

/**
 * Two-parameter spring, the way Apple frames it: `response` is roughly how
 * long the value takes to arrive, `damping` 1 lands it without overshoot.
 * It integrates from whatever is on screen at this instant, so re-aiming
 * mid-flight is continuous — grab a closing sheet and it comes back from
 * where it actually is, carrying its velocity, instead of finishing the
 * old animation first. That is the part a CSS transition cannot do.
 */
function createSpring(opts) {
  var damping = opts.damping == null ? 1 : opts.damping;
  var omega = 2 * Math.PI / (opts.response || 0.4);
  var x = opts.from || 0;
  var v = 0;
  var target = x;
  var raf = null;
  var last = 0;

  function frame(now) {
    // a long tab-switch must not integrate one giant step
    var dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    var a = -omega * omega * (x - target) - 2 * damping * omega * v;
    v += a * dt;
    x += v * dt;
    if (Math.abs(x - target) < 0.0015 && Math.abs(v) < 0.0015) {
      x = target;
      v = 0;
      raf = null;
      opts.onFrame(x);
      if (opts.onRest) opts.onRest(x);
      return;
    }
    opts.onFrame(x);
    raf = requestAnimationFrame(frame);
  }

  return {
    to: function (t) {
      target = t;
      if (raf === null) { last = performance.now(); raf = requestAnimationFrame(frame); }
    },
    // reduced motion, or any case where the move should not be animated
    jump: function (t) {
      target = x = t;
      v = 0;
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      opts.onFrame(x);
      if (opts.onRest) opts.onRest(x);
    }
  };
}

/**
 * Point a surface's growth at the thing that opened it, so it emerges from
 * that card rather than from the middle of the screen.
 */
function anchorOrigin(surface, source) {
  if (!source) { surface.style.transformOrigin = ''; return; }
  var from = source.getBoundingClientRect();
  // transform-origin is measured on the box BEFORE any transform, so the
  // surface has to be read unscaled — reading it mid-scale puts the growth
  // point off by whatever the current scale is. Restored in the same task,
  // so nothing is painted in between.
  var prev = surface.style.transform;
  surface.style.transform = 'none';
  var box = surface.getBoundingClientRect();
  surface.style.transform = prev;
  if (!box.width || !box.height) { surface.style.transformOrigin = ''; return; }
  var x = Math.max(0, Math.min(box.width, from.left + from.width / 2 - box.left));
  var y = Math.max(0, Math.min(box.height, from.top + from.height / 2 - box.top));
  surface.style.transformOrigin = x + 'px ' + y + 'px';
}

/**
 * Back closes the open sheet or picture instead of leaving the site. Each
 * overlay that opens adds one history entry for the same URL; Back takes
 * it off and closes the overlay on top. Closing by X, Escape or the
 * backdrop takes the entry back off too, so history is left as it was.
 */
var overlayHistory = (function () {
  var stack = [];        // close functions of the open overlays, top last
  var unwinding = false; // the next popstate is our own history.go()
  var pending = 0, timer = null;
  var settled = []; // run once our own history step has landed
  function flush() {
    var fns = settled;
    settled = [];
    fns.forEach(function (fn) { fn(); });
  }
  // An entry whose overlay is no longer on screen (left by a reload, or
  // reached with Forward) is stepped off, so Back is never a dead press
  function stale(depth) {
    if (depth <= stack.length) return false;
    unwinding = true;
    history.go(stack.length - depth);
    return true;
  }
  window.addEventListener('popstate', function (e) {
    // the browser restores the scroll position of the entry it lands on, so
    // anything that scrolls waits a frame past it
    if (unwinding) { unwinding = false; requestAnimationFrame(flush); return; }
    var depth = (e.state && e.state.overlay) || 0;
    if (stale(depth)) return;
    while (stack.length > depth) stack.pop()();
  });
  if (history.state && history.state.overlay) stale(history.state.overlay);
  return {
    opened: function (close) {
      stack.push(close);
      try { history.pushState({ overlay: stack.length }, ''); } catch (e) { stack.pop(); }
    },
    afterSettle: function (fn) {
      if (timer || unwinding) settled.push(fn); else fn();
    },
    closed: function (close) {
      var i = stack.lastIndexOf(close);
      if (i < 0) return; // Back already took its entry off
      stack.splice(i, 1);
      pending++;
      // Escape can close two layers in one keypress: one go() for both
      if (timer) return;
      timer = setTimeout(function () {
        var n = pending;
        timer = null;
        pending = 0;
        unwinding = true;
        history.go(-n);
      }, 0);
    }
  };
})();

// What opened an overlay decides where focus lands in it: from the keyboard
// its close button takes focus and shows the ring; from a mouse or a finger
// the dialog itself does, so no ring appears on a button nobody aimed at
var viaKeys = false;
document.addEventListener("keydown", function () { viaKeys = true; }, true);
document.addEventListener("pointerdown", function () { viaKeys = false; }, true);

// Cert lightbox
(function () {
  const lightbox = document.createElement("div");
  lightbox.className = "cert-lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "Certificate preview");
  lightbox.tabIndex = -1;
  const lbImg = document.createElement("img");
  // the frame lets a wide screenshot be panned on a narrow phone
  const frame = document.createElement("div");
  frame.className = "cert-lightbox-frame";
  frame.appendChild(lbImg);
  const caption = document.createElement("p");
  caption.className = "cert-lightbox-caption";
  const closeBtn = document.createElement("button");
  closeBtn.className = "cert-lightbox-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>'; // the drawn cross, like every other icon
  lightbox.appendChild(frame);
  lightbox.appendChild(caption);
  lightbox.appendChild(closeBtn);
  document.body.appendChild(lightbox);

  let lastFocus = null;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // same spring treatment as the experience sheet: the preview grows out of
  // the thumbnail it came from, and can be re-aimed mid-flight
  const motion = createSpring({
    response: 0.32,
    damping: 1,
    onFrame: function (p) {
      lightbox.style.opacity = Math.min(1, p * 1.25);
      lbImg.style.transform = "scale(" + (0.9 + 0.1 * p).toFixed(4) + ")";
      lbImg.style.opacity = Math.min(1, p * 1.4);
    },
    onRest: function (p) {
      if (p !== 0) return;
      lightbox.style.display = "";
      lightbox.style.opacity = "";
      lbImg.style.transform = "";
      lbImg.style.opacity = "";
      lbImg.style.transformOrigin = "";
    }
  });

  function openLightbox(src, alt, source, label, title) {
    if (!lightbox.classList.contains("open")) overlayHistory.opened(closeLightbox);
    lbImg.src = src;
    lbImg.alt = alt;
    caption.textContent = title || "";
    caption.hidden = !title;
    // A wide screenshot on a portrait phone would shrink to a strip too
    // small to read: show it tall enough to read and let it pan sideways
    var w = parseFloat(source && source.querySelector && source.querySelector("img") ?
      source.querySelector("img").getAttribute("width") : 0);
    var h = parseFloat(source && source.querySelector && source.querySelector("img") ?
      source.querySelector("img").getAttribute("height") : 0);
    var pan = !!(w && h && w / h > 1.4 && window.innerWidth < 768 && window.innerHeight > window.innerWidth &&
      window.matchMedia("(pointer: coarse)").matches);
    lightbox.classList.toggle("lb-pan", pan);
    if (pan) {
      frame.tabIndex = 0;
      frame.setAttribute("aria-label", "Screenshot, scroll sideways");
    } else {
      frame.removeAttribute("tabindex");
      frame.removeAttribute("aria-label");
    }
    // the swipe hint gets its own line, so a wrap never starts a line with " · "
    if (pan) {
      var hint = document.createElement("span");
      hint.className = "cert-lightbox-hint";
      hint.textContent = "Swipe to see the whole screen";
      caption.append(" ", hint);   // the space keeps the two apart when read aloud
      caption.hidden = false;
    }
    // one viewer serves certificates and project screenshots alike
    lightbox.setAttribute("aria-label", label || "Certificate preview");
    lightbox.classList.add("open");
    lightbox.style.display = "flex";
    document.body.style.overflow = "hidden";
    lastFocus = document.activeElement;
    anchorOrigin(lbImg, source);
    frame.scrollLeft = 0;
    if (reduce) motion.jump(1); else motion.to(1);
    (viaKeys ? closeBtn : lightbox).focus({ preventScroll: true });
  }
  function closeLightbox() {
    if (!lightbox.classList.contains("open")) return; // Escape pressed elsewhere
    lightbox.classList.remove("open");
    // the overlay stays painted until the spring settles, so hold the frame
    lightbox.style.display = "flex";
    // scroll is handed back on the dismissal itself, not when the fade ends
    if (!document.querySelector(".exp-lightbox.open")) document.body.style.overflow = "";
    if (reduce) motion.jump(0); else motion.to(0);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
    overlayHistory.closed(closeLightbox);
  }
  closeBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox || e.target === caption ||
        (e.target === frame && !lightbox.classList.contains("lb-pan"))) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lightbox.classList.contains("open")) { e.preventDefault(); closeLightbox(); }
    // Tab stays inside: the close button, and the screenshot when it pans
    if (e.key === "Tab" && lightbox.classList.contains("open")) {
      e.preventDefault();
      (lightbox.classList.contains("lb-pan") && document.activeElement === closeBtn ? frame : closeBtn).focus();
    }
  });

  window._certLightboxOpen = openLightbox;
})();

// Experience details lightbox (text modal)
(function () {
  const lightbox = document.createElement('div');
  lightbox.className = 'exp-lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Experience details');
  const inner = document.createElement('div');
  inner.className = 'exp-lightbox-inner';
  inner.tabIndex = -1;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'exp-lightbox-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  // the close button (and "All projects") ride a bar the sheet scrolls
  // under, so they never sit on top of words, logos or chevrons
  const bar = document.createElement('div');
  bar.className = 'exp-lightbox-bar';
  bar.appendChild(closeBtn);
  inner.appendChild(bar);
  lightbox.appendChild(inner);
  const stuck = function () { bar.classList.toggle('is-stuck', inner.scrollTop > 0); };
  inner.addEventListener('scroll', stuck, { passive: true });
  // a target scrolled to sits this far below the top edge: clear of the bar
  const clear = function () { return bar.offsetHeight + 16; };
  document.body.appendChild(lightbox);

  let lastFocus = null;
  // One spring owns the whole presentation: backdrop, sheet scale and fade
  // all read from it, so opening and closing are the same motion re-aimed.
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = createSpring({
    response: 0.34,
    damping: 1,
    onFrame: function (p) {
      // an open sheet stays visible from its first frame, so focus can land in it
      lightbox.style.visibility = (p > 0.002 || lightbox.classList.contains('open')) ? 'visible' : 'hidden';
      lightbox.style.opacity = Math.min(1, p * 1.25);
      inner.style.opacity = Math.min(1, p * 1.4);
      inner.style.transform = 'translateY(' + ((1 - p) * 8).toFixed(2) + 'px) scale('
        + (0.92 + 0.08 * p).toFixed(4) + ')';
    },
    onRest: function (p) {
      if (p !== 0) return;
      lightbox.style.visibility = '';
      lightbox.style.opacity = '';
      inner.style.opacity = '';
      inner.style.transform = '';
      inner.style.transformOrigin = '';
    }
  });

  var back = null; // a project opened from the "See all" list: Back returns to the list
  function closeExp() {
    if (!lightbox.classList.contains('open')) return; // Escape pressed elsewhere
    lightbox.classList.remove('open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
    // the dismissal is honoured at once; the fade out is only the picture
    // catching up, so the page is scrollable again immediately
    if (!document.querySelector('.cert-lightbox.open')) document.body.style.overflow = '';
    if (reduce) motion.jump(0); else motion.to(0);
    if (back) { overlayHistory.closed(back); back = null; }
    overlayHistory.closed(closeExp);
  }
  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    closeExp();
  });
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeExp();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !e.defaultPrevented) closeExp();
    // trap Tab inside the open dialog (WCAG: modal focus containment);
    // yield to the cert lightbox if it is layered on top
    if (e.key === 'Tab' && lightbox.classList.contains('open') &&
        !document.querySelector('.cert-lightbox.open')) {
      var focusables = Array.prototype.filter.call(
        inner.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'),
        function (el) { return el.offsetParent !== null; }
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!inner.contains(document.activeElement) || document.activeElement === inner) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
  });

  window._expLightboxOpen = function (html, source, client) {
    var was = lightbox.classList.contains('open');
    if (!was) overlayHistory.opened(closeExp);
    while (inner.children.length > 1) inner.removeChild(inner.lastChild);
    var pill = bar.querySelector('.proj-back');
    if (pill) bar.removeChild(pill);
    const content = document.createElement('div');
    content.innerHTML = html;
    inner.appendChild(content);
    inner.scrollTop = 0;
    // label the dialog by its title so screen readers announce which role opened
    var title = inner.querySelector('.exp-modal-title');
    if (title) {
      title.id = 'exp-lightbox-title';
      lightbox.setAttribute('aria-labelledby', 'exp-lightbox-title');
      lightbox.removeAttribute('aria-label');
    } else {
      lightbox.setAttribute('aria-label', 'Experience details');
      lightbox.removeAttribute('aria-labelledby');
    }
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (!was) lastFocus = document.activeElement;
    // make it measurable, then grow it out of the card that was clicked
    lightbox.style.visibility = 'visible';
    anchorOrigin(inner, source);
    if (reduce) motion.jump(1); else motion.to(1);
    (viaKeys ? closeBtn : inner).focus({ preventScroll: true });

    // Initialize client filter chips
    var chips = inner.querySelectorAll('.exp-filter-chip');
    var sections = inner.querySelectorAll('.exp-client-section');
    if (chips.length && sections.length) {
      var phone = window.matchMedia('(max-width: 734px)').matches;
      var clientsBlock = chips[0].closest('.exp-modal-section');
      var heads = [];
      // On a phone the client list is the proof, so it follows the role
      // overview straight away, each client folded to its name until opened
      if (phone && clientsBlock) {
        var overview = inner.querySelector('.exp-modal-overview');
        var overviewBlock = overview && overview.closest('.exp-modal-section');
        if (overviewBlock && overviewBlock.nextElementSibling !== clientsBlock) overviewBlock.after(clientsBlock);
        clientsBlock.classList.add('exp-clients-folded');
        sections.forEach(function (sec) {
          var head = sec.querySelector('.exp-client-section-header');
          var h3 = head && head.querySelector('h3');
          if (!h3) return;
          // a real button inside the heading (the accordion pattern), so the
          // client names stay headings for screen readers; the whole row taps
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'exp-client-toggle';
          btn.setAttribute('aria-expanded', 'false');
          while (h3.firstChild) btn.appendChild(h3.firstChild);
          h3.appendChild(btn);
          heads.push(head);
          head.addEventListener('click', function () {
            btn.setAttribute('aria-expanded', String(sec.classList.toggle('is-open')));
          });
        });
      }
      var choose = function (chip) {
        var filter = chip.dataset.filter;
        chips.forEach(function (c) {
          c.classList.toggle('active', c === chip);
          c.setAttribute('aria-pressed', String(c === chip));
        });
        sections.forEach(function (sec) {
          var show = filter === 'all' || sec.dataset.client === filter;
          sec.style.display = show ? '' : 'none';
          // one client chosen: its story shows open
          if (phone && show && filter !== 'all') {
            sec.classList.add('is-open');
            var toggle = sec.querySelector('.exp-client-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
          }
        });
        // chosen from the stuck row further down: bring the story up under it
        if (phone && clientsBlock && inner.scrollTop > clientsBlock.offsetTop - 16) {
          inner.scrollTop = clientsBlock.offsetTop - 16;
        }
      };
      chips.forEach(function (chip) {
        chip.setAttribute('aria-pressed', String(chip.classList.contains('active')));
        chip.addEventListener('click', function () { choose(chip); });
      });
      var preset = client && inner.querySelector('.exp-filter-chip[data-filter="' + client + '"]');
      if (preset && clientsBlock) {
        // opened from a client-work card: straight to that client
        choose(preset);
        // phone: the heading slips under the bar and the chip row sits
        // stuck right below it, the story 8px under the row
        inner.scrollTop = Math.max(0, clientsBlock.offsetTop - (phone ? 16 : clear()));
        var row = preset.parentNode;
        row.scrollLeft = preset.offsetLeft - row.offsetLeft - 20;
      }
    } else if (client) {
      // a sheet without client chips (SCG): open it on that project
      var sec = inner.querySelector('.exp-client-section[data-client="' + client + '"]');
      if (sec) inner.scrollTop = Math.max(0, sec.offsetTop - clear());
    }
    stuck();
  };
  window._expLightboxNest = function (html, source, client, restore) {
    back = function () { back = null; restore(); };
    overlayHistory.opened(back);
    window._expLightboxOpen(html, source, client);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'more proj-back';
    b.innerHTML = '<span class="chev" aria-hidden="true"></span>All projects';
    // screen readers hear which project they are in, not just the way back
    var nm = source && source.querySelector('.proj-name');
    if (nm) {
      var note = document.createElement('span'), co = source.closest('.proj-group');
      note.id = 'proj-back-note';
      note.hidden = true;
      note.textContent = nm.textContent + (co ? ', ' + co.querySelector('h3').textContent : '');
      b.appendChild(note);
      b.setAttribute('aria-describedby', 'proj-back-note');
    }
    b.addEventListener('click', function () { history.back(); }, { once: true });
    bar.insertBefore(b, closeBtn);
    if (viaKeys) b.focus({ preventScroll: true });
    // the sheet opened on a project (scrolled to it): start it clear of the bar
    var chip = inner.querySelector('.exp-filter-chip');
    var t = inner.scrollTop && (chip ? chip.closest('.exp-modal-section') : inner.querySelector('.exp-client-section[data-client="' + client + '"]'));
    if (t) inner.scrollTop = Math.max(0, t.offsetTop - clear());
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  // ── Auto-sync Protollcall client count from template ──
  var protollcallTmpl = document.getElementById('exp-protollcall');
  if (protollcallTmpl) {
    var chips = protollcallTmpl.content.querySelectorAll(
      '.exp-filter-chip[data-filter]:not([data-filter="all"]):not([data-filter="general"])'
    );
    var clientCount = chips.length;
    // Update the stat number and its data-count
    var statSpan = document.querySelector('[data-exp="protollcall"] .exp-stat-clients');
    if (statSpan) { statSpan.dataset.count = clientCount; statSpan.textContent = clientCount; }
    // Update the count wherever it is written: the card and its sheet
    document.querySelectorAll('[data-exp="protollcall"] .js-client-count-text').forEach(function (el) {
      el.textContent = clientCount;
    });
    protollcallTmpl.content.querySelectorAll('.js-client-count-text').forEach(function (el) {
      el.textContent = clientCount;
    });
    // "+ N more" after the six clients named on the card
    var more = document.querySelector('[data-exp="protollcall"] .js-client-more');
    if (more) more.textContent = Math.max(0, clientCount - 6);
  }

  document.querySelectorAll('#experience .data-box[data-exp]').forEach(function (card) {
    card.addEventListener('click', function () {
      var tmpl = document.getElementById('exp-' + card.dataset.exp);
      if (tmpl) window._expLightboxOpen(tmpl.innerHTML, card);
    });
  });
  // (the stat numbers are written final in the page: nothing counts up,
  // and the cards enter with the one reveal below, like every block)
});

// Project cards open their screenshot whole, the way an apple.com card's
// corner button opens its story. The whole card is the target.
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("#portfolio .rf-cards-scroller-item").forEach(function (card) {
    // client-work cards open their story in the experience sheet, on that client
    if (card.dataset.openExp) {
      card.addEventListener("click", function () {
        var tmpl = document.getElementById("exp-" + card.dataset.openExp);
        if (tmpl) window._expLightboxOpen(tmpl.innerHTML, card, card.dataset.client);
      });
      return;
    }
    var img = card.querySelector(".project-img img");
    if (!img) return;
    var title = card.querySelector("h3");
    card.addEventListener("click", function () {
      window._certLightboxOpen(img.currentSrc || img.src, img.alt, card.querySelector(".project-img"), "Project screenshot",
        title ? title.textContent : "");
    });
  });
});

/**
 * "See all N projects" lists every card of the row in the sheet, grouped
 * by company as SCG is (data-company, else the client after ", " in the
 * title), the card's own drawing in a round well. Built from the cards, so the list can never disagree with
 * the row. A row opens its project in the same sheet; Back returns here.
 */
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.querySelector("[data-proj-all]");
  var inner = document.querySelector(".exp-lightbox-inner");
  if (!btn || !inner || !window._expLightboxNest) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll("#scroller > .rf-cards-scroller-item"));
  var count = btn.querySelector(".js-proj-count");
  if (count) count.textContent = cards.length;
  var esc = function (t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML.replace(/"/g, "&quot;"); };
  var at = 0, from = null;
  function list() {
    var groups = {}, order = [], logos = {};
    cards.forEach(function (c, i) {
      var tag = c.querySelector(".project-tag").textContent, cut = tag.indexOf(" · ");
      var icon = c.querySelector(".work-icon svg"), img = c.querySelector(".project-img img");
      // grouped by company, as SCG is: "Vehicle sales CRM, Inchcape Thailand"
      // sits under "Inchcape Thailand"; work with no client in its title
      // names its company (Protollcall R&D, the university) in data-company
      var t = c.querySelector("h3").textContent, k = t.indexOf(", ");
      var own = c.getAttribute("data-company"), g = own || (k > 0 ? t.slice(k + 2) : "Other projects");
      var kind = own ? tag : (cut > 0 ? tag.slice(cut + 3) : tag);
      // "...research" needs no "Research ·" in front of what it is
      if (own && cut > 0 && t.toLowerCase().indexOf(tag.slice(0, cut).toLowerCase()) >= 0) kind = tag.slice(cut + 3);
      if (g.indexOf(kind) >= 0) kind = "";   // "S.B.L. Leasing" needs no "Leasing"
      if (!groups[g]) { groups[g] = []; order.push(g); }
      // the company's logo, from whichever of its cards names one; each file
      // is drawn at 3x its display size, and srcset alone (no 1x src) makes
      // every screen show it at that size; data-logo-size holds that size so
      // the heading keeps the logo's room before the file arrives
      if (!logos[g] && c.getAttribute("data-logo")) logos[g] = [c.getAttribute("data-logo"), (c.getAttribute("data-logo-size") || "").split("x")];
      groups[g].push('<li><button type="button" class="proj-row" data-i="' + i + '" aria-describedby="pg' + order.indexOf(g) + '"><span class="proj-well" aria-hidden="true">' +
        (icon ? icon.outerHTML : '<img src="' + esc(img.getAttribute("src")) + '" alt="">') +
        '</span><span class="proj-text"><span class="proj-name">' + esc(k > 0 ? t.slice(0, k) : t) + "</span>" +
        (kind ? ' <span class="proj-kind"><span class="nw">' + esc(kind) + "</span></span>" : "") +
        '</span><span class="chev" aria-hidden="true"></span></button></li>');
    });
    return '<div class="exp-modal-header"><h2 class="exp-modal-title">All projects</h2><div class="exp-modal-company">' +
      cards.length + " projects</div></div>" + order.map(function (g, j) {
        return '<div class="proj-group"><h3 id="pg' + j + '"><span>' + esc(g) + '</span>' +
          (logos[g] ? '<img class="proj-logo" srcset="' + esc(logos[g][0]) + ' 3x" width="' + esc(logos[g][1][0] || "") +
            '" height="' + esc(logos[g][1][1] || "") + '" alt="" loading="lazy" decoding="async">' : '') + '</h3><ul class="proj-rows">' + groups[g].join("") + "</ul></div>";
      }).join("");
  }
  function showList() {
    window._expLightboxOpen(list(), btn);
    inner.scrollTop = at;
    var row = from && inner.querySelector('.proj-row[data-i="' + from + '"]');
    if (row) row.focus({ preventScroll: true });
  }
  btn.addEventListener("click", function () { at = 0; from = null; showList(); });
  inner.addEventListener("click", function (e) {
    var row = e.target.closest(".proj-row");
    if (!row) return;
    var c = cards[+row.dataset.i];
    // a screenshot card: its viewer opens over the list
    if (!c.dataset.openExp) { c.click(); return; }
    at = inner.scrollTop;
    from = row.dataset.i;
    window._expLightboxNest(document.getElementById("exp-" + c.dataset.openExp).innerHTML, row, c.dataset.client, showList);
  });
});

// Certificate grid: the DOM is built immediately so the page has its
// final length from the start (deferring it made the page grow ~4000px
// mid-scroll — the scrollbar jumped). Only the IMAGES stay lazy.
document.addEventListener("DOMContentLoaded", function () {
  const imagesList = document.getElementById("images-list");
  if (!imagesList) return;

  // what each certificate is, read from the certificate itself (img-N is N)
  const names = [
    "Internship letter, SCG, April to July 2023",
    "Internship letter, SCG, December 2023 to March 2024",
    "Systems Tester, Professional Qualification Level 4, TPQI, 2022",
    "Digital industry qualification training, ARIT, 2021",
    "Second place, academic quiz, Songkhla Polytechnic College, 2019",
    "Research presentation award, Very good, AUC 2023",
    "Command Prompt 101, BorntoDev, 2019",
    "Essential SQL for Everyone, BorntoDev, 2019",
    "Fundamentals of Graphic Design, BorntoDev, 2019",
    "Introduction to Computer Science, BorntoDev, 2020",
    "Chatbots for online shops, BorntoDev, 2020",
    "Notebook repair service, short course, Songkhla Polytechnic College, 2017",
    "Microsoft Excel basics, Starfish Labz, 2020",
    "Computing science and coding, Starfish Labz, 2020",
    "Startup Thailand League 2021, online coaching and Mega Hackathon",
    "Hour of Code with Minecraft, Code.org",
    "The Hour of Code, Code.org",
    "English for communication, short course, Songkhla Polytechnic College, 2017",
    "English public speaking contest, Songkhla vocational education, 2018",
    "GitHub for Developer, BorntoDev, 2022",
    "Computer repair service, short course, Songkhla Polytechnic College, 2017",
    "Notebook repair, short course in Thai, Songkhla Polytechnic College, 2017",
    "Computer repair, short course in Thai, Songkhla Polytechnic College, 2017",
    "Computer repair service, short course, Songkhla Polytechnic College, 2017",
    "Introduction to JavaScript, BorntoDev, 2020",
    "Lite: Fundamental Web Dev with HTML5 & CSS3, BorntoDev, 2022",
    "Coding, a skill for the future, Starfish Labz, 2020",
    "Python programming for beginners, Starfish Labz, 2020",
    "Basic Software Testing, BorntoDev, 2025",
    "NDG Linux Essentials, Cisco Networking Academy, 2023",
    "Improving work efficiency with AI, Thai MOOC",
    "Claude 101, Anthropic",
    "Claude Code 101, Anthropic"
  ];

  function buildCerts() {
    if (imagesList.dataset.loaded) return;
    imagesList.dataset.loaded = "1";
    for (let i = 1; i <= 33; i++) {
      const colDiv = document.createElement("div");
      colDiv.classList.add("col-6", "col-md-4", "mb-5");
      const card = document.createElement("div");
      card.classList.add("cert-card");
      const wrapper = document.createElement("div");
      wrapper.classList.add("cert-img");
      const imgElement = document.createElement("img");
      const src = `assets/img/certificate/img-${i}.avif`;
      const name = names[i - 1];
      const alt = "Certificate: " + name;
      imgElement.src = src;
      imgElement.className = "img-fluid";
      imgElement.alt = alt;
      imgElement.loading = "lazy";
      imgElement.draggable = false;
      const expandBtn = document.createElement("button");
      expandBtn.className = "cert-expand-btn";
      expandBtn.setAttribute("aria-label", "View certificate: " + name);
      expandBtn.innerHTML = "+";
      expandBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        window._certLightboxOpen(src, alt, card, "Certificate preview", name);
      });
      card.style.cursor = "pointer";
      card.addEventListener("click", function () {
        window._certLightboxOpen(src, alt, card, "Certificate preview", name);
      });
      wrapper.appendChild(imgElement);
      card.appendChild(wrapper);
      card.appendChild(expandBtn);
      colDiv.appendChild(card);
      imagesList.appendChild(colDiv);
    }
  }

  buildCerts();
});


/**
 * CardScroller — reusable horizontal card-scroller component.
 *
 * Markup contract (copy-paste into any section, no extra JS needed):
 *
 *   <div class="rf-cards-scroller">
 *     <div class="rf-cards-scroller-overflow" data-card-scroller>
 *       <div class="rf-cards-scroller-item">…card…</div>
 *       …
 *     </div>
 *     <div class="paddlenav">
 *       <button class="paddlenav-arrow" data-scroller-prev>…</button>
 *       <button class="paddlenav-arrow" data-scroller-next>…</button>
 *     </div>
 *   </div>
 *
 * Every [data-card-scroller] initializes itself on DOMContentLoaded:
 * arrow paging, arrow disabled-state sync, and the mobile swipe-hint
 * loop. Arrows are resolved from [data-scroller-prev]/[data-scroller-next]
 * inside the same <section> (or passed via options). Optional
 * data-scroller-step="480" overrides the paging distance.
 * The instance is exposed on el._cardScroller as { update, reset }.
 */
function createCardScroller(scroller, options) {
  var opts = options || {};
  var root = scroller.closest('section') || document;
  var prevBtn = opts.prev || root.querySelector('[data-scroller-prev]');
  var nextBtn = opts.next || root.querySelector('[data-scroller-next]');
  var step = parseInt(scroller.getAttribute('data-scroller-step'), 10) || opts.step || 400;

  function update() {
    if (!prevBtn || !nextBtn) return;
    var left = scroller.scrollLeft;
    var max = scroller.scrollWidth - scroller.clientWidth;
    prevBtn.disabled = left <= 0;
    prevBtn.classList.toggle('disabled', left <= 0);
    nextBtn.disabled = left >= max - 1;
    nextBtn.classList.toggle('disabled', left >= max - 1);
  }

  // Paging, the way apple.com's gallery paddles move: a whole page of
  // cards at a time, landing with the next card exactly on the column
  // edge, on an eased glide we draw ourselves. Native smooth scrolling was
  // uneven across browsers (Safari jumps an overflow:hidden row outright)
  // and a fixed 400px step left the row resting mid-card.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var glide = null;

  function stops() {
    // where the row must rest for each visible card to sit on the column edge
    var items = Array.prototype.filter.call(scroller.children, function (el) {
      return el.offsetParent !== null;
    });
    if (!items.length) return null;
    var first = items[0].offsetLeft;
    return items.map(function (el) { return el.offsetLeft - first; });
  }

  function pageTarget(dir) {
    var max = scroller.scrollWidth - scroller.clientWidth;
    var s = stops();
    if (!s || s.length < 2) return Math.max(0, Math.min(max, scroller.scrollLeft + dir * step));
    // aim from where an unfinished glide is heading, so quick taps add up
    var at = glide ? glide.to : scroller.scrollLeft;
    var pitch = s[1] - s[0];
    var column = scroller.clientWidth - (parseFloat(getComputedStyle(scroller).paddingLeft) || 0);
    var perPage = Math.max(1, Math.floor((column + 1) / pitch));
    var current = 0;
    for (var i = 0; i < s.length; i++) if (s[i] <= at + 2) current = i;
    var next = Math.max(0, Math.min(s.length - 1, current + dir * perPage));
    // stepping back from a resting point between stops lands on the stop just passed
    if (dir < 0 && at > s[current] + 2) next = Math.max(0, current - perPage + 1);
    return Math.max(0, Math.min(max, s[next]));
  }

  function glideTo(to) {
    if (glide) cancelAnimationFrame(glide.raf);
    var from = scroller.scrollLeft;
    var dist = to - from;
    if (Math.abs(dist) < 1) { glide = null; return; }
    if (reduceMotion) { glide = null; scroller.scrollLeft = to; return; }
    // a longer trip takes a little longer, as a thrown object would
    var dur = Math.min(900, 520 + Math.abs(dist) * 0.18);
    var t0 = performance.now();
    var g = glide = { to: to, raf: 0 };
    function frame(now) {
      if (glide !== g) return; // cancelled or replaced by a newer glide
      var p = Math.min(1, (now - t0) / dur);
      // ease-in-out: leaves gently, travels, settles without a bump
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      scroller.scrollLeft = from + dist * e;
      if (p < 1) g.raf = requestAnimationFrame(frame);
      else { glide = null; update(); }
    }
    g.raf = requestAnimationFrame(frame);
  }

  // a finger on the row takes over from any glide in progress
  scroller.addEventListener('touchstart', function () {
    if (glide) { cancelAnimationFrame(glide.raf); glide = null; }
  }, { passive: true });

  if (prevBtn) {
    prevBtn.addEventListener('click', function () { glideTo(pageTarget(-1)); });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () { glideTo(pageTarget(1)); });
  }
  scroller.addEventListener('scroll', update, { passive: true });
  // Tab into a card: bring the whole card onto the column, not just its "+"
  scroller.addEventListener('focusin', function (e) {
    var it = e.target.closest('.rf-cards-scroller-item');
    if (!it || !e.target.matches(':focus-visible')) return;
    requestAnimationFrame(function () {
      var pad = parseFloat(getComputedStyle(scroller).paddingLeft) || 0;
      var r = it.getBoundingClientRect(), box = scroller.getBoundingClientRect();
      if (r.left < box.left + pad - 1 || r.right > box.right - pad + 1) {
        scroller.scrollLeft = it.offsetLeft - scroller.firstElementChild.offsetLeft;
      }
      it.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  });
  window.addEventListener('load', update); // re-sync once images have sized the row
  update();
  setTimeout(update, 500);

  // Mobile: nudge the row left and back once, the first time it comes
  // into view, to show that it scrolls sideways. It never repeats, and a
  // touch, a scroll or a keyboard focus in the row cancels it.
  if (window.innerWidth <= 1024 && !reduceMotion && 'IntersectionObserver' in window) {
    var hintDone = false;
    var cancelHint = function () { hintDone = true; };
    scroller.addEventListener('touchstart', cancelHint, { passive: true });
    scroller.addEventListener('focusin', cancelHint);
    var runHint = function () {
      var dir = scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 1 ? -1 : 1;
      var base = scroller.scrollLeft, t0 = performance.now();
      (function step(ts) {
        if (hintDone) return;
        // 40px out and back in 600ms, each leg on an ease-out
        var p = Math.min((ts - t0) / 600, 1);
        var e = p < 0.5 ? 1 - Math.pow(1 - p * 2, 3) : Math.pow(2 - p * 2, 3);
        scroller.scrollLeft = base + dir * 40 * e;
        if (p < 1) requestAnimationFrame(step); else hintDone = true;
      })(t0);
    };
    var hintObs = new IntersectionObserver(function (entries) {
      if (hintDone || entries[entries.length - 1].intersectionRatio < 0.3) return;
      hintObs.disconnect();
      runHint();
    }, { threshold: 0.3 });
    hintObs.observe(scroller);
  }

  var api = {
    update: update,
    // jump back to the start and re-sync the arrows (e.g. after filtering)
    reset: function () {
      if (glide) { cancelAnimationFrame(glide.raf); glide = null; }
      scroller.scrollLeft = 0;
      setTimeout(update, 100);
    }
  };
  scroller._cardScroller = api;
  return api;
}

// Auto-init every card scroller on the page (the rows sit far below the
// hero, so they are set up once it has painted)
document.addEventListener('DOMContentLoaded', function () {
  afterPaint(function () {
    document.querySelectorAll('[data-card-scroller]').forEach(function (el) {
      createCardScroller(el);
    });
  });
});




/**
 * CardFilter — companion component to CardScroller.
 *
 * A .project-filters chip group filters the scroller cards inside ITS
 * OWN <section> only (chips carry data-filter, cards carry data-tech,
 * "all" shows everything) and rewinds that section's scroller. Drop the
 * group into any section with a card scroller and it just works — no
 * ids, no extra JS.
 */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.project-filters').forEach(function (group) {
    var root = group.closest('section') || document;
    var btns = group.querySelectorAll('.filter-btn');
    var items = root.querySelectorAll('.rf-cards-scroller-item');
    var scroller = root.querySelector('[data-card-scroller]');
    if (!btns.length || !items.length) return;

    // the selected chip is said, not only shown in colour
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.classList.contains('active'))); });
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        var filter = btn.getAttribute('data-filter');
        items.forEach(function (item) {
          // data-tech may hold several space-separated categories
          var tags = (item.getAttribute('data-tech') || '').split(/\s+/);
          item.style.display = (filter === 'all' || tags.indexOf(filter) !== -1) ? '' : 'none';
        });
        if (scroller && scroller._cardScroller) scroller._cardScroller.reset();
      });
    });
  });
});

// Hero animation now handled by CSS (@keyframes heroFadeIn) — no GSAP needed

var currentYear = new Date().getFullYear();
document.getElementById('current-year').textContent = currentYear;


// Dynamic duration for Protollcall (current employer)
(function () {
  var el = document.getElementById('protollcall-duration');
  if (!el) return;
  var start = new Date(2024, 5, 1); // June 2024 (month is 0-indexed)
  var now = new Date();
  var years = now.getFullYear() - start.getFullYear();
  var months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  var parts = [];
  if (years > 0) parts.push(years + (years === 1 ? ' yr' : ' yrs'));
  if (months > 0) parts.push(months + (months === 1 ? ' mo' : ' mos'));
  el.textContent = parts.join(' ') || '1 mo';
})();


/**
 * Hero height lock + the one-shot block reveals.
 * Transform and opacity only, gated on motion preference.
 */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // (hero copy scroll-parallax removed — the page scrolls rigidly, so
  // nothing in the hero ever moves relative to anything else on scroll)

  // Freeze the hero's height. In-app browsers (Facebook/LINE) resize
  // the viewport on every toolbar collapse; a vh/svh-sized hero then
  // stretches and shrinks mid-scroll, shoving every section below it
  // up and down. Measure once, pin in px; re-measure only on a real
  // layout change (width change / rotation / drastic height change).
  var heroLock = document.getElementById('hero');
  if (heroLock) {
    var lockW = 0, lockH = 0;
    var lockHero = function () {
      var w = window.innerWidth;
      heroLock.style.height = '';
      heroLock.style.minHeight = '';
      var h = heroLock.getBoundingClientRect().height;
      if (h > 100) {
        lockW = w;
        lockH = h;
        heroLock.style.height = h + 'px';
        heroLock.style.minHeight = h + 'px';
      }
    };
    var maybeRelock = function () {
      // Relock ONLY on width changes (a real rotation always changes the
      // width). Height-only changes are toolbar churn — the exact thing
      // the pin exists to absorb — and transient innerHeight readings
      // during resizes have re-pinned the hero at the churned height.
      var w = window.innerWidth;
      if (!lockH || Math.abs(w - lockW) > 1) lockHero();
    };
    // pinned to the height it already has, so it can wait for the first paint
    afterPaint(function () { if (!lockH) lockHero(); });
    // Decide only once the viewport has SETTLED: mid-resize, innerWidth
    // and layout can read transient values that slip past the width
    // guard and re-pin the hero at a churned height. Debouncing means
    // transient readings are never sampled — a real rotation relocks
    // ~150ms after the storm ends, toolbar churn ends with the same
    // width and never relocks at all. (No orientationchange listener:
    // engines fire it on ANY viewport resize.)
    var relockTimer = null;
    window.addEventListener('resize', function () {
      if (relockTimer) clearTimeout(relockTimer);
      relockTimer = setTimeout(maybeRelock, 150);
    }, { passive: true });
  }

  // ---- Reveals: one short fade-and-rise per block, once ----
  // A block that starts below the fold waits at opacity 0 (.js-reveal) and
  // plays a single 12px rise as it comes in: never tied to the scroll
  // position, never replayed when you scroll back. An IntersectionObserver
  // starts it. In-app webviews have delivered those entries late, so a
  // light sweep on a timer also shows anything the scroll has already
  // carried past the line, and stops once nothing is left waiting.
  if (!reduce) {
    var lists = ['.section-title', '#resume .data-box', '#experience .data-box',
      '#portfolio .rf-cards-scroller-item', '.closing-cta .cta-inner'
    ].map(function (sel) { return document.querySelectorAll(sel); });
    // everything armed here starts below the fold, so arming waits for the
    // first paint, and all positions are read before any class is written
    afterPaint(function () {
      var pending = [], io = null, timer = 0;
      var line = function () { return window.innerHeight * 0.92; };
      lists.forEach(function (els) {
        for (var i = 0; i < els.length; i++) {
          if (els[i].getBoundingClientRect().top >= line()) pending.push(els[i]);
        }
      });
      if (!pending.length) return;
      var show = function (list) {
        var vw = window.innerWidth, vh = window.innerHeight, k = 0;
        var boxes = list.map(function (el) { return el.getBoundingClientRect(); });
        list.forEach(function (el, i) {
          var at = pending.indexOf(el), b = boxes[i];
          if (at < 0) return;
          pending.splice(at, 1);
          if (io) io.unobserve(el);
          el.classList.add('is-visible');
          // only what is on screen plays it (50ms apart, six at most);
          // a block the scroll already passed simply shows
          if (el.animate && b.bottom > 0 && b.top < vh && b.right > 0 && b.left < vw) {
            el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
              { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', delay: Math.min(k++, 5) * 50, fill: 'backwards' });
          }
        });
        if (!pending.length) { clearInterval(timer); if (io) io.disconnect(); }
      };
      pending.forEach(function (el) { el.classList.add('js-reveal'); });
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) {
          show(entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; }));
        }, { rootMargin: '0px 0px -8% 0px' });
        pending.forEach(function (el) { io.observe(el); });
      }
      timer = setInterval(function () {
        var y = line();
        show(pending.filter(function (el) { return el.getBoundingClientRect().top < y; }));
      }, 300);
    });
  }
})();

/**
 * Back-to-top — appears past the first viewport.
 */
(function () {
  var toTop = document.getElementById('back-to-top');
  if (!toTop) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // On a touch screen the button floats over what people tap (certificates,
  // FAQ rows), so there it shows only while they scroll back up
  var touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
  // (lastY is taken by the first update, after the first paint: reading the
  // scroll position here would lay out the whole page mid-script)
  var lastY = 0, upFrom = null;
  var ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY || 0;
    var show = y > window.innerHeight * 0.9;
    if (touch) {
      if (y < lastY - 2) { if (upFrom === null) upFrom = lastY; }
      else if (y > lastY + 2) upFrom = null;
      show = show && upFrom !== null && upFrom - y > 30;
    }
    lastY = y;
    toTop.classList.toggle('visible', show);
    // reading progress on the ring: how close the end of the page is
    var room = document.documentElement.scrollHeight - window.innerHeight;
    toTop.style.setProperty('--p', room > 0 ? Math.min(1, y / room).toFixed(4) : '0');
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  afterPaint(update); // hidden at the top of the page; measured once painted

  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
})();
/**
 * Hero constellation — his multi-agent systems as a living graph, and
 * one of the page's two moments. The intro plays once, then the nodes
 * drift slowly and an occasional signal crosses a link; six labeled
 * nodes (CRM/POS/ASR/TTS/LLM/IVR); a fine pointer gently repels nearby
 * nodes and links to them like a peer. Desktop: cluster on the right of
 * the copy. Mobile: around the copy. Pauses off-screen and in a hidden
 * tab; under reduced motion it is one still picture (kept painted, so a
 * purged canvas heals, but never moving).
 */
(function () {
  var canvas = document.getElementById('hero-net');
  if (!canvas || !canvas.getContext) return;
  // the 2D context is created with the first sizing: creating it restyles
  // and lays out the page, which the running script should not wait for
  var ctx = null;
  var labelsHost = document.getElementById('hero-net-labels');
  var hero = document.getElementById('hero');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  var W = 0, H = 0, DPR = 1;
  var CONNECT = 130, MOUSE_DIST = 120;
  var mouse = { x: -9999, y: -9999, active: false };

  // one ink for the whole graph, the accent #1264CE; depth comes from alpha
  var BLUE = { r: 18, g: 100, b: 206 };
  function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }
  // "compact" layout — phones AND iPads (≤1024px) get the graph
  // surrounding the copy; past iPad it's the desktop right-side field
  function isMobile() { return W < 1025; }
  var LABELS = ['CRM', 'POS', 'ASR', 'TTS', 'LLM', 'IVR'];
  var nodes = [], labelEls = [];
  var pulses = [], nextPulse = 0.9; // signals travelling along the links
  // The graph is laid out against these frozen dimensions — NOT the live
  // canvas size. In-app browser toolbars change the hero height on every
  // scroll; keying node positions to the live height made the whole
  // cluster breathe with it. Layout dims only re-adopt on a real width
  // change (rotation / window resize) or a drastic height change.
  var layoutW = 0, layoutH = 0;
  // which composition the graph was laid out for: desktop keeps it to the
  // right of the copy, phones put it in the band below
  var layoutMobile = null;

  // ── Big-bang intro: the whole graph starts as one clustered blob,
  // trembles harder and harder, then detonates outward — every node
  // overshoots to its home (Duolingo-inspired burst). ──
  var SHAKE_END = 0.5, EXPLODE_DUR = 0.5, INTRO_END = SHAKE_END + EXPLODE_DUR;
  var introCluster = null;
  // Intro plays in its own clock (time - introT0) so it can REPLAY:
  // iOS restores tabs from the back-forward cache without reloading,
  // which used to mean no intro at all on "reopening" the site.
  var introT0 = 0, replayQueued = false;
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) replayQueued = true;
  });
  function clusterPoint() {
    // the blob forms dead-center BEHIND the name, then detonates out
    if (copyRect) {
      return { x: (copyRect.x0 + copyRect.x1) / 2, y: (copyRect.y0 + copyRect.y1) / 2 };
    }
    return isMobile() ? { x: W * 0.5, y: H * 0.34 } : { x: W * 0.24, y: H * 0.46 };
  }
  function bounds() {
    var bw = layoutW || W, bh = layoutH || H;
    // Mobile: the graph SURROUNDS the copy (full canvas) — the keep-out
    // fade carves the text hole, so nodes ring the words instead of
    // pooling underneath them.
    return isMobile()
      ? { x0: bw * 0.06, x1: bw * 0.94, y0: bh * 0.06, y1: bh * 0.94 }
      : { x0: bw * 0.44, x1: bw * 0.97, y0: bh * 0.08, y1: bh * 0.92 };
  }
  // Where the breathing hairline starts — always OUTSIDE the copy
  // block (below it on phones, to its right on desktop) so the line
  // can never cross the text.
  function anchorPoint() {
    if (copyRect) {
      return isMobile()
        ? { x: (copyRect.x0 + copyRect.x1) / 2, y: copyRect.y1 + 30 }
        : { x: copyRect.x1 + 26, y: (copyRect.y0 + copyRect.y1) / 2 };
    }
    return isMobile() ? { x: W * 0.5, y: H * 0.55 } : { x: W * 0.36, y: H * 0.46 };
  }

  function makeNodes() {
    nodes = [];
    var b = bounds();
    var total = isMobile() ? 50 : 55;
    for (var i = 0; i < total; i++) {
      var special = i < LABELS.length;
      var x, y;
      if (special) { // seed specials on a loose ring so labels spread out
        // On mobile the labeled nodes stay in the band BELOW the copy —
        // anywhere else the keep-out fade would swallow their labels.
        var sb = isMobile()
          ? { x0: b.x0, x1: b.x1, y0: (layoutH || H) * 0.55, y1: (layoutH || H) * 0.92 }
          : b;
        var ang = (i / LABELS.length) * Math.PI * 2 + 0.5;
        var cx = (sb.x0 + sb.x1) / 2, cy = (sb.y0 + sb.y1) / 2;
        x = cx + Math.cos(ang) * (sb.x1 - sb.x0) * 0.3 + (Math.random() - 0.5) * 40;
        y = cy + Math.sin(ang) * (sb.y1 - sb.y0) * 0.32 + (Math.random() - 0.5) * 40;
      } else if (isMobile()) {
        // ambient nodes RING the copy: top band, left/right strips, and
        // the main field below — instead of uniform scatter (which puts
        // half of them behind the text where the keep-out erases them)
        var bw2 = layoutW || W, bh2 = layoutH || H, zone = Math.random();
        if (zone < 0.22) {        // above the copy
          x = bw2 * (0.06 + Math.random() * 0.88);
          y = bh2 * (0.04 + Math.random() * 0.10);
        } else if (zone < 0.34) { // left strip beside the copy
          x = bw2 * (0.02 + Math.random() * 0.07);
          y = bh2 * (0.14 + Math.random() * 0.40);
        } else if (zone < 0.46) { // right strip beside the copy
          x = bw2 * (0.91 + Math.random() * 0.07);
          y = bh2 * (0.14 + Math.random() * 0.40);
        } else {                  // the field below
          x = bw2 * (0.06 + Math.random() * 0.88);
          y = bh2 * (0.55 + Math.random() * 0.39);
        }
      } else {
        x = b.x0 + ((Math.random() + Math.random()) / 2) * (b.x1 - b.x0);
        y = b.y0 + Math.random() * (b.y1 - b.y0);
      }
      // Organic drift: each node breathes around its home point on two
      // layered sines with incommensurate frequencies — a Lissajous
      // wander that never visibly repeats and is a pure function of time
      // (frame-rate independent, perfectly smooth). Slow and small, so
      // the graph reads as calm at a glance and alive when watched.
      var dir = Math.random() * Math.PI * 2;
      nodes.push({
        // home as FRACTIONS of the hero size — recomputed every frame,
        // so the graph tracks container resizes continuously (iOS
        // delivers resize events late during scroll; fractions don't care)
        fx: x / (layoutW || W), fy: y / (layoutH || H),
        x: x, y: y,
        // a calm drift: a few px either way, a slow cycle (25 to 40s)
        a1: (special ? 6 : 9) + Math.random() * (special ? 5 : 9),
        a2: 3 + Math.random() * 4,
        f1: 0.16 + Math.random() * 0.1,
        f2: 0.3 + Math.random() * 0.16,
        p1: Math.random() * Math.PI * 2,
        p2: Math.random() * Math.PI * 2,
        p3: Math.random() * Math.PI * 2,
        p4: Math.random() * Math.PI * 2,
        // entrance: fly in from this direction, staggered by index
        ix: Math.cos(dir), iy: Math.sin(dir),
        st: i * 0.035 + Math.random() * 0.1,
        iv: 0,
        r: special ? 7 : (2.5 + Math.random() * 2),
        px: 0, py: 0,
        special: special, label: special ? LABELS[i] : null
      });
    }
    pulses = [];
    introCluster = null; // re-pick on relayout (only matters mid-intro)
  }

  function makeLabels() {
    if (!labelsHost) return;
    labelsHost.innerHTML = '';
    labelEls = [];
    LABELS.forEach(function (text) {
      var el = document.createElement('div');
      el.className = 'hero-net-label';
      el.textContent = text;
      // kept out of layout until the first frame places it (it starts
      // hidden there anyway), so it never jumps in from the corner
      el.style.display = 'none';
      labelsHost.appendChild(el);
      labelEls.push(el);
    });
  }

  // Keep-out zone: nodes and lines shrink as they approach the copy
  // block and vanish just before touching it.
  var copyEl = hero.querySelector('.hero-copy');
  var copyRect = null;
  function updateCopyRect() {
    if (!copyEl) { copyRect = null; return; }
    // Use untransformed offset geometry. getBoundingClientRect bakes in
    // the scroll-parallax translate — when an in-app browser fires
    // resize mid-scroll (toolbar collapse), that poisoned the keep-out
    // zone onto the cluster and hid nearly every node.
    var top = 0, left = 0, el = copyEl;
    while (el && el !== hero && el.offsetParent) {
      top += el.offsetTop;
      left += el.offsetLeft;
      el = el.offsetParent;
    }
    if (el === hero) {
      copyRect = { x0: left, y0: top, x1: left + copyEl.offsetWidth, y1: top + copyEl.offsetHeight };
      return;
    }
    // fallback (unexpected DOM): old behaviour
    var hr = hero.getBoundingClientRect();
    var cr = copyEl.getBoundingClientRect();
    copyRect = { x0: cr.left - hr.left, y0: cr.top - hr.top, x1: cr.right - hr.left, y1: cr.bottom - hr.top };
  }
  // 1 = fully visible, 0 = gone near the text block. Compact layouts
  // use a shorter ramp — the strips above/beside the copy are narrow,
  // and the long desktop ramp would swallow them entirely.
  function fadeAt(x, y) {
    if (!copyRect) return 1;
    var dx = Math.max(copyRect.x0 - x, 0, x - copyRect.x1);
    var dy = Math.max(copyRect.y0 - y, 0, y - copyRect.y1);
    var d = Math.sqrt(dx * dx + dy * dy);
    var m = isMobile() ? 26 : 30;
    var ramp = isMobile() ? 84 : 130;
    return Math.max(0, Math.min(1, (d - m) / ramp));
  }

  function resize() {
    // Until the stylesheet lands the canvas is still in the hero's flow:
    // sized then, it stands a screen tall and the page jumps when it leaves
    // the flow (a layout shift of ~1). The loader covers the page until the
    // stylesheet applies, so nothing is lost by waiting; the loop retries.
    if (getComputedStyle(canvas).position !== 'absolute') return;
    var rect = hero.getBoundingClientRect();
    // WKWebViews (e.g. Facebook's in-app browser) can report a transient
    // 0-sized rect mid-layout — retry instead of building degenerate state
    if (rect.width < 10 || rect.height < 10) {
      requestAnimationFrame(resize);
      return;
    }
    W = rect.width;
    H = rect.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var bw = Math.round(W * DPR), bh = Math.round(H * DPR);
    // Setting canvas.width WIPES the bitmap even when the value is
    // unchanged — a resize() storm (Firefox reports fractional sizes
    // that oscillate) then flashes blank frames. Only realloc when the
    // bitmap really changes, and repaint in the same tick so there is
    // never a blank gap on screen.
    var bitmapChanged = canvas.width !== bw || canvas.height !== bh;
    if (bitmapChanged) {
      canvas.width = bw;
      canvas.height = bh;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    }
    // exact device-pixel mapping — fractional DPRs (Windows 125%/150%)
    // otherwise leave thin lines shimmering between pixels
    if (!ctx) ctx = canvas.getContext('2d');
    ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
    updateCopyRect();
    if (!nodes.length) {
      layoutW = W;
      layoutH = H;
      layoutMobile = isMobile();
      makeNodes();
    } else if (isMobile() !== layoutMobile) {
      // crossed between the desktop and phone compositions: stretching the
      // old layout left a desktop graph crowded into the right of a phone,
      // so lay it out afresh and let it burst into its new place
      layoutW = W;
      layoutH = H;
      layoutMobile = isMobile();
      makeNodes();
      replayQueued = true;
    } else if (Math.abs(W - layoutW) > 1 || Math.abs(H - layoutH) > layoutH * 0.25) {
      // real layout change (rotation, desktop window resize) — re-anchor;
      // toolbar-sized height churn is deliberately ignored
      layoutW = W;
      layoutH = H;
    }
    // (until the loop has drawn once there is no picture to keep)
    if (bitmapChanged && nodes.length && painted) drawFrame(lastDrawT);
  }

  if (finePointer && !reduce) {
    hero.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = true;
    }, { passive: true });
    hero.addEventListener('mouseleave', function () {
      mouse.active = false; mouse.x = -9999; mouse.y = -9999;
    });
  }
  window.addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { resize(); }).observe(hero);
  }
  window.addEventListener('load', function () {
    afterPaint(function () { updateCopyRect(); resize(); });
  }, { passive: true });
  // web fonts can reflow the copy block after first paint (asking for
  // fonts.ready lays out the page, so that waits for the first paint too)
  if (document.fonts && 'ready' in document.fonts) {
    afterPaint(function () {
      document.fonts.ready.then(function () { afterPaint(updateCopyRect); });
    });
  }
  // iOS/WKWebView can purge a canvas backing store while the page is
  // hidden or restored from the back-forward cache — repaint on return
  // (the first pageshow of a fresh load has nothing to repaint yet: it
  // only re-checks the size once the page has painted)
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) resize(); else afterPaint(resize);
  }, { passive: true });
  // a hidden tab draws nothing; back in view it repaints and carries on
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; return; }
    resize();
    var r = hero.getBoundingClientRect();
    if (!running && r.bottom > 0 && r.top < window.innerHeight) { running = true; requestAnimationFrame(loop); }
  });

  function drawFrame(time) {
    if (!ctx) return; // not sized yet
    painted = true;
    ctx.clearRect(0, 0, W, H);
    var ampScale = Math.max(1, Math.min(W / 1100, 2));
    // The blob lives BEHIND the name, so the keep-out fade is suspended
    // during the shake and blends back in while the nodes fly out.
    var it = time - introT0; // intro-relative clock (replayable)
    var koBlend = reduce ? 1 : Math.min(Math.max((it - SHAKE_END) / EXPLODE_DUR, 0), 1);

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      // layered-sine wander around the fractional home point;
      // amplitudes scale with the hero so 2K screens feel as alive
      // as phones (fixed px reads tiny on a wide canvas)
      var A = ampScale;
      n.x = n.fx * layoutW + A * (n.a1 * Math.sin(time * n.f1 + n.p1) + n.a2 * Math.sin(time * n.f2 + n.p2));
      n.y = n.fy * layoutH + A * (n.a1 * Math.cos(time * n.f1 * 0.83 + n.p3) + n.a2 * Math.sin(time * n.f2 * 1.27 + n.p4));

      // entrance: cluster → violent shake → detonation (skipped under
      // reduced motion). Deterministic per-node phases keep it smooth.
      if (reduce || it >= INTRO_END) {
        n.iv = 1;
      } else {
        if (!introCluster) introCluster = clusterPoint();
        var cox = n.ix * (5 + n.r * 2.2); // tight per-node spot in the blob
        var coy = n.iy * (5 + n.r * 2.2);
        var jx = Math.sin(time * 43 + n.p1 * 7);
        var jy = Math.cos(time * 39 + n.p2 * 7);
        if (it < SHAKE_END) {
          // wind-up: trembling ramps to a violent shake
          var w = it / SHAKE_END;
          var amp = 1.5 + w * w * w * 24;
          n.x = introCluster.x + cox + jx * amp;
          n.y = introCluster.y + coy + jy * amp;
          n.iv = Math.min(it / 0.25, 1) * 0.75; // dim enough to read the name through
        } else {
          // detonation: overshoot out to the homes computed above
          var ep = (it - SHAKE_END) / EXPLODE_DUR;
          var eb = 1 + 2.70158 * Math.pow(ep - 1, 3) + 1.70158 * Math.pow(ep - 1, 2); // easeOutBack
          var res = (1 - ep) * 6; // shake residue dies out mid-flight
          n.x = introCluster.x + cox + (n.x - introCluster.x - cox) * eb + jx * res;
          n.y = introCluster.y + coy + (n.y - introCluster.y - coy) * eb + jy * res;
          n.iv = 0.85 + 0.15 * ep;
        }
      }

      var tx = 0, ty = 0;
      if (mouse.active) {
        var dxm = n.x - mouse.x, dym = n.y - mouse.y;
        var dm = Math.sqrt(dxm * dxm + dym * dym);
        if (dm < MOUSE_DIST && dm > 0.001) {
          var f = 1 - dm / MOUSE_DIST;
          f *= f;
          tx = (dxm / dm) * f * 34;
          ty = (dym / dm) * f * 34;
        }
      }
      n.px += (tx - n.px) * 0.08;
      n.py += (ty - n.py) * 0.08;
      // how visible this node is near the copy block (0 gone → 1 full);
      // keep-out is suspended while the intro blob sits behind the name
      var fk = fadeAt(n.x + n.px, n.y + n.py);
      n.f = (koBlend < 1 ? (1 - koBlend) + koBlend * fk : fk) * n.iv;
    }

    // detonation moment: an expanding shockwave ring (silent: the page
    // never makes a sound the visitor did not ask for)
    if (!reduce && introCluster && it >= SHAKE_END && it < SHAKE_END + 0.7) {
      var rp = (it - SHAKE_END) / 0.7;
      ctx.strokeStyle = rgba(BLUE, (1 - rp) * 0.35);
      ctx.lineWidth = 2 - rp;
      ctx.beginPath();
      ctx.arc(introCluster.x, introCluster.y, 10 + rp * rp * 340, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // signals: now and then one dot travels a link — the system talking
    if (!reduce && it > 1.4) {
      if (time >= nextPulse && !pulses.length) {
        var A = nodes[(Math.random() * nodes.length) | 0];
        if (A && A.f > 0.35) {
          var B = null, bd = Infinity;
          for (var q = 0; q < nodes.length; q++) {
            var nq = nodes[q];
            if (nq === A || nq.f <= 0.35) continue;
            var qdx = nq.x - A.x, qdy = nq.y - A.y;
            var qd = qdx * qdx + qdy * qdy;
            if (qd < CONNECT * CONNECT * 4 && qd > 400 && Math.random() < 0.4 && qd < bd) { bd = qd; B = nq; }
          }
          if (B) pulses.push({ a: A, b: B, t0: time, dur: 1.6 + Math.random() * 0.6 });
        }
        nextPulse = time + 2.5 + Math.random() * 2;
      }
      pulses = pulses.filter(function (p) { return time - p.t0 < p.dur; });
    }

    // connections (clearer than the classic treatment: alpha up to 0.3)
    ctx.lineWidth = 1;
    for (var a = 0; a < nodes.length; a++) {
      var na = nodes[a];
      if (na.f <= 0.02) continue;
      var ax = na.x + na.px, ay = na.y + na.py;
      for (var c = a + 1; c < nodes.length; c++) {
        var nc = nodes[c];
        var lf = Math.min(na.f, nc.f);
        if (lf <= 0.02) continue;
        var bx = nc.x + nc.px, by = nc.y + nc.py;
        var dx = ax - bx, dy = ay - by;
        var d2 = dx * dx + dy * dy;
        if (d2 < CONNECT * CONNECT) {
          var d = Math.sqrt(d2);
          ctx.strokeStyle = rgba(BLUE, (1 - d / CONNECT) * 0.26 * lf);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
      }
      if (mouse.active) { // the cursor joins the graph as a peer
        var dxc = ax - mouse.x, dyc = ay - mouse.y;
        var dc2 = dxc * dxc + dyc * dyc;
        if (dc2 < CONNECT * CONNECT) {
          ctx.strokeStyle = rgba(BLUE, (1 - Math.sqrt(dc2) / CONNECT) * 0.14 * na.f);
          ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(ax, ay); ctx.stroke();
        }
      }
    }

    // hairline from the copy block to the nearest node, steady
    var anchor = anchorPoint();
    var nearest = null, best = Infinity;
    for (var k = 0; k < nodes.length; k++) {
      var nk = nodes[k];
      if (nk.f < 0.5) continue; // only link to a clearly visible node
      var ddx = nk.x + nk.px - anchor.x, ddy = nk.y + nk.py - anchor.y;
      var dd = ddx * ddx + ddy * ddy;
      if (dd < best) { best = dd; nearest = nk; }
    }
    if (nearest) {
      ctx.strokeStyle = rgba(BLUE, 0.12);
      ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(nearest.x + nearest.px, nearest.y + nearest.py); ctx.stroke();
    }

    // nodes: solid cores; the six labelled ones get a hairline ring, no halo;
    // near the copy block they shrink with their fade and disappear
    // (labels stay hidden until just after the detonation — a crowd of
    // words inside the shaking blob would be noise)
    var labelGate = (reduce || it >= SHAKE_END + 0.45) ? 1
      : (it <= SHAKE_END ? 0 : (it - SHAKE_END) / 0.45);
    var li = 0;
    for (var m = 0; m < nodes.length; m++) {
      var nm = nodes[m];
      var nx = nm.x + nm.px, ny = nm.y + nm.py;
      var f = nm.f;
      if (nm.special) {
        var el = labelEls[li++];
        if (el) {
          el.style.left = nx + 'px';
          el.style.top = ny + 'px';
          el.style.opacity = String(f * labelGate);
          if (el.style.display) el.style.display = '';
        }
        if (f <= 0.02) continue;
        var r = nm.r * (0.35 + 0.65 * f);
        ctx.strokeStyle = rgba(BLUE, 0.25 * f);
        ctx.beginPath(); ctx.arc(nx, ny, r + 4 * f, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = rgba(BLUE, 0.95 * f);
        ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(251,251,253,' + (0.95 * f) + ')';
        ctx.beginPath(); ctx.arc(nx, ny, 2.4 * f, 0, Math.PI * 2); ctx.fill();
      } else {
        if (f <= 0.02) continue;
        ctx.fillStyle = rgba(BLUE, 0.7 * f);
        ctx.beginPath(); ctx.arc(nx, ny, nm.r * (0.35 + 0.65 * f), 0, Math.PI * 2); ctx.fill();
      }
    }

    // draw travelling signals on top
    for (var s = 0; s < pulses.length; s++) {
      var pu = pulses[s];
      var pr = (time - pu.t0) / pu.dur;
      if (pr < 0 || pr > 1) continue;
      var pe = pr < 0.5 ? 2 * pr * pr : 1 - Math.pow(-2 * pr + 2, 2) / 2; // easeInOut
      var sx = pu.a.x + pu.a.px + (pu.b.x + pu.b.px - pu.a.x - pu.a.px) * pe;
      var sy = pu.a.y + pu.a.py + (pu.b.y + pu.b.py - pu.a.y - pu.a.py) * pe;
      var sa = Math.sin(Math.PI * pr) * Math.min(pu.a.f, pu.b.f) * fadeAt(sx, sy);
      if (sa <= 0.02) continue;
      ctx.fillStyle = rgba(BLUE, 0.9 * sa);
      ctx.beginPath(); ctx.arc(sx, sy, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * sa).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(sx, sy, 1.1, 0, Math.PI * 2); ctx.fill();
    }
  }

  var running = false, t0 = null, lastDrawT = 0.01, lastPaintTs = 0, lastTs = 0;
  var curtainUp = false, painted = false;
  function loop(ts) {
    if (!running) return;
    if (t0 === null) t0 = ts;
    // a pause (off screen, hidden tab) holds the clock, so the graph
    // carries on from where it stopped instead of jumping ahead
    if (lastTs && ts - lastTs > 100) t0 += ts - lastTs;
    lastTs = ts;
    // Hold the intro clock at zero until the page loader curtain lifts —
    // otherwise the cluster/shake plays hidden behind the overlay and
    // visitors only catch the tail of the explosion.
    var held = false;
    if (!curtainUp) {
      var curtain = document.querySelector('.loader');
      if (curtain && parseFloat(getComputedStyle(curtain).opacity) > 0.5) { t0 = ts; held = true; }
      else { curtainUp = true; }
    }
    // iOS batches resize events until scroll momentum ends; catch the
    // container changing size the moment it happens instead
    // (tolerance 2px: fractional-layout jitter must not trigger it)
    if (Math.abs(hero.clientWidth - W) > 2 || Math.abs(hero.clientHeight - H) > 2) resize();
    // While the clock is held at zero every node is still fully transparent
    // and the canvas is blank, so after one cleared frame there is nothing
    // to draw until the curtain lifts (the blob's spot is still taken now)
    if (held && painted && nodes.length) {
      if (!introCluster) introCluster = clusterPoint();
      lastDrawT = 0;
      requestAnimationFrame(loop);
      return;
    }
    // Under reduced motion the clock stands still: the same picture every
    // time, no intro, no drift, no signals. It is still repainted four
    // times a second, which keeps the canvas backing store alive on
    // iOS/WKWebView and heals a purged bitmap.
    if (reduce) {
      if (painted && ts - lastPaintTs < 250) { requestAnimationFrame(loop); return; }
      lastPaintTs = ts;
      drawFrame(lastDrawT = 0);
      requestAnimationFrame(loop);
      return;
    }
    lastDrawT = (ts - t0) / 1000;
    if (replayQueued) { // bfcache reopen: restart the intro on this clock
      replayQueued = false;
      introT0 = lastDrawT;
      introCluster = null;
    }
    drawFrame(lastDrawT);
    requestAnimationFrame(loop);
  }

  makeLabels();
  // first sizing: the ResizeObserver's initial report, or the loop's size
  // check on its first frame, whichever comes first — not here, where it
  // would force a layout of the whole page while the script is running
  if (!('ResizeObserver' in window)) resize();

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      // entries arrive oldest-first and browsers (Firefox especially)
      // batch several per callback — always act on the newest state
      var vis = entries[entries.length - 1].isIntersecting;
      if (vis && !running) { running = true; requestAnimationFrame(loop); }
      else if (!vis) { running = false; }
    }, { threshold: 0 });
    io.observe(hero);
    // watchdog: if the observer ever leaves us stopped while the hero is
    // actually on screen (batched/stale entries), restart on scroll
    window.addEventListener('scroll', function () {
      if (!running) {
        var r = hero.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) {
          running = true;
          requestAnimationFrame(loop);
        }
      }
    }, { passive: true });
  } else {
    running = true;
    requestAnimationFrame(loop);
  }
})();

/**
 * BizCard — Apple Card-style 3D tilt, the page's other moment. It tilts
 * only toward a pointer or a finger (a few degrees) and eases back flat
 * when that leaves or lifts; with nothing pointing at it the card lies
 * still and no frame is drawn. Skipped entirely under reduced motion.
 */
(function () {
  var card = document.getElementById('biz-card');
  var scene = document.getElementById('biz-scene');
  if (!card || !scene) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // the card is fully readable standing still

  var raf = null, tx = 0, ty = 0, cx = 0, cy = 0;
  function frame() {
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    if (!tx && !ty && Math.abs(cx) < 0.05 && Math.abs(cy) < 0.05) {
      cx = cy = 0;
      card.style.transform = '';
      raf = null;
      return;
    }
    card.style.transform = 'rotateY(' + cx.toFixed(2) + 'deg) rotateX(' + cy.toFixed(2) + 'deg)';
    raf = requestAnimationFrame(frame);
  }
  function go() { if (!raf) raf = requestAnimationFrame(frame); }
  function aim(e) {
    var r = scene.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 12;   // ±6deg
    ty = -((e.clientY - r.top) / r.height - 0.5) * 8;   // ±4deg
    go();
  }
  function rest(e) {
    if (e.type === 'pointerup' && e.pointerType === 'mouse') return; // still over it
    tx = ty = 0;
    go();
  }
  scene.addEventListener('pointermove', aim, { passive: true });
  scene.addEventListener('pointerdown', aim, { passive: true });
  ['pointerleave', 'pointerup', 'pointercancel'].forEach(function (t) {
    scene.addEventListener(t, rest, { passive: true });
  });
})();

/**
 * BizCard glass light — the glare stands where the pointer or the finger
 * is. CSS draws the light; this only tells it where to stand.
 */
(function () {
  var card = document.getElementById('biz-card');
  if (!card) return;
  function light(e) {
    var r = card.getBoundingClientRect();
    card.style.setProperty('--lx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--ly', (e.clientY - r.top) + 'px');
  }
  card.addEventListener('pointermove', light, { passive: true });
  card.addEventListener('pointerdown', light, { passive: true });
})();

/**
 * Small rewards. On a computer an email address or phone number is copied
 * when clicked (a phone link there has nothing to dial; a mail link still
 * opens the mail app), and the CV and the contact card say they are on
 * their way. One quiet toast, announced politely to screen readers.
 */
(function () {
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  var check = document.createElement('span');
  check.className = 'toast-check';
  check.setAttribute('aria-hidden', 'true');
  var text = document.createElement('span');
  text.className = 'toast-text';
  toast.appendChild(check);
  toast.appendChild(text);
  document.body.appendChild(toast);
  var hideTimer = null;
  function show(msg) {
    text.textContent = msg;
    toast.classList.add('is-shown');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { toast.classList.remove('is-shown'); }, 2400);
  }
  window._toast = show;

  var desk = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (/\.pdf$/i.test(href)) { show('Downloading the CV'); return; }
    if (/\.vcf$/i.test(href)) { if (desk && desk.matches) show('Contact card downloaded'); return; }
    var m = /^(mailto|tel):([^?]+)/i.exec(href);
    if (!m || !desk || !desk.matches || !navigator.clipboard) return;
    var tel = m[1].toLowerCase() === 'tel';
    var shown = (a.querySelector('.info-value') || a).textContent.trim();
    var value = tel && /^\+?[\d\s-]{6,}$/.test(shown) ? shown : decodeURIComponent(m[2]);
    if (tel) e.preventDefault();
    navigator.clipboard.writeText(value).then(function () {
      show((tel ? 'Phone number copied: ' : 'Email copied: ') + value);
    }, function () {});
  });
})();

/**
 * The foot of an experience sheet leads on: close it, then go to Contact
 * once the sheet's history entry is gone (or the browser would put the
 * scroll back where the sheet was opened).
 */
document.addEventListener('click', function (e) {
  var link = e.target.closest && e.target.closest('.exp-sheet-link');
  if (!link) return;
  e.preventDefault();
  var close = document.querySelector('.exp-lightbox.open .exp-lightbox-close');
  if (close) close.click();
  overlayHistory.afterSettle(function () {
    var target = document.getElementById('contact');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
});
