// ลดการเข้าถึง DOM
const navbarlinks = select("#navbar .scrollto", true);
const preloader = select("#preloader");
const typed = select(".typed");
const imagesList = document.getElementById("images-list");
const carouselInner = document.getElementById("carousel-inner");

// ตัวอย่างการสร้าง carousel items
const createCarouselItems = (count) => {
  const items = Array.from({ length: count }, (_, i) => {
    const imageSrc = `assets/img/certificate/img (${i + 1}).jpg`;
    const carouselItem = document.createElement("div");
    carouselItem.classList.add("carousel-item", i === 0 ? "active" : "");
    const imgElement = document.createElement("img");
    imgElement.src = imageSrc;
    imgElement.className = "d-block w-100 img-fluid lazyload";
    imgElement.alt = "";
    imgElement.loading = "lazy";
    carouselItem.appendChild(imgElement);
    return carouselItem;
  });
  carouselInner.append(...items);
};

// เรียกใช้ฟังก์ชันสร้าง carousel
createCarouselItems(30);

// ปรับปรุงการโหลดภาพใน images list
const createImageListItems = (count) => {
  Array.from({ length: count }, (_, i) => {
    const imageSrc = `assets/img/certificate/img (${i + 1}).jpg`;
    const colDiv = document.createElement("div");
    colDiv.classList.add("col-12", "col-md-6", "col-lg-3", "mb-4");
    const imgElement = document.createElement("img");
    imgElement.src = imageSrc;
    imgElement.className = "img-fluid lazyload";
    imgElement.alt = "Certificate Image";
    imgElement.loading = "lazy";
    imgElement.onclick = () => {
      document.getElementById("modalImage").src = imageSrc;
      new bootstrap.Modal(document.getElementById("imageModal")).show();
    };
    colDiv.appendChild(imgElement);
    imagesList.appendChild(colDiv);
  });
};

// เรียกใช้ฟังก์ชันสร้าง image list
createImageListItems(30);
