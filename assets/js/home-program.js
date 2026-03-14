(function () {

  const container = document.querySelector("#program-list");
  if (!container || !window.CMS) return;

  async function init() {

    try {

      let program = await CMS.loadCollection("/content/program");

      program = program
        .map(i => ({
          ...i,
          slug: Utils.slugify(i.slug || i.title || "")
        }))
        .filter(i => i.slug);

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
          </article>
        `;
        return;
      }

      container.classList.add("home-program-grid");

      container.innerHTML = shown.map(item => {

        const dateStr = formatDateRange(item.start, item.end);

        const summary = item.summary
          ? Utils.escapeHtml(item.summary)
          : "";

        return `
          <a class="card home-program-card" href="/program.html?open=${item.slug}">
            <div class="card__body">
              <h3>${Utils.escapeHtml(item.title)}</h3>
              <div class="muted">
                ${dateStr}
              </div>
              ${summary ? `<p>${summary}</p>` : ""}
            </div>
          </a>
        `;

      }).join("");

    }

    catch (err) {

      console.error("home-program error", err);

      container.innerHTML = `
        <article class="card">
          <h3>Programm</h3>
          <p>Konnte nicht geladen werden.</p>
        </article>
      `;
    }

  }

  init();

})();