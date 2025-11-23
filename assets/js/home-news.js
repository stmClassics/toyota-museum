// News auf der Startseite rendern
(function () {
  const container = document.querySelector("#news-list");
  if (!container || !window.CMS) return;

  async function init() {
    try {
      let news = await CMS.loadCollection("/content/news");

      // Nach Datum absteigend sortieren
      news = news.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      if (news.length === 0) {
        container.innerHTML = `
          <article class="card">
            <h3>Keine News</h3>
            <p>Neuigkeiten folgen bald.</p>
          </article>`;
        return;
      }

      const shown = news.slice(0, 3);

      container.innerHTML = shown.map((item) => {
        const hasImage = item.hero && item.hero.trim() !== "";
        const imgBlock = hasImage
          ? `<div class="thumb">
               <img src="${item.hero}" alt="${item.title}" loading="lazy"
                    onerror="this.parentNode.remove()">
             </div>`
          : "";

        return `
          <article class="card">
            ${imgBlock}
            <h3>${item.title}</h3>
            <div class="muted">${CMS.formatDate(item.date)}</div>
            ${item.summary ? `<p>${item.summary}</p>` : ""}
            ${item.body ? `<details><summary>Mehr lesen</summary>${CMS.bodyToHTML(item.body)}</details>` : ""}
          </article>
        `;
      }).join("");

    } catch (err) {
      console.error("Fehler beim Laden der News:", err);
      container.innerHTML = `
        <article class="card">
          <h3>Fehler</h3>
          <p>News konnten nicht geladen werden.</p>
        </article>`;
    }
  }

  init();
})();
