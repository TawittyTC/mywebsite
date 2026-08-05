# Component Library — ใช้ซ้ำได้ทุก section (และเว็บอื่นในอนาคต)

ทุก component ในเว็บนี้เป็น **HTML class + JS auto-init** ล้วนๆ ไม่มี framework
— แค่ copy markup ไปวาง (และถ้าใช้นอกโปรเจกต์นี้ ให้เอา `style.css` ส่วนที่เกี่ยวข้อง
กับ `main.js` ส่วน component ไปด้วย) ทุกอย่าง initialize ตัวเองตอน DOMContentLoaded
ผ่าน data-attribute ไม่ต้องเขียน JS เพิ่มเลย

---

## 1. Card Scroller (แถวการ์ดเลื่อนแนวนอน + ลูกศร + hint บนมือถือ)

ใช้อยู่ที่: Skills, My Projects

```html
<section id="my-section">
  <div class="rf-cards-scroller">
    <div class="rf-cards-scroller-overflow" data-card-scroller>
      <div class="rf-cards-scroller-item">…การ์ดใบที่ 1…</div>
      <div class="rf-cards-scroller-item">…การ์ดใบที่ 2…</div>
    </div>
    <div class="paddlenav">
      <button type="button" class="paddlenav-arrow" data-scroller-prev aria-label="Previous">‹</button>
      <button type="button" class="paddlenav-arrow" data-scroller-next aria-label="Next">›</button>
    </div>
  </div>
</section>
```

สิ่งที่ได้อัตโนมัติเมื่อใส่ `data-card-scroller`:
- ลูกศรเลื่อนทีละก้าว (ค่าเริ่ม 400px — ปรับได้ด้วย `data-scroller-step="480"`)
- ลูกศร enable/disable ตามตำแหน่งซ้ายสุด/ขวาสุดเอง
- มือถือ: การ์ดขยับซ้าย-กลับเป็นจังหวะเพื่อบอกว่าเลื่อนได้ และหยุดเมื่อผู้ใช้แตะเอง

ลูกศรถูกหาจาก `[data-scroller-prev]` / `[data-scroller-next]` ภายใน `<section>`
เดียวกัน (หนึ่ง section ต่อหนึ่ง scroller) — ควบคุมด้วยโค้ดได้ผ่าน
`el._cardScroller.update()` / `el._cardScroller.reset()`
หรือเรียก `createCardScroller(el, { prev, next, step })` เองก็ได้

## 2. Filter Chips (ปุ่มกรองการ์ดใน scroller)

ใช้อยู่ที่: My Projects — กรองเฉพาะการ์ดใน `#portfolio` เท่านั้น

```html
<div class="project-filters">
  <button class="filter-btn active" data-filter="all">All</button>
  <button class="filter-btn" data-filter="iot">IoT / AWS</button>
</div>
<!-- การ์ดที่จะถูกกรอง ใส่ data-tech ให้ตรงกับ data-filter -->
<div class="rf-cards-scroller-item" data-tech="iot">…</div>
```

## 3. Project Card (การ์ดผลงาน มีรูป + แท็ก + ชื่อ)

```html
<div class="rf-cards-scroller-item" data-tech="iot">
  <div class="project-img">
    <img src="assets/img/project/xxx.webp" alt="ชื่อโปรเจกต์" loading="lazy">
  </div>
  <span class="project-tag">IoT / AWS</span>
  <h4>ชื่อโปรเจกต์</h4>
  <p class="fw-light">เทคโนโลยีที่ใช้</p>
</div>
```

## 4. Skill Card (การ์ดไอคอน + หัวข้อ + คำอธิบาย)

```html
<!-- ต้องอยู่ใน <section id="skill"> หรือ section ที่มี override เดียวกัน -->
<div class="rf-cards-scroller-item">
  <img class="skill-icon" src="assets/img/icon/xxx.svg" alt="" loading="lazy">
  <div class="title">Web Design</div>
  <p class="skill-desc">UX/UI, Graphic &amp; Responsive Design</p>
</div>
```

## 5. Experience / ประวัติ Card (`.data-box` — การ์ดใหญ่มีเงาพัก)

