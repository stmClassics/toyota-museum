// Events auf der Startseite rendern
(function () {
  const container = document.querySelector("#events-list");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let events = await CMS.loadCollection("/content/events");

      const today = new Date().toISOString().slice(0, 10);

      // Kommende Events (oder heute)
      events = events
        .filter(ev => (ev.end || ev.start || ev.date || "") >= today)
        .sort((a, b) => (a.start || a.date || "").localeCompare(b.start || b.date || ""));

      if (events.length === 0) {
        container.innerHTML = `
          <article class="card">
            <h3>Keine geplanten Events</h3>
            <p>Neue Termine folgen bald.</p>
          </article>`;
        return;
      }

      const shown = events.slice(0, 3);

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
          <article class="card">
            ${imgBlock}
            <h3>${ev.title}</h3>
            ${dateLabel ? `<div class="muted">${dateRange}</div>` : ""}
            ${ev.location ? `<div>${ev.location}</div>` : ""}
            ${ev.summary ? `<p>${ev.summary}</p>` : ""}
          </article>
        `;
      }).join("");

    } catch (err) {
      console.error("Fehler beim Laden der Events:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>Events konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  init();
})();
