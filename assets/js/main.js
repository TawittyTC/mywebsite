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
   * Preloader — removed on load, but no later than 2s from navigation start
   */
  // let preloader = select("#preloader");
  let preloader = select(".loader");
  if (preloader) {
    let done = false;
    const hideLoader = () => {
      if (done) return;
      done = true;
      preloader.style.transition = 'opacity 0.25s';
      preloader.style.opacity = '0';
      setTimeout(() => { if (preloader.parentNode) preloader.remove(); }, 260);
    };
    window.addEventListener("load", hideLoader);
    // Failsafe: never block the page for more than 2s from navigation start
    setTimeout(hideLoader, Math.max(0, 2000 - performance.now()));
  }

  /**
   * Hero type effect — native (replaces Typed.js, saves 11KB)
   */
  const typedEl = select(".typed");
  if (typedEl) {
    const items = typedEl.getAttribute("data-typed-items").split(",").map(s => s.trim());
    let i = 0, j = 0, deleting = false;
    function typeTick() {
      const cur = items[i];
      typedEl.textContent = cur.slice(0, j);
      if (!deleting) {
        j++;
        if (j > cur.length) { deleting = true; setTimeout(typeTick, 2000); return; }
      } else {
        j--;
        if (j < 0) { j = 0; deleting = false; i = (i + 1) % items.length; }
      }
      setTimeout(typeTick, deleting ? 50 : 100);
    }
    typeTick();
  }


})();



// Cert lightbox
(function () {
  const lightbox = document.createElement("div");
  lightbox.className = "cert-lightbox";
  const lbImg = document.createElement("img");
  const closeBtn = document.createElement("button");
  closeBtn.className = "cert-lightbox-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "&#x2715;";
  lightbox.appendChild(lbImg);
  lightbox.appendChild(closeBtn);
  document.body.appendChild(lightbox);

  function openLightbox(src, alt) {
    lbImg.src = src;
    lbImg.alt = alt;
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    if (!lightbox.classList.contains("open")) return; // Escape pressed elsewhere
    lightbox.classList.remove("open");
    // only release the scroll lock if no other overlay is holding it
    if (!document.querySelector(".exp-lightbox.open")) document.body.style.overflow = "";
  }
  closeBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLightbox();
  });

  window._certLightboxOpen = openLightbox;
})();