การ์ดเอนกประสงค์ พื้นขาว มุม `--r-card` (28px) เงานุ่มตอนพัก ลอยขึ้นตอน hover
scroll-scrub entrance อัตโนมัติ (การ์ดใน `#resume`/`#experience` ถูก arm ให้เอง)

```html
<div class="data-box">
  <h3>Full Stack Developer</h3>
  <p class="fw-light">at Company Co., Ltd.</p>
  <div class="fw-light profile-bio-small mt-3">คำอธิบายงาน…</div>
</div>
```

ของประกอบที่ใช้ร่วมกับการ์ดนี้ได้ (ดู markup จริงใน `index.html` ที่ `#experience`):
- ชิปสถานะ: `<span class="exp-status-active">Active</span>` (เขียว = semantic)
- ชิประยะเวลา: `<span class="exp-duration">2 yr</span>`
- ตัวเลขนับขึ้นเมื่อเลื่อนถึง: `<span class="js-count" data-count="27">27</span>`
- แถวสถิติ: `.exp-card-stats > .exp-stat-item > .exp-stat-num / .exp-stat-label`
- ชิป tech: `.exp-card-stack > span`

## 6. Profile Card (การ์ดแนะนำตัว รูป + ข้อความ)

```html
<div class="data-box profile-featured">
  <div class="profile-featured-img"><img src="assets/img/profile.webp" alt="ชื่อ"></div>
  <div class="profile-featured-body">
    <h3>ชื่อ นามสกุล</h3>
    <p class="profile-bio">แนะนำตัว…</p>
  </div>
</div>
```

## 7. Certificate Card + Grid + Lightbox

Grid ใบ cert ถูกสร้างด้วย JS จาก array — เพิ่มใบใหม่แค่เพิ่มรายการใน
`imageList` ใน `assets/js/main.js` (รูปวางที่ `assets/img/certificate/`,
บีบเป็น AVIF อัตราส่วน 4:3):

```js
{ src: 'assets/img/certificate/img-34.avif', alt: 'คำอธิบายใบ cert' }
```

โครงการ์ดที่ระบบสร้างให้ (ถ้าจะใช้เดี่ยวๆ นอก grid):

```html
<div class="cert-card">
  <div class="cert-img"><img src="…" alt="…" loading="lazy"></div>
  <button class="cert-expand-btn" aria-label="Expand">+</button>
</div>
```

กดการ์ดแล้วเปิด lightbox เต็มจอ (`.cert-lightbox`) พร้อม entrance zoom — ปิดด้วย
Escape/แตะพื้นหลังได้ อยู่ในระบบอยู่แล้ว ไม่ต้องเขียนเพิ่ม

## 8. Closing CTA (section ปิดท้าย gradient headline)

```html
<section id="contact" class="closing-cta">
  <div class="container">
    <div class="cta-inner">
      <h2 class="cta-headline">Let's build<br>what's next.</h2>
      <p class="cta-sub">ข้อความรอง…</p>
      <div class="cta-actions">
        <a class="cta-mail" href="mailto:you@mail.com">you@mail.com</a>
        <a class="cta-tel" href="tel:+66000000000">+66 00 000 0000</a>
      </div>
    </div>
  </div>
</section>
```

---

## กติกากลางของระบบ (ใช้กับทุก component)

- **มุมโค้ง concentric**: มุมใน = มุมนอก − ช่องว่าง (โทเคน `--r-card` 28 /
  `--r-card-sm` 18 / `--r-min` 12 / `--r-capsule` แคปซูล)
- **สี 60/30/10**: พื้นขาว 60% / เทากลาง `--color-fill` 30% / สีอำพัน
  `--color-link` (#B4602A) 10% — สีเขียวใช้เฉพาะสถานะ
- **Motion**: easing เดียวทั้งเว็บ `--ease-swift`; ปุ่มทุกปุ่มมี press feedback
  (`:active` scale); การ์ดใหม่ใน section ที่ระบุไว้จะได้ scroll-scrub entrance เอง
  (เพิ่ม selector ได้ในตัวแปร `GROUPS` ใน `main.js`)
- **แก้ไฟล์แล้วต้อง**: รัน `./build.sh`, bump เวอร์ชัน `?v=` ใน `index.html` +
  `sw.js` ให้ตรงกัน, bump `CACHE` ใน `sw.js`, แล้ว `npm test` (45 เทส) ก่อน merge
