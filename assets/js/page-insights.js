// Alle insights als Liste
(function () {
  const container = document.querySelector("#insights-all");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let insights = await CMS.loadCollection("/content/insights");

      // Nach Datum neueste zuerst
      insights.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      if (insights.length === 0) {
        container.innerHTML = `<article class="card"><h3>Keine Insights</h3><p>Es sind noch keine Meldungen erfasst.</p></article>`;
        return;
      }

      container.innerHTML = insights.map(n => `
        <article class="card">
          ${n.hero ? `<img src="${n.hero}" alt="${n.title}" loading="lazy" onerror="this.closest('.thumb').remove()">` : ""}
          <h2>${n.title}</h2>
          <div class="muted">${CMS.formatDate(n.date)}</div>
          ${n.summary ? `<p><strong>${n.summary}</strong></p>` : ""}
          ${n.body ? CMS.bodyToHTML(n.body) : ""}
        </article>
      `).join("");
    } catch (err) {
      console.error("Fehler beim Laden aller Insights:", err);
      container.innerHTML = `<article class="card"><h3>Fehler</h3><p>Die Liste der Insights konnte nicht geladen werden.</p></article>`;
    }
  }

  init();
})();
