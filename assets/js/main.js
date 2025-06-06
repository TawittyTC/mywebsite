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
   * Skills animation
   */
  let skilsContent = select(".skills-content");
  if (skilsContent) {
    new Waypoint({
      element: skilsContent,
      offset: "80%",
      handler: function (direction) {
        let progress = select(".progress .progress-bar", true);
        progress.forEach((el) => {
          el.style.width = el.getAttribute("aria-valuenow") + "%";
        });
      },
    });
  }

  /**
   * Porfolio isotope and filter
   */
  window.addEventListener("load", () => {
    let portfolioContainer = select(".portfolio-container");
    if (portfolioContainer) {
      let portfolioIsotope = new Isotope(portfolioContainer, {
        itemSelector: ".portfolio-item",
      });

      let portfolioFilters = select("#portfolio-flters li", true);

      on(
        "click",
        "#portfolio-flters li",
        function (e) {
          e.preventDefault();
          portfolioFilters.forEach(function (el) {
            el.classList.remove("filter-active");
          });
          this.classList.add("filter-active");

          portfolioIsotope.arrange({
            filter: this.getAttribute("data-filter"),
          });
          portfolioIsotope.on("arrangeComplete", function () {
            AOS.refresh();
          });
        },
        true
      );
    }
  });

  /**
   * Initiate portfolio lightbox
   */
  const portfolioLightbox = GLightbox({
    selector: ".portfolio-lightbox",
  });

  /**
   * Initiate portfolio details lightbox
   */
  const portfolioDetailsLightbox = GLightbox({
    selector: ".portfolio-details-lightbox",
    width: "90%",
    height: "90vh",
  });

  /**
   * Portfolio details slider
   */
  new Swiper(".portfolio-details-slider", {
    speed: 400,
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    pagination: {
      el: ".swiper-pagination",
      type: "bullets",
      clickable: true,
    },
  });

  /**
   * Testimonials slider
   */
  new Swiper(".testimonials-slider", {
    speed: 600,
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    slidesPerView: "auto",
    pagination: {
      el: ".swiper-pagination",
      type: "bullets",
      clickable: true,
    },
  });

  /**
   * Animation on scroll
   */
  window.addEventListener("load", () => {
    AOS.init({
      duration: 1000,
      easing: "ease-in-out",
      once: true,
      mirror: false,
    });
  });

  /**
   * Initiate Pure Counter
   */
  new PureCounter();
})();


document.addEventListener("DOMContentLoaded", function () {
  const elements = document.querySelectorAll(".fade");
  const offset = 100; // Adjust this value based on when you want the animation to start

  function onScroll() {
    elements.forEach((el, index) => {
      if (el.getBoundingClientRect().top < window.innerHeight - offset) {
        setTimeout(() => {
          el.classList.add("show");
        }, index * 150); // Adjust the delay as needed
      }
    });
  }

  window.addEventListener("scroll", onScroll);
  onScroll(); // Run the function on page load
});

// สร้างลูปใน JavaScript เพื่อเพิ่มรูปภาพใน carousel-inner
const carouselInner = document.getElementById("carousel-inner");
for (let i = 1; i <= 28; i++) {
  const imageSrc = `assets/img/certificate/img-${i}.avif`; // แทนที่ด้วย URL ของรูปภาพที่ถูกต้อง
  const carouselItem = document.createElement("div");
  carouselItem.classList.add("carousel-item");
  if (i === 1) {
    carouselItem.classList.add("active");
  }
  const imgElement = document.createElement("img");
  imgElement.src = imageSrc;
  imgElement.className = "d-block w-100 img-fluid lazyload";
  imgElement.alt = "Tanapol's Certificate Images";
  imgElement.loading = "lazy"; // Add lazy loading
  carouselItem.appendChild(imgElement);
  carouselInner.appendChild(carouselItem);
}

const imagesList = document.getElementById("images-list");
for (let i = 1; i <= 28; i++) {
  const imageSrc = `assets/img/certificate/img-${i}.avif`; // Replace with the correct URL of your images
  const colDiv = document.createElement("div");

  // Responsive column classes
  colDiv.classList.add("col-12", "col-md-6", "col-lg-3", "mb-4");

  const imgElement = document.createElement("img");
  imgElement.src = imageSrc;
  imgElement.className = "img-fluid lazyload";
  imgElement.alt = "Tanapol's Certificate Images";
  imgElement.style.cursor = "pointer";
  imgElement.loading = "lazy"; // Add lazy loading
  imgElement.onclick = () => {
    document.getElementById("modalImage").src = imageSrc;
    new bootstrap.Modal(document.getElementById("imageModal")).show();
  };
  colDiv.appendChild(imgElement);
  imagesList.appendChild(colDiv);
}

document.addEventListener('DOMContentLoaded', function () {
  const prevBtn = document.querySelector('.paddlenav-arrow-previous');
  const nextBtn = document.querySelector('.paddlenav-arrow-next');
  const scroller = document.getElementById('scroller');

  // เมื่อกดปุ่ม "Previous" เลื่อนกลับไป 1 ช่อง
  prevBtn.addEventListener('click', function () {
      scroller.scrollBy({ left: -300, behavior: 'smooth' });
  });

  // เมื่อกดปุ่ม "Next" เลื่อนไปข้างหน้า 1 ช่อง
  nextBtn.addEventListener('click', function () {
      scroller.scrollBy({ left: 300, behavior: 'smooth' });
  });
});
``



var currentYear = new Date().getFullYear();
    
// เปลี่ยนเนื้อหาใน <span> ที่มี id="current-year"
document.getElementById('current-year').textContent = currentYear;