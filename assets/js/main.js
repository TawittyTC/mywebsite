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
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
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
    lightbox.classList.remove('open');
    setTimeout(function() { document.body.style.overflow = ''; }, 220);
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

// Load cert images only when section scrolls into view (performance)
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

  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) { buildCerts(); obs.disconnect(); }
    }, { rootMargin: "200px" });
    obs.observe(imagesList);
  } else {
    buildCerts();
  }
});


document.addEventListener('DOMContentLoaded', function () {
  const prevBtn = document.querySelector('.paddlenav-arrow-previous');
  const nextBtn = document.querySelector('.paddlenav-arrow-next');
  const scroller = document.getElementById('scroller');

  function updateScrollerButtons() {
    const scrollLeft = scroller.scrollLeft;
    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    prevBtn.disabled = scrollLeft <= 0;
    prevBtn.classList.toggle('disabled', scrollLeft <= 0);
    nextBtn.disabled = scrollLeft >= maxScrollLeft - 1;
    nextBtn.classList.toggle('disabled', scrollLeft >= maxScrollLeft - 1);
  }

  // เมื่อกดปุ่ม "Previous" เลื่อนกลับไป 1 ช่อง
  prevBtn.addEventListener('click', function () {
    scroller.scrollBy({ left: -400, behavior: 'smooth' });
  });

  // เมื่อกดปุ่ม "Next" เลื่อนไปข้างหน้า 1 ช่อง
  nextBtn.addEventListener('click', function () {
    scroller.scrollBy({ left: 400, behavior: 'smooth' });
  });

  // อัปเดตปุ่มเมื่อ scroll
  scroller.addEventListener('scroll', updateScrollerButtons, { passive: true });
  window.addEventListener('load', updateScrollerButtons); // เช็กตอนโหลดหน้า

  // เช็กสถานะปุ่มทันทีหลังจาก DOM loaded
  updateScrollerButtons();

  // เช็กอีกครั้งหลังจากรูปโหลดเสร็จ
  setTimeout(updateScrollerButtons, 500);

  // Hint animation บน mobile: เลื่อนการ์ดซ้ายแล้วกลับ วน loop ทุก 3 วิ
  if (window.innerWidth <= 1024 && scroller) {
    const hintDistance = 80;
    const duration = 250;
    let userScrolling = false;
    let isAnimating = false;
    let scrollEndTimer = null;
    let hintInterval = null;

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function runHint() {
      if (userScrolling || isAnimating) return;

      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      const atRightEnd = scroller.scrollLeft >= maxScrollLeft - 1;
      const dir = atRightEnd ? -1 : 1; // ขวาสุด → hint ซ้าย, อื่นๆ → hint ขวา

      isAnimating = true;
      const baseScroll = scroller.scrollLeft;
      const fwdStart = performance.now();
      function forward(ts) {
        if (userScrolling) { isAnimating = false; return; }
        const p = Math.min((ts - fwdStart) / duration, 1);
        scroller.scrollLeft = baseScroll + dir * hintDistance * easeInOut(p);
        if (p < 1) { requestAnimationFrame(forward); return; }
        const bkStart = performance.now();
        function back(ts2) {
          if (userScrolling) { isAnimating = false; return; }
          const p2 = Math.min((ts2 - bkStart) / duration, 1);
          scroller.scrollLeft = baseScroll + dir * hintDistance * (1 - easeInOut(p2));
          if (p2 < 1) { requestAnimationFrame(back); return; }
          isAnimating = false;
        }
        requestAnimationFrame(back);
      }
      requestAnimationFrame(forward);
    }

    function startHintLoop() {
      clearInterval(hintInterval);
      hintInterval = setInterval(runHint, 3000);
    }

    function onUserScroll() {
      if (isAnimating) return;
      userScrolling = true;
      clearInterval(hintInterval);
      hintInterval = null;
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(function () {
        userScrolling = false;
        startHintLoop();
      }, 10000);
    }

    scroller.addEventListener('touchstart', onUserScroll, { passive: true });
    scroller.addEventListener('scroll', onUserScroll, { passive: true });

    // Trigger hint immediately when section scrolls into view
    var hintStarted = false;
    var hintObs = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting && !hintStarted) {
        hintStarted = true;
        hintObs.disconnect();
        runHint();
        startHintLoop();
      }
    }, { threshold: 0.3 });
    hintObs.observe(scroller);
  }

});




