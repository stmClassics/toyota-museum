// insights auf der Startseite rendern
(function () {
  const container = document.querySelector("#insights-list");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let insights = await CMS.loadCollection("/content/insights");

      // Nach Datum absteigend sortieren
      insights = insights.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      if (insights.length === 0) {
        container.innerHTML = `
          <article class="card">
            <h3>Keine insights</h3>
            <p>Neuigkeiten folgen bald.</p>
          </article>`;
        return;
      }

      const shown = insights.slice(0, 3);

      container.innerHTML = shown.map((item) => {
        const hasImage = item.hero && item.hero.trim() !== "";
        const imgBlock = hasImage
          ? `<div class="thumb">
               <img src="${item.hero}" alt="${item.title}" loading="lazy"
                    onerror="this.parentNode.remove()">
             </div>`
          : "";

        return `
          <a class="card" href="/insights.html">
          <div class="card__body">
              ${imgBlock}
              <h3>${item.title}</h3>
              <div class="muted">${CMS.formatDate(item.date)}</div>
              ${item.summary ? `<p>${item.summary}</p>` : ""}
              ${item.body ? `<details><summary>Mehr lesen</summary>${CMS.bodyToHTML(item.body)}</details>` : ""}
            </div>
          </a>
        `;
      }).join("");

    } catch (err) {
      console.error("Fehler beim Laden der Insights:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>Die Insights konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  init();
})();
