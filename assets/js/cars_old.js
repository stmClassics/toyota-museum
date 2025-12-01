// Autos laden und rendern (Sammlungs-Seite)
(function () {
  const container = document.querySelector("#cars-list");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let cars = await CMS.loadCollection("/content/cars");

      // Sortieren nach Jahr (neueste oben)
      cars.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));

      container.innerHTML = cars.map(car => {
        const images = car.images
          ? car.images.split(",").map(url => url.trim())
          : [];

        const imgTag = images.length
          ? `<div class="thumb"><img src="${images[0]}" alt="${car.title}" loading="lazy" onerror="this.closest('.thumb').remove()"></div>`          
          : "";

        return `
          <article class="card">
            <div class="card__body">
              ${imgTag}
              <h2>${car.title} ${car.year ? `(${car.year})` : ""}</h2>
              ${car.summary ? `<p>${car.summary}</p>` : ""}
              ${
                images.length > 1
                  ? `<details><summary>Bilder</summary>
                      ${images
                        .map(url => `<img src="${url}" alt="" loading="lazy" style="margin-bottom:10px;border-radius:8px;">`)
                        .join("")}
                    </details>`
                  : ""
              }
              ${car.body ? CMS.bodyToHTML(car.body) : ""}
            </article>
          </div>
        `;
      }).join("");

    } catch (err) {
      console.error("Fehler beim Laden der Autos:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>Die Autos konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  init();
})();
