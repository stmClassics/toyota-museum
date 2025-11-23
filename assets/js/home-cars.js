// Teaser: ein paar Fahrzeuge auf der Startseite
(function () {
  const container = document.querySelector("#cars-teaser");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let cars = await CMS.loadCollection("/content/cars");

      // Autos mischen (Fisher-Yates Shuffle)
      for (let i = cars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cars[i], cars[j]] = [cars[j], cars[i]];
      }

      // nur 3 anzeigen
      const shown = cars.slice(0, 3);

      if (shown.length === 0) {
        container.innerHTML = `<article class="card"><h3>Keine Fahrzeuge erfasst</h3><p>Die Sammlung wird bald eingepflegt.</p></article>`;
        return;
      }

      container.innerHTML = shown.map(car => {
        const images = car.images ? car.images.split(",") : [];
        const imgTag = images.length
          ? `<div class="thumb"><img src="${images[0]}" alt="${car.title}" loading="lazy" onerror="this.closest('.thumb').remove()"></div>`
          : "";

        return `
          <article class="card">
            ${imgTag}
            <h3>${car.title} ${car.year ? `(${car.year})` : ""}</h3>
            ${car.summary ? `<p>${car.summary}</p>` : ""}
          </article>
        `;
      }).join("");
    } catch (err) {
      console.error("Fehler beim Laden der Fahrzeug-Teaser:", err);
      container.innerHTML = `<article class="card"><h3>Fehler</h3><p>Fahrzeuge konnten nicht geladen werden.</p></article>`;
    }
  }

  init();
})();