// Experience details lightbox (text modal)
(function () {
  const lightbox = document.createElement('div');
  lightbox.className = 'exp-lightbox';
  const inner = document.createElement('div');
  inner.className = 'exp-lightbox-inner';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'exp-lightbox-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&#x2715;';
  inner.appendChild(closeBtn);
  lightbox.appendChild(inner);
  document.body.appendChild(lightbox);

  function closeExp() {
    if (!lightbox.classList.contains('open')) return; // Escape pressed elsewhere
    lightbox.classList.remove('open');
    setTimeout(function () {
      // deferred for the exit animation — but by now another overlay
      // (cert lightbox) may have opened and taken the scroll lock
      if (!lightbox.classList.contains('open') &&
          !document.querySelector('.cert-lightbox.open')) {
        document.body.style.overflow = '';
      }
    }, 220);
  }
  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    closeExp();
  });
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeExp();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeExp();
  });

  window._expLightboxOpen = function (html) {
    while (inner.children.length > 1) inner.removeChild(inner.lastChild);
    const content = document.createElement('div');
    content.innerHTML = html;
    inner.appendChild(content);
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Initialize client filter chips
    var chips = inner.querySelectorAll('.exp-filter-chip');
    var sections = inner.querySelectorAll('.exp-client-section');
    if (chips.length && sections.length) {
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          var filter = chip.dataset.filter;
          chips.forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          sections.forEach(function (s) {
            s.style.display = (filter === 'all' || s.dataset.client === filter) ? '' : 'none';
          });
        });
      });
      // Hint animation: bounce non-"All" chips after modal opens
      setTimeout(function () {
        var delay = 0;
        chips.forEach(function (chip) {
          if (chip.dataset.filter === 'all') return;
          setTimeout(function () {
            chip.classList.add('hint');
            chip.addEventListener('animationend', function () { chip.classList.remove('hint'); }, { once: true });
          }, delay);
          delay += 70;
        });
      }, 450);
    }
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
    // Update stat number + data-count for count-up
    var statSpan = document.querySelector('[data-exp="protollcall"] .exp-stat-clients');
    if (statSpan) { statSpan.dataset.count = clientCount; statSpan.textContent = clientCount; }
    // Update highlight badge
    var badge = document.querySelector('[data-exp="protollcall"] .exp-client-count-badge');
    if (badge) badge.textContent = clientCount + ' Clients';
    // Update paragraph text
    var para = document.querySelector('[data-exp="protollcall"] .js-client-count-text');
    if (para) para.textContent = clientCount;
  }

  document.querySelectorAll('#experience .data-box[data-exp]').forEach(function (card) {
    card.addEventListener('click', function () {
      var tmpl = document.getElementById('exp-' + card.dataset.exp);
      if (tmpl) window._expLightboxOpen(tmpl.innerHTML);
    });
  });

  // ── Count-up animation for stat numbers ──
  function countUp(el) {
    var target = parseInt(el.dataset.count, 10);
    if (isNaN(target) || target <= 0) return;
    var dur = 700, t0 = performance.now();
    el.textContent = '0';
    (function step(now) {
      var p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) requestAnimationFrame(step);
    }(performance.now()));
  }

  // ── Card stagger + count-up when card enters viewport ──
  var expCards = Array.from(document.querySelectorAll('#experience .data-box[data-exp]'));
  if ('IntersectionObserver' in window) {
    var cardObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var idx = expCards.indexOf(entry.target);
        entry.target.style.animationDelay = (idx * 80) + 'ms';
        entry.target.classList.add('card-visible');
        var btn = entry.target.querySelector('.exp-card-btn');
        if (btn) setTimeout(function () { btn.classList.add('hint-loop'); }, idx * 80 + 400);
        var countEls = entry.target.querySelectorAll('.js-count[data-count]');
        if (countEls.length) setTimeout(function () { countEls.forEach(countUp); }, idx * 80 + 300);
        cardObs.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    expCards.forEach(function (card) { cardObs.observe(card); });
  } else {
    expCards.forEach(function (card) {
      card.classList.add('card-visible');
      card.querySelectorAll('.js-count[data-count]').forEach(countUp);
    });
  }
});

// Certificate grid: the DOM is built immediately so the page has its
// final length from the start (deferring it made the page grow ~4000px
// mid-scroll — the scrollbar jumped). Only the IMAGES stay lazy.
document.addEventListener("DOMContentLoaded", function () {
  const imagesList = document.getElementById("images-list");
  if (!imagesList) return;

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
      const alt = "Tanapol Certificate " + i;
      imgElement.src = src;
      imgElement.className = "img-fluid";
      imgElement.alt = alt;
      imgElement.loading = "lazy";
      imgElement.draggable = false;
      const expandBtn = document.createElement("button");
      expandBtn.className = "cert-expand-btn";
      expandBtn.setAttribute("aria-label", "View certificate fullscreen");
      expandBtn.innerHTML = "+";
      expandBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        window._certLightboxOpen(src, alt);
      });
      card.style.cursor = "pointer";
      card.addEventListener("click", function () {
        window._certLightboxOpen(src, alt);
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

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      scroller.scrollBy({ left: -step, behavior: 'smooth' });
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      scroller.scrollBy({ left: step, behavior: 'smooth' });
    });
  }
  scroller.addEventListener('scroll', update, { passive: true });
  window.addEventListener('load', update); // re-sync once images have sized the row
  update();
  setTimeout(update, 500);

  // Mobile: nudge the row left-and-back every few seconds to hint that
  // it scrolls horizontally; pause while (and shortly after) the user
  // interacts, and fire the first hint when the row enters the viewport.
  if (window.innerWidth <= 1024) {
    var hintDistance = 80;
    var duration = 250;
    var userScrolling = false;
    var isAnimating = false;
    var scrollEndTimer = null;
    var hintInterval = null;

    var easeInOut = function (t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    };

    var runHint = function () {
      if (userScrolling || isAnimating) return;
      var maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      var atRightEnd = scroller.scrollLeft >= maxScrollLeft - 1;
      var dir = atRightEnd ? -1 : 1;
      isAnimating = true;
      var baseScroll = scroller.scrollLeft;
      var fwdStart = performance.now();
      function forward(ts) {
        if (userScrolling) { isAnimating = false; return; }
        var p = Math.min((ts - fwdStart) / duration, 1);
        scroller.scrollLeft = baseScroll + dir * hintDistance * easeInOut(p);
        if (p < 1) { requestAnimationFrame(forward); return; }
        var bkStart = performance.now();
        function back(ts2) {
          if (userScrolling) { isAnimating = false; return; }
          var p2 = Math.min((ts2 - bkStart) / duration, 1);
          scroller.scrollLeft = baseScroll + dir * hintDistance * (1 - easeInOut(p2));
          if (p2 < 1) { requestAnimationFrame(back); return; }
          isAnimating = false;
        }
        requestAnimationFrame(back);
      }
      requestAnimationFrame(forward);
    };

    var startHintLoop = function () {
      clearInterval(hintInterval);
      hintInterval = setInterval(runHint, 3000);
    };

    var onUserScroll = function () {
      if (isAnimating) return;
      userScrolling = true;
      clearInterval(hintInterval);
      hintInterval = null;
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(function () {
        userScrolling = false;
        startHintLoop();
      }, 10000);
    };

    scroller.addEventListener('touchstart', onUserScroll, { passive: true });
    scroller.addEventListener('scroll', onUserScroll, { passive: true });

    var hintStarted = false;
    var hintObs = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; }) && !hintStarted) {
        hintStarted = true;
        hintObs.disconnect();
        runHint();
        startHintLoop();
      }
    }, { threshold: 0.3 });
    hintObs.observe(scroller);
  }

  var api = {
    update: update,
    // jump back to the start and re-sync the arrows (e.g. after filtering)
    reset: function () {
      scroller.scrollLeft = 0;
      setTimeout(update, 100);
    }
  };
  scroller._cardScroller = api;
  return api;
}

