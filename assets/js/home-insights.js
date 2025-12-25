// insights auf der Startseite rendern (2 Stück, Bild links quadratisch)
(function () {
  const container = document.querySelector("#insights-list");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let insights = await CMS.loadCollection("/content/insights");

      insights = insights.map(i => ({
        ...i,
        slug: Utils.slugify(i.slug || i.title || "")
      })).filter(i => i.slug);
            
      const todayISO = todayISOZurich();
      insights = insights.filter(i => isPublishedByDate(i, todayISO));

      // Nach Datum absteigend sortieren (neueste zuerst)
      insights.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      if (insights.length === 0) {
        container.innerHTML = `
          <article class="card">
            <h3>Keine Geschichten</h3>
            <p>Neuigkeiten folgen bald.</p>
          </article>`;
        return;
      }

      const shown = insights.slice(0, 2);

      container.innerHTML = shown.map((item) => {
      const images = item.images
        ? item.images.split(",").map(s => s.trim()).filter(Boolean)
        : [];

      const firstImage = images.length ? images[0] : "";

      const imgBlock = firstImage
        ? `<div class="insight-teaser__thumb">
            <img src="${firstImage}" alt="${item.title}" loading="lazy"
                  onerror="this.closest('.insight-teaser__thumb').remove()">
          </div>`
        : "";

        // Text: Summary bevorzugen, sonst Body als Plain-Text anreissen
        const text =
          (item.summary && item.summary.trim()) ||
          (item.body ? String(item.body).replace(/\s+/g, " ").trim() : "");

        const excerpt = text.length > 180 ? (text.slice(0, 180).trim() + "…") : text;

        return `
          <a class="card insight-teaser" href="/insights.html#insight-${item.slug}">
            <div class="card__body insight-teaser__body">
              ${imgBlock}
              <div class="insight-teaser__content">
                <h3>${item.title}</h3>
                <div class="muted">${CMS.formatDate(item.date)}</div>
                ${excerpt ? `<p>${excerpt}</p>` : ""}
              </div>
            </div>
          </a>
        `;
      }).join("");

    } catch (err) {
      console.error("Fehler beim Laden der Insights:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>Die Geschichten konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  init();
})();
