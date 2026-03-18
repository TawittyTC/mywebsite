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
   * Easy on scroll event listener
   */
  const onscroll = (el, listener) => {
    el.addEventListener("scroll", listener, { passive: true });
  };

  /**
   * Navbar links active state on scroll
   */
  let navbarlinks = select("#apple-header .scrollto", true);
  let _navRafPending = false;
  const navbarlinksActive = () => {
    if (_navRafPending) return;
    _navRafPending = true;
    requestAnimationFrame(() => {
      _navRafPending = false;
      let position = window.scrollY + 200;
      navbarlinks.forEach((navbarlink) => {
        if (!navbarlink.hash) return;
        let section = select(navbarlink.hash);
        if (!section) return;
        if (
          position >= section.offsetTop &&
          position <= section.offsetTop + section.offsetHeight
        ) {
          navbarlink.classList.add("active");
        } else {
          navbarlink.classList.remove("active");
        }
      });
    });
  };
  window.addEventListener("load", navbarlinksActive);
  onscroll(document, navbarlinksActive);

  /**
   * Scrolls to an element with header offset
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

        let body = select("body");
        if (body.classList.contains("mobile-nav-active")) {
          body.classList.remove("mobile-nav-active");
          let navbarToggle = select(".mobile-nav-toggle");
          navbarToggle.classList.toggle("bi-list");
          navbarToggle.classList.toggle("bi-x");
        }
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

  /**
   * Scroll fade-up — native IntersectionObserver (replaces AOS, saves 14KB)
   */
  document.addEventListener("DOMContentLoaded", () => {
    const aosEls = document.querySelectorAll('[data-aos]');
    if (!aosEls.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('aos-animate'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    aosEls.forEach(el => obs.observe(el));
  });

})();


document.addEventListener("DOMContentLoaded", function () {
  const elements = document.querySelectorAll(".fade");
  const offset = 100; // Adjust this value based on when you want the animation to start
  let _fadeRafPending = false;

  function onScroll() {
    if (_fadeRafPending) return;
    _fadeRafPending = true;
    requestAnimationFrame(() => {
      _fadeRafPending = false;
      elements.forEach((el, index) => {
        if (el.getBoundingClientRect().top < window.innerHeight - offset) {
          setTimeout(() => {
            el.classList.add("show");
          }, index * 50); // Adjust the delay as needed
        }
      });
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll(); // Run the function on page load
});

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

// Load cert images only when section scrolls into view (performance)
document.addEventListener("DOMContentLoaded", function () {
  const imagesList = document.getElementById("images-list");
  if (!imagesList) return;

  function buildCerts() {
    if (imagesList.dataset.loaded) return;
    imagesList.dataset.loaded = "1";
    for (let i = 1; i <= 31; i++) {
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
      expandBtn.addEventListener("click", function () {
        window._certLightboxOpen(src, alt);
      });
      const label = document.createElement("div");
      label.className = "cert-label";
      label.textContent = "Certificate · " + String(i).padStart(2, "0");
      wrapper.appendChild(imgElement);
      card.appendChild(wrapper);
      card.appendChild(label);
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
    scroller.scrollBy({ left: -300, behavior: 'smooth' });
  });

  // เมื่อกดปุ่ม "Next" เลื่อนไปข้างหน้า 1 ช่อง
  nextBtn.addEventListener('click', function () {
    scroller.scrollBy({ left: 300, behavior: 'smooth' });
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
    const duration = 400;
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
      }, 7000);
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

  // Desktop (>768px): redirect wheel events to page scroll.
  // overflow-x:hidden still creates a scroll container that captures wheel events in Chrome/Safari.
  // Intercepting here ensures the page scrolls normally when hovering over the card scroller.
  if (window.innerWidth > 768 && scroller) {
    scroller.addEventListener('wheel', function(e) {
      e.preventDefault();
      var delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      window.scrollBy(0, delta);
    }, { passive: false });
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
    scroller.scrollBy({ left: -300, behavior: 'smooth' });
  });
  nextBtn.addEventListener('click', function () {
    scroller.scrollBy({ left: 300, behavior: 'smooth' });
  });
  scroller.addEventListener('scroll', updateButtons, { passive: true });
  window.addEventListener('load', updateButtons);
  setTimeout(updateButtons, 500);

  if (window.innerWidth <= 1024) {
    const hintDistance = 80;
    const duration = 400;
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
      }, 7000);
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

  // Desktop (>768px): redirect wheel events to page scroll.
  if (window.innerWidth > 768 && scroller) {
    scroller.addEventListener('wheel', function(e) {
      e.preventDefault();
      var delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      window.scrollBy(0, delta);
    }, { passive: false });
  }
});

// Contact Form
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('contact-name').value;
    const email = document.getElementById('contact-email').value;
    const subject = document.getElementById('contact-subject').value;
    const message = document.getElementById('contact-message').value;

    const body = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;
    window.location.href = `mailto:tawitty.tc@gmail.com?subject=${encodeURIComponent(subject + ' - from ' + name)}&body=${encodeURIComponent(body)}`;

    const status = document.getElementById('form-status');
    if (status) {
      status.style.display = 'block';
      status.innerHTML = '<span style="color:#0563bb">Opening your email client... Thank you for reaching out!</span>';
    }
  });
});

// Apple Navigation
document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.getElementById('apple-nav-toggle');
  const mobileMenu = document.getElementById('apple-nav-mobile');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', function () {
    this.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
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

// View Experience → slow scroll to Experience section
var _expLink = document.querySelector('.profile-featured-body a[href="#experience"]');
if (_expLink) _expLink.addEventListener('click', function(e) {
  e.preventDefault();
  e.stopPropagation();
  var el = document.getElementById('experience');
  if (!el) return;
  var start = window.scrollY;
  var target = el.getBoundingClientRect().top + window.scrollY - 60;
  var startTime = null;
  var duration = 1500;
  var ease = function(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; };
  var step = function(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    window.scrollTo(0, start + (target - start) * ease(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});