// Project Filters
document.addEventListener('DOMContentLoaded', function () {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectItems = document.querySelectorAll('.rf-cards-scroller-item');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      filterBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const filter = this.getAttribute('data-filter');
      projectItems.forEach(item => {
        item.style.display = (filter === 'all' || item.getAttribute('data-tech') === filter) ? '' : 'none';
      });

      const scroller = document.getElementById('scroller');
      if (scroller) {
        scroller.scrollLeft = 0;
        setTimeout(() => {
          const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
          const prevBtn = document.querySelector('.paddlenav-arrow-previous');
          const nextBtn = document.querySelector('.paddlenav-arrow-next');
          if (prevBtn) { prevBtn.disabled = true; prevBtn.classList.add('disabled'); }
          if (nextBtn) {
            nextBtn.disabled = maxScrollLeft <= 0;
            nextBtn.classList.toggle('disabled', maxScrollLeft <= 0);
          }
        }, 100);
      }
    });
  });
});

// Skill Scroller
document.addEventListener('DOMContentLoaded', function () {
  const prevBtn = document.querySelector('.skill-paddlenav-arrow-previous');
  const nextBtn = document.querySelector('.skill-paddlenav-arrow-next');
  const scroller = document.getElementById('skill-scroller');
  if (!prevBtn || !nextBtn || !scroller) return;

  function updateButtons() {
    const scrollLeft = scroller.scrollLeft;
    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    prevBtn.disabled = scrollLeft <= 0;
    prevBtn.classList.toggle('disabled', scrollLeft <= 0);
    nextBtn.disabled = scrollLeft >= maxScrollLeft - 1;
    nextBtn.classList.toggle('disabled', scrollLeft >= maxScrollLeft - 1);
  }

  prevBtn.addEventListener('click', function () {
    scroller.scrollBy({ left: -400, behavior: 'smooth' });
  });
  nextBtn.addEventListener('click', function () {
    scroller.scrollBy({ left: 400, behavior: 'smooth' });
  });
  scroller.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('load', updateButtons);
  setTimeout(updateButtons, 500);

  if (window.innerWidth <= 1024) {
    const hintDistance = 80;
    const duration = 250;
    let userScrolling = false;
    let isAnimating = false;
    let scrollEndTimer = null;
    let hintInterval = null;

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    function runHint() {
      if (userScrolling || isAnimating) return;
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      const atRightEnd = scroller.scrollLeft >= maxScrollLeft - 1;
      const dir = atRightEnd ? -1 : 1;
      isAnimating = true;
      const baseScroll = scroller.scrollLeft;
      const fwdStart = performance.now();
      function forward(ts) {
        if (userScrolling) { isAnimating = false; return; }
        const p = Math.min((ts - fwdStart) / duration, 1);
        scroller.scrollLeft = baseScroll + dir * hintDistance * easeInOut(p);
        if (p < 1) { requestAnimationFrame(forward); return; }
        const bkStart = performance.now();
        function back(ts2) {
          if (userScrolling) { isAnimating = false; return; }
          const p2 = Math.min((ts2 - bkStart) / duration, 1);
          scroller.scrollLeft = baseScroll + dir * hintDistance * (1 - easeInOut(p2));
          if (p2 < 1) { requestAnimationFrame(back); return; }
          isAnimating = false;
        }
        requestAnimationFrame(back);
      }
      requestAnimationFrame(forward);
    }
    function startHintLoop() {
      clearInterval(hintInterval);
      hintInterval = setInterval(runHint, 3000);
    }
    function onUserScroll() {
      if (isAnimating) return;
      userScrolling = true;
      clearInterval(hintInterval);
      hintInterval = null;
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(function () {
        userScrolling = false;
        startHintLoop();
      }, 10000);
    }
    scroller.addEventListener('touchstart', onUserScroll, { passive: true });
    scroller.addEventListener('scroll', onUserScroll, { passive: true });

    // Trigger hint immediately when section scrolls into view
    var hintStarted = false;
    var hintObs = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting && !hintStarted) {
        hintStarted = true;
        hintObs.disconnect();
        runHint();
        startHintLoop();
      }
    }, { threshold: 0.3 });
    hintObs.observe(scroller);
  }

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

  // ---- Hero parallax (scroll) ----
  var hero = document.getElementById('hero');
  if (hero && !reduce) {
    var copy = hero.querySelector('.hero-copy');
    var ticking = false;

    function apply() {
      ticking = false;
      var sy = window.scrollY || window.pageYOffset || 0;
      var h = hero.offsetHeight || window.innerHeight;
      var prog = Math.min(Math.max(sy / h, 0), 1);
      if (copy) {
        copy.style.transform = 'translate3d(0,' + (sy * 0.32) + 'px,0)';
        copy.style.opacity = String(Math.max(1 - prog * 1.15, 0));
      }
    }
    function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }

    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick, { passive: true });
    apply();
  }

  // ---- Scroll reveals ----
  // Position-checked on each (rAF-throttled) scroll instead of
  // IntersectionObserver: IO can skip an element entirely when a fast
  // scroll jumps past it in one frame (worse with content-visibility),
  // leaving it stuck hidden. A position check can't miss.
  if (!reduce) {
    var targets = [];
    document.querySelectorAll('.section-title').forEach(function (el) { targets.push(el); });
    ['#resume .data-box', '#experience .data-box', '#skill .boxWhyScg',
     '#portfolio .rf-cards-scroller-item'].forEach(function (sel) {
      var group = document.querySelectorAll(sel);
      group.forEach(function (el, i) { el.style.setProperty('--reveal-delay', Math.min(i, 5) * 0.06 + 's'); targets.push(el); });
    });
    var armed = [];
    targets.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) { return; } // already in view — leave visible
      el.classList.add('js-reveal');
      armed.push(el);
    });
    var revealTicking = false;
    function checkReveal() {
      revealTicking = false;
      if (!armed.length) return;
      var fold = window.innerHeight * 0.92;
      armed = armed.filter(function (el) {
        if (el.getBoundingClientRect().top < fold) { el.classList.add('is-visible'); return false; }
        return true;
      });
      if (!armed.length) {
        window.removeEventListener('scroll', onRevealScroll);
        window.removeEventListener('resize', onRevealScroll);
      }
    }
    function onRevealScroll() { if (!revealTicking) { revealTicking = true; requestAnimationFrame(checkReveal); } }
    window.addEventListener('scroll', onRevealScroll, { passive: true });
    window.addEventListener('resize', onRevealScroll, { passive: true });
    checkReveal();
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
  var WARM1 = hexToRgb('#B4602A'), WARM2 = hexToRgb('#D99043'), COOL = hexToRgb('#3F6EA6');
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    return { r: Math.round(lerp(c1.r, c2.r, t)), g: Math.round(lerp(c1.g, c2.g, t)), b: Math.round(lerp(c1.b, c2.b, t)) };
  }
  function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }
  function isMobile() { return W < 992; }
  // warm on one side of the cluster blending to cool on the other
  function colorForX(x) {
    var b = bounds();
    var t = Math.max(0, Math.min(1, (x - b.x0) / Math.max(b.x1 - b.x0, 1)));
    return t < 0.5 ? mix(WARM1, WARM2, t / 0.5) : mix(WARM2, COOL, (t - 0.5) / 0.5);
  }

  var LABELS = ['CRM', 'POS', 'ASR', 'TTS', 'LLM', 'IVR'];
  var nodes = [], labelEls = [];
  var pulses = [], nextPulse = 0.9; // signals travelling along the links
  // eased state for the node-lit name ink
  var nameEl = hero.querySelector('.hero-name');
  var inkX = 62, inkR = 180, inkG = 96, inkB = 42;
  var inkNode = null, nextInkSwitch = 1.6;

  function bounds() {
    return isMobile()
      ? { x0: W * 0.05, x1: W * 0.95, y0: H * 0.52, y1: H * 0.94 }
      : { x0: W * 0.44, x1: W * 0.97, y0: H * 0.08, y1: H * 0.92 };
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
    var total = isMobile() ? 36 : 55;
    for (var i = 0; i < total; i++) {
      var special = i < LABELS.length;
      var x, y;
      if (special) { // seed specials on a loose ring so labels spread out
        var ang = (i / LABELS.length) * Math.PI * 2 + 0.5;
        var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        x = cx + Math.cos(ang) * (b.x1 - b.x0) * 0.3 + (Math.random() - 0.5) * 40;
        y = cy + Math.sin(ang) * (b.y1 - b.y0) * 0.32 + (Math.random() - 0.5) * 40;
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
        hx: x, hy: y,
        thx: x, thy: y,
        x: x, y: y,
        a1: (special ? 10 : 16) + Math.random() * (special ? 8 : 16),
        a2: 5 + Math.random() * 7,
        f1: 0.34 + Math.random() * 0.22,
        f2: 0.68 + Math.random() * 0.42,
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
    var hr = hero.getBoundingClientRect();
    var cr = copyEl.getBoundingClientRect();
    copyRect = { x0: cr.left - hr.left, y0: cr.top - hr.top, x1: cr.right - hr.left, y1: cr.bottom - hr.top };
  }
  // 1 = fully visible, 0 = gone (within 24px of the text block);
  // the ramp runs over the next 130px
  function fadeAt(x, y) {
    if (!copyRect) return 1;
    var dx = Math.max(copyRect.x0 - x, 0, x - copyRect.x1);
    var dy = Math.max(copyRect.y0 - y, 0, y - copyRect.y1);
    var d = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, Math.min(1, (d - 30) / 130));
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    // WKWebViews (e.g. Facebook's in-app browser) can report a transient
    // 0-sized rect mid-layout — retry instead of building degenerate state
    if (rect.width < 10 || rect.height < 10) {
      requestAnimationFrame(resize);
      return;
    }
    var prevW = W, prevH = H;
    W = rect.width;
    H = rect.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    // explicit CSS size — never rely on stretch alone
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    updateCopyRect();
    // The graph is seeded exactly once. In-app browsers (Facebook etc.)
    // resize the webview whenever their toolbars collapse during scroll —
    // reseeding there shuffles every node. Instead, rescale each node's
    // home proportionally; drawFrame eases toward it, so even a real
    // resize glides rather than jumps.
    if (!nodes.length) {
      makeNodes();
    } else if (prevW > 0 && prevH > 0 && (Math.abs(W - prevW) > 1 || Math.abs(H - prevH) > 1)) {
      var sx = W / prevW, sy = H / prevH;
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].thx *= sx;
        nodes[i].thy *= sy;
      }
    }
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
  window.addEventListener('load', function () { updateCopyRect(); resize(); }, { passive: true });
  // iOS/WKWebView can purge a canvas backing store while the page is
  // hidden or restored from the back-forward cache — repaint on return
  window.addEventListener('pageshow', resize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) resize();
  });

  function drawFrame(time) {
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      // glide the home point toward its (possibly rescaled) target
      n.hx += (n.thx - n.hx) * 0.06;
      n.hy += (n.thy - n.hy) * 0.06;
      // layered-sine wander around the home point (lively but smooth)
      n.x = n.hx + n.a1 * Math.sin(time * n.f1 + n.p1) + n.a2 * Math.sin(time * n.f2 + n.p2);
      n.y = n.hy + n.a1 * Math.cos(time * n.f1 * 0.83 + n.p3) + n.a2 * Math.sin(time * n.f2 * 1.27 + n.p4);

      // entrance: fly in + fade in, staggered — the network assembles
      // itself in the first ~2s (skipped under reduced motion)
      if (n.iv < 1) {
        if (reduce) { n.iv = 1; }
        else {
          var ip = Math.min(Math.max((time - n.st) / 0.7, 0), 1);
          n.iv = 1 - Math.pow(1 - ip, 3); // easeOutCubic
          var away = (1 - n.iv) * 80;
          n.x += n.ix * away;
          n.y += n.iy * away;
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
      // how visible this node is near the copy block (0 gone → 1 full)
      n.f = fadeAt(n.x + n.px, n.y + n.py) * n.iv;
    }

    // signals: bright dots travelling along links — the system talking
    if (!reduce && time > 1.4) {
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
          el.style.opacity = String(f);
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

  var running = false, t0 = null;
  function loop(ts) {
    if (!running) return;
    if (t0 === null) t0 = ts;
    // Under reduced motion the scene is repainted with frozen time:
    // visually static, but the continuous paint keeps the canvas
    // backing store alive on iOS/WKWebView, which purges idle canvases.
    drawFrame(reduce ? 1.2 : (ts - t0) / 1000);
    requestAnimationFrame(loop);
  }

  makeLabels();
  resize();

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      if (vis && !running) { running = true; requestAnimationFrame(loop); }
      else if (!vis) { running = false; }
    }, { threshold: 0 });
    io.observe(hero);
  } else {
    running = true;
    requestAnimationFrame(loop);
  }
})();
