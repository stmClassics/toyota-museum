// program auf der Startseite rendern (2 Stück, Bild links quadratisch)
(function () {
  const container = document.querySelector("#program-list");
  if (!container || !window.CMS) return;

  const parseImages = (item) =>
    item.images ? item.images.split(",").map(s => s.trim()).filter(Boolean) : [];

  const excerptFrom = (item, maxLen) => {
    const text = (
      (item.summary ? item.summary + " " : "") +
      (item.body ? String(item.body).replace(/\s+/g, " ").trim() : "")
    ).trim();

    if (!text) return "";
    if (text.length <= maxLen) return text;

    let cut = text.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 0) cut = cut.slice(0, lastSpace);
    return cut + "…";
  };

  async function init() {
    try {
      let items = await CMS.loadCollection("/content/program");

      // Slugify robust
      items = items
        .map(i => ({
          ...i,
          slug: Utils.slugify(i.slug || i.title || "")
        }))
        .filter(i => i.slug);

      // "Aktuell" = bis Enddatum (oder Start wenn kein End)
      const today = todayStartZurich();

      items = items
        .map(normalizeDateRange)
        .filter(isOngoingOrUpcoming)
        .sort(sortByStartDate);

      const shown = items.slice(0, 2);

      if (shown.length === 0) {
        container.innerHTML = `
          <article class="card">
            <h3>Programm</h3>
            <p>Derzeit sind keine Termine eingetragen.</p>
            <p><a href="/program.html" class="link">Zum Programm</a></p>
          </article>`;
        return;
      }

      container.innerHTML = shown.map((item) => {

        // Text: Summary bevorzugen, sonst Body als Plain-Text anreissen
        const text =
          (item.summary && item.summary.trim()) ||
          (item.body ? String(item.body).replace(/\s+/g, " ").trim() : "");

        const excerpt = text.length > 180 ? (text.slice(0, 180).trim() + "…") : text;

        // Datum: Start/End (ein Datum wenn gleich)
        const dateStr = formatDateRange(item.start, item.end);

        return `
          <a class="card insight-teaser" href="/program.html#program-${item.slug}">
            <div class="card__body insight-teaser__body">
              <div class="insight-teaser__content">
                <h3>${item.title}</h3>
                <div class="muted">${dateStr}</div>
                ${excerpt ? `<p>${excerpt}</p>` : ""}
              </div>
            </div>
          </a>
        `;
      }).join("");

    } catch (err) {
      console.error("Fehler beim Laden des Programms (Home):", err);
      container.innerHTML = `
        <article class="card">
          <h3>Programm</h3>
          <p>Das Programm konnte nicht geladen werden.</p>
        </article>`;
    }
  }

  init();
})();