// Auto-init every card scroller on the page
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-card-scroller]').forEach(function (el) {
    createCardScroller(el);
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

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
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

// Scroll hint: nudge project cards on mobile to hint horizontal scroll
window.addEventListener('load', function() {
  if (window.innerWidth > 1024) return;
  var scroller = document.getElementById('scroller');
  if (!scroller) return;
  scroller.classList.add('scroll-hint');
  scroller.addEventListener('animationend', function() {
    scroller.classList.remove('scroll-hint');
  }, { once: true });
});


// Experience expand/collapse
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.exp-body').forEach(function (body) {
    var btn = body.nextElementSibling;
    if (!btn || !btn.classList.contains('exp-toggle')) return;
    // If content fits within max-height, remove restriction and hide button
    if (body.scrollHeight <= 105) {
      body.style.maxHeight = 'none';
      body.style.maskImage = 'none';
      body.style.webkitMaskImage = 'none';
      btn.hidden = true;
      return;
    }
    btn.addEventListener('click', function () {
      var open = body.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.querySelector('.exp-lbl').textContent = open ? 'See less' : 'See more';
    });
  });

  // Hint animation: bounce chevron when card first enters viewport
  if ('IntersectionObserver' in window) {
    var hintObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var btn = entry.target.querySelector('.exp-toggle:not([hidden])');
        if (btn && !btn.classList.contains('open')) {
          btn.classList.add('hint');
          btn.addEventListener('animationend', function () {
            btn.classList.remove('hint');
          }, { once: true });
        }
        hintObs.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('#experience .data-box').forEach(function (box) {
      hintObs.observe(box);
    });
  }
});

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
  if (months > 0) parts.push(months + (months === 1 ? ' month' : ' months'));
  el.textContent = parts.join(' ') || '1 month';
})();


