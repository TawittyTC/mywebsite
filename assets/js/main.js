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
    el.addEventListener("scroll", listener);
  };

  /**
   * Navbar links active state on scroll
   */
  let navbarlinks = select("#navbar .scrollto", true);
  const navbarlinksActive = () => {
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
  };
  window.addEventListener("load", navbarlinksActive);
  onscroll(document, navbarlinksActive);

  /**
   * Scrolls to an element with header offset
   */
  const scrollto = (el) => {
    let elementPos = select(el).offsetTop;
    window.scrollTo({
      top: elementPos,
      behavior: "smooth",
    });
  };

  /**
   * Back to top button
   */
  let backtotop = select(".back-to-top");
  if (backtotop) {
    const toggleBacktotop = () => {
      if (window.scrollY > 100) {
        backtotop.classList.add("active");
      } else {
        backtotop.classList.remove("active");
      }
    };
    window.addEventListener("load", toggleBacktotop);
    onscroll(document, toggleBacktotop);
  }

  /**
   * Mobile nav toggle
   */
  on("click", ".mobile-nav-toggle", function (e) {
    select("body").classList.toggle("mobile-nav-active");
    this.classList.toggle("bi-list");
    this.classList.toggle("bi-x");
  });

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
   * Preloader
   */
  // let preloader = select("#preloader");
  let preloader = select(".loader");
  if (preloader) {
    window.addEventListener("load", () => {
      preloader.remove();
    });
  }

  /**
   * Hero type effect
   */
  const typed = select(".typed");
  if (typed) {
    let typed_strings = typed.getAttribute("data-typed-items");
    typed_strings = typed_strings.split(",");
    new Typed(".typed", {
      strings: typed_strings,
      loop: true,
      typeSpeed: 100,
      backSpeed: 50,
      backDelay: 2000,
    });
  }

  /**
   * Animation on scroll
   */
  window.addEventListener("load", () => {
    AOS.init({
      duration: 500,
      easing: "ease-in-out",
      once: true,
      mirror: false,
    });
  });

})();


document.addEventListener("DOMContentLoaded", function () {
  const elements = document.querySelectorAll(".fade");
  const offset = 100; // Adjust this value based on when you want the animation to start

  function onScroll() {
    elements.forEach((el, index) => {
      if (el.getBoundingClientRect().top < window.innerHeight - offset) {
        setTimeout(() => {
          el.classList.add("show");
        }, index * 50); // Adjust the delay as needed
      }
    });
  }

  window.addEventListener("scroll", onScroll);
  onScroll(); // Run the function on page load
});

document.addEventListener("DOMContentLoaded", function () {
  const imagesList = document.getElementById("images-list");
  if (!imagesList) return;

  for (let i = 1; i <= 29; i++) {
    const imageSrc = `assets/img/certificate/img-${i}.avif`;
    const colDiv = document.createElement("div");

    // Responsive column classes: 2 columns on mobile, 3 on desktop
    colDiv.classList.add("col-6", "col-lg-4", "mb-5");

    const wrapper = document.createElement("div");
    wrapper.classList.add("cert-img");

    const imgElement = document.createElement("img");
    imgElement.src = imageSrc;
    imgElement.className = "img-fluid";
    imgElement.alt = "Tanapol's Certificate Images";
    imgElement.style.cursor = "pointer";
    imgElement.loading = "lazy";

    imgElement.onclick = () => {
      document.getElementById("modalImage").src = imageSrc;
      new bootstrap.Modal(document.getElementById("imageModal")).show();
    };

    wrapper.appendChild(imgElement);
    colDiv.appendChild(wrapper);
    imagesList.appendChild(colDiv);
  }
});


document.addEventListener('DOMContentLoaded', function () {
  const prevBtn = document.querySelector('.paddlenav-arrow-previous');
  const nextBtn = document.querySelector('.paddlenav-arrow-next');
  const scroller = document.getElementById('scroller');

  function updateScrollerButtons() {
    const scrollLeft = scroller.scrollLeft;
    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;

    if (scrollLeft <= 0) {
      prevBtn.disabled = true;
      prevBtn.classList.add('disabled');
      prevBtn.style.visibility = 'hidden';
    } else {
      prevBtn.disabled = false;
      prevBtn.classList.remove('disabled');
      prevBtn.style.visibility = 'visible';
    }

    if (scrollLeft >= maxScrollLeft - 1) {
      nextBtn.disabled = true;
      nextBtn.classList.add('disabled');
      nextBtn.style.visibility = 'hidden';
    } else {
      nextBtn.disabled = false;
      nextBtn.classList.remove('disabled');
      nextBtn.style.visibility = 'visible';
    }
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
  scroller.addEventListener('scroll', updateScrollerButtons);
  window.addEventListener('load', updateScrollerButtons); // เช็กตอนโหลดหน้า

  // เช็กสถานะปุ่มทันทีหลังจาก DOM loaded
  updateScrollerButtons();

  // เช็กอีกครั้งหลังจากรูปโหลดเสร็จ
  setTimeout(updateScrollerButtons, 500);
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
          if (prevBtn) { prevBtn.disabled = true; prevBtn.style.visibility = 'hidden'; }
          if (nextBtn) {
            nextBtn.disabled = maxScrollLeft <= 0;
            nextBtn.style.visibility = maxScrollLeft <= 0 ? 'hidden' : 'visible';
          }
        }, 100);
      }
    });
  });
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

// GSAP Hero Animation
window.addEventListener('load', function () {
  if (typeof gsap === 'undefined') return;
  const tl = gsap.timeline({ delay: 0.1 });
  tl.fromTo('#hero h1',
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }
  )
  .fromTo('#hero p',
    { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' },
    '-=0.6'
  )
  .fromTo('#hero .social-links',
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
    '-=0.6'
  );
});

// Expandable Cards (Achievement/Experience)
document.addEventListener('DOMContentLoaded', function () {
  const expandBtns = document.querySelectorAll('.expand-btn');
  expandBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const card = this.closest('.expandable');
      const content = card.querySelector('.expandable-content');
      this.classList.toggle('expanded');
      content.classList.toggle('expanded');
    });
  });
});

var currentYear = new Date().getFullYear();
document.getElementById('current-year').textContent = currentYear;


