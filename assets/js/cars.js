// Autos laden und rendern (Sammlungs-Seite mit Overlay)
(function () {
  const container = document.querySelector("#cars-list");
  if (!container || !window.CMS) return;

  let allCars = [];
  let overlayEl = null;

  function createOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement("div");
    overlayEl.id = "car-overlay";
    overlayEl.innerHTML = `
      <div class="car-overlay__backdrop"></div>
      <div class="car-overlay__dialog" role="dialog" aria-modal="true">
        <button class="car-overlay__close" type="button" aria-label="Schliessen">&times;</button>
        <div class="car-overlay__content"></div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    const backdrop = overlayEl.querySelector(".car-overlay__backdrop");
    const btnClose = overlayEl.querySelector(".car-overlay__close");

    function close() {
      overlayEl.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
    }

    backdrop.addEventListener("click", close);
    btnClose.addEventListener("click", close);

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && overlayEl.classList.contains("is-open")) {
        close();
      }
    });

    overlayEl.close = close;
    return overlayEl;
  }

  function openOverlay(car) {
    const overlay = createOverlay();
    const contentEl = overlay.querySelector(".car-overlay__content");

    const images = car.images
      ? car.images.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const imagesHtml = images.length
      ? `<div class="car-overlay__images">
           ${images
             .map(
               (url) => `
                 <figure class="car-overlay__image">
                   <img src="${url}" alt="${car.title}" loading="lazy">
                 </figure>
               `
             )
             .join("")}
         </div>`
      : "";

    const summaryHtml = car.summary
      ? `<p class="car-overlay__summary">${car.summary}</p>`
      : "";

    const bodyHtml = car.body ? CMS.bodyToHTML(car.body) : "";
    const year = car.year ? ` (${car.year})` : "";

    contentEl.innerHTML = `
      <h2>${car.title}${year}</h2>
      ${summaryHtml}
      ${bodyHtml}
      ${imagesHtml}
    `;

    overlay.classList.add("is-open");
    document.body.classList.add("no-scroll");
  }

  function makeExcerpt(car, maxLen) {
    const fullText = (
      (car.summary ? car.summary + " " : "") +
      (car.body ? car.body : "")
    ).trim();

    if (!fullText) return { text: "", hasMore: false };
    if (fullText.length <= maxLen) {
      return { text: fullText, hasMore: false };
    }

    let cut = fullText.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 0) {
      cut = cut.slice(0, lastSpace);
    }
    return { text: cut + "…", hasMore: true };
  }

  function renderCars(cars) {
    container.innerHTML = cars
      .map((car, index) => {
        const images = car.images
          ? car.images.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        const firstImage = images[0];

        const imgTag = firstImage
          ? `
            <div class="thumb car-card__thumb">
              <img src="${firstImage}" alt="${car.title}" loading="lazy"
                   onerror="this.closest('.car-card__thumb').remove()">
            </div>
          `
          : "";

        const { text, hasMore } = makeExcerpt(car, 260);
        const year = car.year ? ` (${car.year})` : "";

        return `
          <article class="card car-card" id="car-${car.slug}" data-index="${index}" data-slug="${car.slug}">
            <div class="card__body">
              ${imgTag}
              <h2>${car.title}${year}</h2>
              ${text ? `<p class="car-card__text">${text}</p>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function scrollToHash() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith("#car-")) return;
    const el = document.querySelector(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function init() {
    try {
      let cars = await CMS.loadCollection("/content/cars");

      // Sortieren nach Jahr (neueste oben)
      cars.sort((a, b) => Number(a.year || 0) - Number(b.year || 0));

      allCars = cars;
      renderCars(cars);

      // nach dem Rendern ggf. zu einem Anker springen
      scrollToHash();
    } catch (err) {
      console.error("Fehler beim Laden der Autos:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>Die Autos konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  // Klick auf Card -> Overlay
  container.addEventListener("click", (event) => {
    const card = event.target.closest(".car-card");
    if (!card) return;

    const index = Number(card.dataset.index);
    const car = allCars[index];
    if (!car) return;

    openOverlay(car);
  });

  // Falls man später innerhalb der Seite per Hash springt
  window.addEventListener("hashchange", scrollToHash);

  init();
})();