/**
 * Hero motion — copy scroll drift/fade + scroll reveals
 * All transform/opacity, rAF-throttled, gated on motion preference.
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
    lockHero();
    // A real rotation always swaps the width, which the resize handler
    // already treats as a relock. No orientationchange listener: engines
    // fire it on ANY viewport resize (toolbar churn included), and a
    // transient width reading there could re-pin the hero mid-churn.
    window.addEventListener('resize', maybeRelock, { passive: true });
  }

  // ---- Scroll-scrub reveals (Apple product-page feel) ----
  // Progress is a pure function of where the element sits in the
  // viewport, so entrances scrub with the scroll in both directions and
  // can never desync or be skipped (no IntersectionObserver, no one-shot
  // state). Elements ease from translate/scale/fade to identity as they
  // travel from the viewport bottom to ~60% up; once settled the inline
  // styles are cleared so CSS hover transforms take over.
  if (!reduce) {
    var GROUPS = [
      { sel: '.section-title', travel: 64, scale: 0 },
      { sel: '#resume .data-box', travel: 56, scale: 1 },
      { sel: '#experience .data-box', travel: 56, scale: 1 },
      { sel: '#skill .boxWhyScg', travel: 56, scale: 1 },
      { sel: '#portfolio .rf-cards-scroller-item', travel: 56, scale: 1, stagger: 0.05 },
      { sel: '#images-list .cert-card', travel: 44, scale: 1, stagger: 0.06, mod: 3 },
      { sel: '.closing-cta .cta-inner', travel: 56, scale: 0 }
    ];
    var items = [];
    GROUPS.forEach(function (g) {
      var els = document.querySelectorAll(g.sel);
      for (var i = 0; i < els.length; i++) {
        if (els[i].getBoundingClientRect().top < window.innerHeight * 0.92) continue; // in view at load — leave as-is
        els[i].classList.add('js-reveal');
        items.push({
          el: els[i], travel: g.travel, scale: g.scale, done: false, curY: 0, lastP: -1,
          // shift the scrub window per column/index so grids cascade
          shift: (g.mod ? (i % g.mod) : Math.min(i, 5)) * (g.stagger || 0)
        });
      }
    });
    if (items.length) {
      // Continuous rAF loop, like the hero canvas: progress is recomputed
      // from live viewport geometry every frame, so it needs no scroll
      // events, no scrollY, and no cached offsets — in-app webviews that
      // deliver scroll/resize events erratically still animate correctly.
      // Position reads subtract our own applied translate so the
      // animation never pollutes the measurement.
      function scrubFrame() {
        var vh = window.innerHeight;
        var se = document.scrollingElement || document.documentElement;
        // at the very end of the page nothing can travel further — settle all
        var atEnd = se.scrollTop + vh >= se.scrollHeight - 2;
        var end = vh * 0.58;
        var i, tops = [];
        for (i = 0; i < items.length; i++) { // read pass — no writes until all rects are taken
          tops.push(items[i].el.getBoundingClientRect().top - items[i].curY);
        }
        for (i = 0; i < items.length; i++) {
          var it = items[i];
          var start = vh * (1.02 - it.shift);
          var p = atEnd ? 1 : (start - tops[i]) / (start - end);
          if (p > 1) p = 1;
          if (p < 0) p = 0;
          if (p === it.lastP) continue;
          it.lastP = p;
          if (p === 1) {
            if (!it.done) {
              it.done = true;
              it.curY = 0;
              it.el.classList.add('is-visible');
              it.el.style.transition = '';
              it.el.style.opacity = '';
              it.el.style.transform = '';
            }
          } else {
            var e = 1 - Math.pow(1 - p, 3);
            if (it.done) { it.done = false; it.el.classList.remove('is-visible'); }
            it.curY = it.travel * (1 - e);
            it.el.style.transition = 'none';
            it.el.style.opacity = e.toFixed(3);
            it.el.style.transform = 'translateY(' + it.curY.toFixed(1) + 'px)' +
              (it.scale ? ' scale(' + (0.94 + 0.06 * e).toFixed(4) + ')' : '');
          }
        }
      }
      function tick() { scrubFrame(); requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
      // Safety net: headless/battery-saver browsers can stall rAF while the
      // screen is visually idle; a timer keeps settle-correctness independent
      // of frame delivery (styles are only written when progress changes).
      setInterval(scrubFrame, 250);
    }
  }
})();

/**
 * Back-to-top — appears past the first viewport.
 */
