// insights auf der Startseite rendern (2 Stück, Bild links quadratisch)
(function () {
  const container = document.querySelector("#program-list");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let program = await CMS.loadCollection("/content/program");

      program = program.map(i => ({
          ...i,
          slug: Utils.slugify(i.slug || i.title || "")
        }))        .filter(i => i.slug);

      program = program
        .map(normalizeDateRange)
        .filter(isOngoingOrUpcoming)
        .sort(sortByStartDate);

      const shown = program.slice(0, 6);

      if (!shown.length) {
        container.innerHTML = `
          <article class="card">
            <h3>Programm</h3>
            <p>Keine Einträge vorhanden.</p>
          </article>`;
        return;
      }

      container.innerHTML = shown.map((item) => {
      const images = item.images
        ? item.images.split(",").map(s => s.trim()).filter(Boolean)
        : [];

      const firstImage = images.length ? images[0] : "";

      const imgBlock = firstImage
        ? `<div class="content-teaser__thumb">
            <img src="${firstImage}" alt="${item.title}" loading="lazy"
                  onerror="this.closest('.content-teaser__thumb').remove()">
          </div>`
        : "";

        const dateStr = formatDateRange(item.start, item.end);

        // Text: Summary bevorzugen, sonst Body als Plain-Text anreissen
        const text =
          (item.summary && item.summary.trim()) ||
          (item.body ? String(item.body).replace(/\s+/g, " ").trim() : "");

        const excerpt = text.length > 180 ? (text.slice(0, 180).trim() + "…") : text;

        return `
          <a class="card content-teaser" href="/program.html?open=${item.slug}">
            <div class="card__body content-teaser__body">
              ${imgBlock}
              <div class="content-teaser__content">
                <h3>${item.title}</h3>
                <div class="muted">${dateStr}</div>
                ${excerpt ? `<p>${excerpt}</p>` : ""}
              </div>
            </div>
          </a>
        `;
      }).join("");

    } catch (err) {
      console.error("Fehler beim Laden des Programms:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>Das Programm konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  init();
})();
