// Alle News als Liste
(function () {
  const container = document.querySelector("#news-all");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let news = await CMS.loadCollection("/content/news");

      // Nach Datum neueste zuerst
      news.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      if (news.length === 0) {
        container.innerHTML = `<article class="card"><h3>Keine News</h3><p>Es sind noch keine Meldungen erfasst.</p></article>`;
        return;
      }

      container.innerHTML = news.map(n => `
        <article class="card">
          ${n.hero ? `<img src="${n.hero}" alt="${n.title}" loading="lazy" onerror="this.closest('.thumb').remove()">` : ""}
          <h2>${n.title}</h2>
          <div class="muted">${CMS.formatDate(n.date)}</div>
          ${n.summary ? `<p><strong>${n.summary}</strong></p>` : ""}
          ${n.body ? CMS.bodyToHTML(n.body) : ""}
        </article>
      `).join("");
    } catch (err) {
      console.error("Fehler beim Laden aller News:", err);
      container.innerHTML = `<article class="card"><h3>Fehler</h3><p>Die Newsliste konnte nicht geladen werden.</p></article>`;
    }
  }

  init();
})();
