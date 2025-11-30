// Activities auf der Startseite rendern
(function () {
  const container = document.querySelector("#activities-list");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let activities = await CMS.loadCollection("/content/activities");

      const today = new Date().toISOString().slice(0, 10);

      // Kommende Activities (oder heute)
      activities = activities
        .filter(ev => (ev.end || ev.start || ev.date || "") >= today)
        .sort((a, b) => (a.start || a.date || "").localeCompare(b.start || b.date || ""));

      if (activities.length === 0) {
        container.innerHTML = `
          <article class="card">
            <h3>Keine Beiträge gefunden</h3>
            <p>Neue Informationen folgen bald.</p>
          </article>`;
        return;
      }

      const shown = activities.slice(0, 3);

      container.innerHTML = shown.map((ev) => {
        const hasImage = ev.hero && ev.hero.trim() !== "";
        const imgBlock = hasImage
          ? `<div class="thumb">
               <img src="${ev.hero}" alt="${ev.title}" loading="lazy"
                    onerror="this.parentNode.remove()">
             </div>`
          : "";

        const dateLabel = CMS.formatDate(ev.start || ev.date);
        const dateRange =
          ev.end && ev.end !== ev.start
            ? `${dateLabel} – ${CMS.formatDate(ev.end)}`
            : dateLabel;

        return `
          <a class="card" href="/activities.html">
            <div class="card__body">
              ${imgBlock}
              <h3>${ev.title}</h3>
              ${dateLabel ? `<div class="muted">${dateRange}</div>` : ""}
              ${ev.location ? `<div>${ev.location}</div>` : ""}
              ${ev.summary ? `<p>${ev.summary}</p>` : ""}
            </div>
          </a>
        `;
      }).join("");

    } catch (err) {
      console.error("Fehler beim Laden der Beiträge:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>Die Beiträge konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  init();
})();
