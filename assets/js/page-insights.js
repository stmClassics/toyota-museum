// /insights.html: Editorial-Grid, Featured = neuester, #insight-slug Support
(function () {
  const container = document.querySelector("#insights-all");
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
      let insights = await CMS.loadCollection("/content/insights");

      insights = insights.map(i => ({
        ...i,
        slug: Utils.slugify(i.slug || i.title || "")
      })).filter(i => i.slug);

      const todayISO = todayISOZurich();
      insights = insights
        .filter(i => isPublishedByDate(i, todayISO));

      
      
        insights.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      if (insights.length === 0) {
        container.innerHTML = `<article class="card"><h3>Keine Geschichten</h3><p>Es sind noch keine Meldungen erfasst.</p></article>`;
        return;
      }

      const featuredSlug = insights[0]?.slug;

      container.classList.add("program-grid");

      container.innerHTML = insights.map((n) => {
        const imgs = parseImages(n);
        const firstImage = imgs[0] || "";
        const isFeatured = n.slug === featuredSlug;

        const text = excerptFrom(n, isFeatured ? 210 : 210);

        return `
          <article class="card insight-card ${isFeatured ? "is-featured" : ""}" id="insight-${n.slug}" data-slug="${n.slug}">
            ${firstImage ? `
              <div class="insight-card__thumb">
                <img src="${firstImage}" alt="${n.title}" loading="lazy"
                     onerror="this.closest('.insight-card__thumb').remove()">
              </div>` : ""
            }
            <div class="insight-card__body">
              <h3>${n.title}</h3>
              <div class="muted">${CMS.formatDate(n.date)}</div>
              ${text ? `<p>${text}</p>` : ""}
            </div>
          </article>
        `;
      }).join("");

      container.addEventListener("click", (ev) => {
        const card = ev.target.closest(".insight-card");
        if (!card) return;

        const slug = card.dataset.slug; // kommt aus data-slug
        const item = insights.find(i => i.slug === slug);
        if (!item) return;

        const images = parseImages(item);
        const metaHtml = `<div class="muted">${CMS.formatDate(item.date)}</div>`;

        // body: fürs Erste plain text (später hübscher)
        const body = (item.body || "").trim();
        const bodyHtml = body ? `<p>${Utils.escapeHtml(body)}</p>` : "";

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
        items: insights,
        open: (item) => {
          const images = item.images ? parseImages(item) : [];
          const metaHtml = item.year ? `<div class="muted">${CMS.formatDate(item.date)}</div>` : "";
          const bodyHtml = item.body ? CMS.bodyToHTML(item.body) : "";

          Overlay.open({ title: item.title, metaHtml, bodyHtml, images, slug: item.slug });
        }
      });        

      ScrollUtils.scrollToHash({ prefix: "insight-", offset: 90 });
      window.addEventListener("hashchange", () =>
        ScrollUtils.scrollToHash({ prefix: "insight-", offset: 90 })
      );

    } catch (err) {
      console.error("Fehler beim Laden aller Insights:", err);
      container.innerHTML = `<article class="card"><h3>Fehler</h3><p>Die Liste der Insights konnte nicht geladen werden.</p></article>`;
    }
  }

  init();
})();