(function () {
  var toTop = document.getElementById('back-to-top');
  if (!toTop) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ticking = false;
  function update() {
    ticking = false;
    toTop.classList.toggle('visible', (window.scrollY || 0) > window.innerHeight * 0.9);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();

  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
})();



/**
 * Hero constellation — his multi-agent systems as a living graph.
 * Nodes drift and connect; six labeled nodes (CRM/POS/ASR/TTS/LLM/IVR);
 * cursor gently repels nearby nodes and links to them like a peer.
 * Desktop: cluster on the right of the copy. Mobile: below the copy.
 * Pauses off-screen; renders a single static frame under reduced motion.
 */
(function () {
  var canvas = document.getElementById('hero-net');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var labelsHost = document.getElementById('hero-net-labels');
  var hero = document.getElementById('hero');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  var W = 0, H = 0, DPR = 1;
  var CONNECT = 130, MOUSE_DIST = 120;
  var mouse = { x: -9999, y: -9999, active: false };

  function hexToRgb(h) {
    return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
  }
  var WARM1 = hexToRgb('#1877F2'), WARM2 = hexToRgb('#5AA7FF'), COOL = hexToRgb('#64748B');
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    return { r: Math.round(lerp(c1.r, c2.r, t)), g: Math.round(lerp(c1.g, c2.g, t)), b: Math.round(lerp(c1.b, c2.b, t)) };
  }
  function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }
  // "compact" layout — phones AND iPads (≤1024px) get the graph
  // surrounding the copy; past iPad it's the desktop right-side field
  function isMobile() { return W < 1025; }
  // warm on one side of the cluster blending to cool on the other
  function colorForX(x) {
    var b = bounds();
    var t = Math.max(0, Math.min(1, (x - b.x0) / Math.max(b.x1 - b.x0, 1)));
    return t < 0.5 ? mix(WARM1, WARM2, t / 0.5) : mix(WARM2, COOL, (t - 0.5) / 0.5);
  }

  var LABELS = ['CRM', 'POS', 'ASR', 'TTS', 'LLM', 'IVR'];
  var nodes = [], labelEls = [];
  var pulses = [], nextPulse = 0.9; // signals travelling along the links
  // The graph is laid out against these frozen dimensions — NOT the live
  // canvas size. In-app browser toolbars change the hero height on every
  // scroll; keying node positions to the live height made the whole
  // cluster breathe with it. Layout dims only re-adopt on a real width
  // change (rotation / window resize) or a drastic height change.
  var layoutW = 0, layoutH = 0;
  // eased state for the node-lit name ink
  var nameEl = hero.querySelector('.hero-name');
  var inkX = 62, inkR = 24, inkG = 119, inkB = 242;
  var inkNode = null, nextInkSwitch = 1.6;

  // ── Big-bang intro: the whole graph starts as one clustered blob,
  // trembles harder and harder, then detonates outward — every node
  // overshoots to its home (Duolingo-inspired burst). ──
  var SHAKE_END = 0.5, EXPLODE_DUR = 0.5, INTRO_END = SHAKE_END + EXPLODE_DUR;
  var introCluster = null, boomPlayed = false;
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
  // Cheerful synthesized pop (Duolingo-flavored: soft thump + three
  // bright rising notes). No audio asset. Browsers block autoplay
  // audio before the first user gesture — in that case we skip
  // silently rather than error.
  function playBoom() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ac = new AC();
      if (ac.state !== 'running') { ac.close(); return; }
      var t = ac.currentTime;
      var o1 = ac.createOscillator(), g1 = ac.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(220, t);
      o1.frequency.exponentialRampToValueAtTime(70, t + 0.18);
      g1.gain.setValueAtTime(0.16, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o1.connect(g1); g1.connect(ac.destination);
      o1.start(t); o1.stop(t + 0.24);
      [1046.5, 1318.5, 1568].forEach(function (fq, k) { // C6 E6 G6
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle';
        o.frequency.value = fq;
        var ts = t + 0.02 + k * 0.055;
        g.gain.setValueAtTime(0.0001, ts);
        g.gain.exponentialRampToValueAtTime(0.1, ts + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, ts + 0.16);
        o.connect(g); g.connect(ac.destination);
        o.start(ts); o.stop(ts + 0.18);
      });
      setTimeout(function () { ac.close(); }, 800);
    } catch (e) { /* no sound is fine */ }
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
      // (frame-rate independent, perfectly smooth). Frequencies are
      // tuned to read as alive within the first second of looking.
      var dir = Math.random() * Math.PI * 2;
      nodes.push({
        // home as FRACTIONS of the hero size — recomputed every frame,
        // so the graph tracks container resizes continuously (iOS
        // delivers resize events late during scroll; fractions don't care)
        fx: x / (layoutW || W), fy: y / (layoutH || H),
        x: x, y: y,
        a1: (special ? 10 : 16) + Math.random() * (special ? 8 : 16),
        a2: 5 + Math.random() * 7,
        f1: 0.5 + Math.random() * 0.3,
        f2: 0.95 + Math.random() * 0.55,
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
    inkNode = null;
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
    ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
    updateCopyRect();
    if (!nodes.length) {
      layoutW = W;
      layoutH = H;
      makeNodes();
    } else if (Math.abs(W - layoutW) > 1 || Math.abs(H - layoutH) > layoutH * 0.25) {
      // real layout change (rotation, desktop window resize) — re-anchor;
      // toolbar-sized height churn is deliberately ignored
      layoutW = W;
      layoutH = H;
    }
    if (bitmapChanged && nodes.length) drawFrame(lastDrawT);
  }

  if (finePointer) {
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
  window.addEventListener('load', function () { updateCopyRect(); resize(); }, { passive: true });
  // web fonts can reflow the copy block after first paint
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(updateCopyRect);
  }
  // iOS/WKWebView can purge a canvas backing store while the page is
  // hidden or restored from the back-forward cache — repaint on return
  window.addEventListener('pageshow', resize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) resize();
  });

  function drawFrame(time) {
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

    // detonation moment: pop sound + expanding shockwave ring
    if (!reduce && !boomPlayed && it >= SHAKE_END) {
      boomPlayed = true;
      playBoom();
    }
    if (!reduce && introCluster && it >= SHAKE_END && it < SHAKE_END + 0.7) {
      var rp = (it - SHAKE_END) / 0.7;
      ctx.strokeStyle = rgba(WARM1, (1 - rp) * 0.35);
      ctx.lineWidth = 2 - rp;
      ctx.beginPath();
      ctx.arc(introCluster.x, introCluster.y, 10 + rp * rp * 340, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // signals: bright dots travelling along links — the system talking
    if (!reduce && it > 1.4) {
      if (time >= nextPulse && pulses.length < 4) {
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
          if (B) pulses.push({ a: A, b: B, t0: time, dur: 0.8 + Math.random() * 0.5 });
        }
        nextPulse = time + 0.35 + Math.random() * 0.55;
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
          ctx.strokeStyle = rgba(colorForX((ax + bx) / 2), (1 - d / CONNECT) * 0.3 * lf);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
      }
      if (mouse.active) { // the cursor joins the graph as a peer
        var dxc = ax - mouse.x, dyc = ay - mouse.y;
        var dc2 = dxc * dxc + dyc * dyc;
        if (dc2 < CONNECT * CONNECT) {
          ctx.strokeStyle = rgba(colorForX(ax), (1 - Math.sqrt(dc2) / CONNECT) * 0.16 * na.f);
          ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(ax, ay); ctx.stroke();
        }
      }
    }

    // hairline from the copy block to the nearest node, breathing
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
      var breathe = 0.08 + 0.08 * (0.5 + 0.5 * Math.sin(time * 0.9));
      var g = ctx.createLinearGradient(anchor.x, anchor.y, nearest.x + nearest.px, nearest.y + nearest.py);
      g.addColorStop(0, rgba(WARM2, breathe));
      g.addColorStop(1, rgba(COOL, breathe));
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(nearest.x + nearest.px, nearest.y + nearest.py); ctx.stroke();

      // The name mirrors the constellation's ink: the glow in the
      // letters tracks one agent node at a time — its horizontal spot
      // in the name matches where that agent sits in the cluster, in
      // that agent's own color. Focus glides to another agent every
      // few seconds.
      if (nameEl) {
        if (time >= nextInkSwitch) {
          nextInkSwitch = time + 3.5 + Math.random() * 2.5;
          var cands = [];
          for (var ci = 0; ci < nodes.length; ci++) {
            if (nodes[ci].special && nodes[ci].f > 0.4) cands.push(nodes[ci]);
          }
          inkNode = cands.length ? cands[(Math.random() * cands.length) | 0] : nearest;
        }
        var src = (inkNode && inkNode.f > 0.3) ? inkNode : nearest;
        var cb = bounds();
        var targetC = colorForX(src.x + src.px);
        var rel = ((src.x + src.px) - cb.x0) / Math.max(cb.x1 - cb.x0, 1);
        var targetX = 12 + Math.max(0, Math.min(1, rel)) * 76;
        inkX += (targetX - inkX) * 0.02;
        inkR += (targetC.r - inkR) * 0.02;
        inkG += (targetC.g - inkG) * 0.02;
        inkB += (targetC.b - inkB) * 0.02;
        nameEl.style.setProperty('--ink-x', inkX.toFixed(1) + '%');
        nameEl.style.setProperty('--ink-c', 'rgb(' + Math.round(inkR) + ',' + Math.round(inkG) + ',' + Math.round(inkB) + ')');
      }
    }

    // nodes (clearer: brighter cores, wider halos on specials);
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
        }
        if (f <= 0.02) continue;
        var col = colorForX(nx);
        var r = nm.r * (0.35 + 0.65 * f);
        ctx.fillStyle = rgba(col, 0.16 * f);
        ctx.beginPath(); ctx.arc(nx, ny, r + 9 * f, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(col, 0.95 * f);
        ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(251,251,253,' + (0.95 * f) + ')';
        ctx.beginPath(); ctx.arc(nx, ny, 2.4 * f, 0, Math.PI * 2); ctx.fill();
      } else {
        if (f <= 0.02) continue;
        ctx.fillStyle = rgba(colorForX(nx), 0.8 * f);
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
      var sc = colorForX(sx);
      ctx.fillStyle = rgba(sc, 0.18 * sa);
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(sc, 0.9 * sa);
      ctx.beginPath(); ctx.arc(sx, sy, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * sa).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(sx, sy, 1.1, 0, Math.PI * 2); ctx.fill();
    }
  }

  var running = false, t0 = null, lastDrawT = 0.01;
  var curtainUp = false;
  function loop(ts) {
    if (!running) return;
    if (t0 === null) t0 = ts;
    // Hold the intro clock at zero until the page loader curtain lifts —
    // otherwise the cluster/shake plays hidden behind the overlay and
    // visitors only catch the tail of the explosion.
    if (!curtainUp) {
      if (document.querySelector('.loader')) { t0 = ts; }
      else { curtainUp = true; }
    }
    // iOS batches resize events until scroll momentum ends; catch the
    // container changing size the moment it happens instead
    // (tolerance 2px: fractional-layout jitter must not trigger it)
    if (Math.abs(hero.clientWidth - W) > 2 || Math.abs(hero.clientHeight - H) > 2) resize();
    // Under reduced motion the scene drifts at half speed (no pulses,
    // no assembly) — never a hard freeze, and the continuous paint
    // keeps the canvas backing store alive on iOS/WKWebView.
    lastDrawT = (ts - t0) / (reduce ? 2000 : 1000);
    if (replayQueued) { // bfcache reopen: restart the intro on this clock
      replayQueued = false;
      introT0 = lastDrawT;
      boomPlayed = false;
      introCluster = null;
    }
    drawFrame(lastDrawT);
    requestAnimationFrame(loop);
  }

  makeLabels();
  resize();

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
 * BizCard — Apple Card-style 3D tilt.
 * Fine pointers tilt the card directly; elsewhere it sways gently on
 * its own. A specular glare tracks the tilt via --gx/--gy. Runs only
 * while visible; skipped entirely under reduced motion.
 */
