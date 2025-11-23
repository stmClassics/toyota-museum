// Alle Events (kommende + vergangene) als Liste
(function () {
  const container = document.querySelector("#events-all");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let events = await CMS.loadCollection("/content/events");

      // Nach Datum sortieren (neueste zuerst)
      events.sort((a, b) => (b.start || "").localeCompare(a.start || ""));

      if (events.length === 0) {
        container.innerHTML = `<article class="card"><h3>Keine Events</h3><p>Es sind noch keine Veranstaltungen erfasst.</p></article>`;
        return;
      }

      container.innerHTML = events.map(e => `
        <article class="card">
          <h2>${e.title}</h2>
          <div class="muted">
            ${CMS.formatDate(e.start)}${
              e.end && e.end !== e.start ? " – " + CMS.formatDate(e.end) : ""
            }
          </div>
          ${e.location ? `<div>${e.location}</div>` : ""}
          ${e.summary ? `<p>${e.summary}</p>` : ""}
          ${e.link ? `<p><a href="${e.link}" target="_blank" rel="noopener">Karte / Infos</a></p>` : ""}
          ${e.body ? CMS.bodyToHTML(e.body) : ""}
        </article>
      `).join("");
    } catch (err) {
      console.error("Fehler beim Laden aller Events:", err);
      container.innerHTML = `<article class="card"><h3>Fehler</h3><p>Die Eventliste konnte nicht geladen werden.</p></article>`;
    }
  }

  init();
})();
