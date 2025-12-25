// page-cars.js — Autos laden & rendern (Sammlungs-Seite mit Overlay-Modul)
(function () {
  const container = document.querySelector("#cars-list");
  if (!container || !window.CMS) return;

  let allCars = [];

  const parseImages = (item) =>
    item.images ? item.images.split(",").map(s => s.trim()).filter(Boolean) : [];

  function makeExcerpt(car, maxLen) {
    const fullText = (
      (car.summary ? car.summary + " " : "") +
      (car.body ? String(car.body).replace(/\s+/g, " ").trim() : "")
    ).trim();

    if (!fullText) return "";
    if (fullText.length <= maxLen) return fullText;

    let cut = fullText.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 0) cut = cut.slice(0, lastSpace);
    return cut + "…";
  }

  function renderCars(cars) {
    container.innerHTML = cars
      .map((car) => {
        const imgs = parseImages(car);
        const firstImage = imgs[0] || "";
        const year = car.year ? ` (${car.year})` : "";
        const text = makeExcerpt(car, 260);

        const imgTag = firstImage
          ? `
            <div class="thumb car-card__thumb">
              <img src="${firstImage}" alt="${Utils.escapeHtml(car.title || "")}" loading="lazy"
                   onerror="this.closest('.car-card__thumb').remove()">
            </div>
          `
          : "";

          return `
            <article class="card car-card" id="car-${car.slug}" data-slug="${car.slug}">
              ${firstImage ? `
                <div class="car-card__thumb">
                  <img src="${firstImage}" alt="${Utils.escapeHtml(car.title || "")}" loading="lazy"
                      onerror="this.closest('.car-card__thumb').remove()">
                </div>` : ""
              }
              <div class="car-card__body">
                <h3>${Utils.escapeHtml(car.title || "")}${year}</h3>
                ${text ? `<p class="car-card__text">${Utils.escapeHtml(text)}</p>` : ""}
              </div>
            </article>
          `;

      })
      .join("");
  }

  // Klick auf Card -> Overlay (einmalig registrieren)
  container.addEventListener("click", (ev) => {
    const card = ev.target.closest(".car-card");
    if (!card) return;

    const slug = card.dataset.slug;
    const item = allCars.find((c) => c.slug === slug);
    if (!item) return;

    const images = parseImages(item);

    const metaHtml = item.year ? `<div class="muted">${Utils.escapeHtml(item.year)}</div>` : "";

    const bodyText = (
      (item.summary ? item.summary + "\n\n" : "") +
      (item.body ? String(item.body) : "")
    ).trim();

    // einfache Textdarstellung (später gern hübscher/mit Absätzen)
    const bodyHtml = bodyText ? `<p>${Utils.escapeHtml(bodyText)}</p>` : "";

    Overlay.open({
      title: item.title || item.name || "",
      metaHtml,
      bodyHtml,
      images,
      slug: item.slug,
    });
  });

  async function init() {
    try {
      let cars = await CMS.loadCollection("/content/cars");

      // Slugify (robust)
      cars = cars
        .map((c) => ({
          ...c,
          slug: Utils.slugify(c.slug || c.title || c.name || ""),
        }))
        .filter((c) => c.slug);

      // Sort: alt zuerst (klein -> gross)
      cars.sort((a, b) => Number(a.year || 0) - Number(b.year || 0));

      allCars = cars;
      renderCars(cars);

      // nach dem Rendern ggf. zu einem Anker springen
      ScrollUtils.scrollToHash({ prefix: "car-", offset: 90 });
    } catch (err) {
      console.error("Fehler beim Laden der Autos:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>Die Autos konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  // Falls man innerhalb der Seite per Hash springt
  window.addEventListener("hashchange", () =>
    ScrollUtils.scrollToHash({ prefix: "car-", offset: 90 })
  );

  init();
})();