(function () {
  var card = document.getElementById('biz-card');
  var scene = document.getElementById('biz-scene');
  if (!card || !scene) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return; // the card is fully readable standing still

  var run = false, raf = null, hover = false;
  var tx = 0, ty = 0, cx = 0, cy = 0;

  function frame(ts) {
    if (!run) { raf = null; return; }
    var t = ts / 1000;
    if (!hover) { // idle: a slow left-right sway, like the Apple Card promo
      tx = Math.sin(t * 0.85) * 17;
      ty = Math.cos(t * 0.6) * 8;
    }
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    card.style.transform = 'rotateY(' + cx.toFixed(2) + 'deg) rotateX(' + cy.toFixed(2) + 'deg)';
    raf = requestAnimationFrame(frame);
  }

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    scene.addEventListener('pointermove', function (e) {
      var r = scene.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      hover = true;
      tx = px * 34;
      ty = -py * 22;
    });
    scene.addEventListener('pointerleave', function () { hover = false; });
  }

  var io = new IntersectionObserver(function (entries) {
    var vis = entries[entries.length - 1].isIntersecting;
    if (vis && !run) { run = true; if (!raf) raf = requestAnimationFrame(frame); }
    else if (!vis) { run = false; }
  }, { threshold: 0.1 });
  io.observe(scene);
})();
