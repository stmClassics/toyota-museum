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

        const text = excerptFrom(n, isFeatured ? 260 : 140);

        return `
        <article class="card program-card" id="program-${n.slug}" data-slug="${n.slug}">
          <div class="card__body program-card__body">
            ${firstImage ? `
              <div class="program-card__thumb">
                <img src="${firstImage}" alt="${n.title}" loading="lazy"
                    onerror="this.closest('.program-card__thumb').remove()">
              </div>` : ""
            }
            <div class="program-card__content">
              <h3>${n.title}</h3>
              <div class="muted">${formatDateRange(n.start, n.end)}</div>
              ${text ? `<p>${text}</p>` : ""}
            </div>
          </div>
        </article>
        `;
      }).join("");

      container.addEventListener("click", (ev) => {
        const card = ev.target.closest(".program-card");
        if (!card) return;

        const slug = card.dataset.slug; // kommt aus data-slug
        const item = program.find(i => i.slug === slug);
        if (!item) return;

        const images = parseImages(item);
        const pdfHtml = item.pdf
          ? `<div class="overlay__actions">
              <a class="btn" href="${item.pdf}" download>Infos als PDF herunterladen</a>
            </div>`
          : "";

        const metaHtml = `<div class="muted">${formatDateRange(item.start, item.end)}</div>`;

        // body
        const body = (item.body || "").trim();
        const bodyHtml = body
          ? `<p>${Utils.escapeHtml(body)}</p>${pdfHtml}`
          : "";

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
          Overlay.open({
            title: item.title,
            metaHtml: `<div class="muted">${formatDateRange(item.start, item.end)}</div>`,
            bodyHtml: item.body ? CMS.bodyToHTML(item.body) : "",
            images: parseImages(item),
            slug: item.slug
          });
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
