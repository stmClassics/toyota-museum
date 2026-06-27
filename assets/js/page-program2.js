// /program.html: Editorial-Grid, Featured = neuester, #program-slug Support
(function () {
  const container = document.querySelector("#program-all");
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
      let program = await CMS.loadCollection("/content/program");

      program = program.map(i => ({
        ...i,
        slug: Utils.slugify(i.slug || i.title || "")
      })).filter(i => i.slug);

      program = program
        .map(normalizeDateRange)
        .filter(isOngoingOrUpcoming)
        .sort(sortByStartDate);

      program.sort((a, b) => a._start - b._start);

      if (program.length === 0) {
        container.innerHTML = `<article class="card"><h3>Programm</h3><p>Es ist noch kein Programm erfasst.</p></article>`;
        return;
      }

      const featuredSlug = program[0]?.slug;

      container.classList.add("program-grid");

      container.innerHTML = program.map((n) => {
        const imgs = parseImages(n);
        const firstImage = imgs[0] || "";
        const isFeatured = n.slug === featuredSlug;

        const text = excerptFrom(n, isFeatured ? 140 : 140);

        return `
        <article class="card content-teaser" id="program-${n.slug}" data-slug="${n.slug}">
            <div class="card__body content-teaser__body">
              ${firstImage ? `
                <div class="content-teaser__thumb">
                  <img src="${firstImage}" alt="${n.title}" loading="lazy"
                      onerror="this.closest('.content-card__thumb').remove()">
                </div>` : ""
              }          
              <div class="content-teaser__content">
                <h3>${n.title}</h3>
                <div class="muted">${formatDateRange(n.start, n.end)}</div>
                ${text ? `<p>${text}</p>` : ""}
              </div>
            </div>
        </article>
        `;
      }).join("");

      container.addEventListener("click", (ev) => {
        const card = ev.target.closest(".content-teaser");
        if (!card) return;

        const slug = card.dataset.slug; // kommt aus data-slug
        const item = program.find(i => i.slug === slug);
        if (!item) return;

        const images = parseImages(item);
        const metaHtml = `<div class="muted">${formatDateRange(item.start, item.end)}</div>`;
 
        const summary = (item.summary || "").trim();
        const body = (item.body || "").trim();

        const pdfHtml = item.pdf
          ? `<div class="overlay__actions">
              <a class="btn" href="${item.pdf}" target="_blank" rel="noopener">Infos im PDF-Format</a>
            </div>`
          : "";

        const linkHtml = item.link
          ? `<div class="overlay__actions">
              <a class="btn" href="${item.link}" target="_blank" rel="noopener">
                ${item.linktext || "Link öffnen"}
              </a>
            </div>`
            : "";

        const bodyHtml = `
          ${summary ? `<p class="lead">${Utils.escapeHtml(summary)}</p>` : ""}
          ${body ? CMS.bodyToHTML(body) : ""}
          ${linkHtml}            
          ${pdfHtml}
        `;

        Overlay.open({
          title: item.title,
          metaHtml,
          bodyHtml,
          images,
          slug: item.slug
        });
      });

      // Overlay per Deeplink direkt öffnen
      OverlayDeepLink.init({
        items: program,
        open: (item) => {
          const images = item.images ? parseImages(item) : [];
          const metaHtml = item.year ? `<div class="muted">${formatDateRange(item.start, item.end)}</div>` : "";
          const summary = (item.summary || "").trim();
          const body = (item.body || "").trim();

          const pdfHtml = item.pdf
            ? `<div class="overlay__actions">
                <a class="btn" href="${item.pdf}" target="_blank" rel="noopener">Infos im PDF-Format</a>
              </div>`
            : "";

          const linkHtml = item.link
            ? `<div class="overlay__actions">
                <a class="btn" href="${item.link}" target="_blank" rel="noopener">
                  ${item.linktext || "Link öffnen"}
                </a>
              </div>`
            : "";

          const bodyHtml = `
            ${summary ? `<p class="lead">${Utils.escapeHtml(summary)}</p>` : ""}
            ${body ? CMS.bodyToHTML(body) : ""}
            ${linkHtml}            
            ${pdfHtml}
          `;

          Overlay.open({ title: item.title, metaHtml, bodyHtml, images, slug: item.slug });
        }
      });          

      ScrollUtils.scrollToHash({ prefix: "program-", offset: 90 });
      window.addEventListener("hashchange", () =>
        ScrollUtils.scrollToHash({ prefix: "program-", offset: 90 })
      );

    } catch (err) {
      console.error("Fehler beim Laden des Programms:", err);
      container.innerHTML = `<article class="card"><h3>Fehler</h3><p>Die Liste des Programms konnte nicht geladen werden.</p></article>`;
    }
  }

  init();
})();
