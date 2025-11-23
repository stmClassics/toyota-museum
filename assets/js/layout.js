(async function () {
  const headerEl = document.getElementById("site-header");
  const isIndex = headerEl?.dataset.header === "index";

  const headerUrl = isIndex
    ? "/partials/index-header.html"
    : "/partials/header.html";

  async function inject(id, url) {
    const el = document.getElementById(id);
    if (!el) return;

    try {
      const res = await fetch(url, { cache: "no-store" });
      el.innerHTML = await res.text();
    } catch (err) {
      console.error("Fehler beim Laden von", url);
    }
  }

  await Promise.all([
    inject("site-header", headerUrl),
    inject("site-footer", "/partials/footer.html")
  ]);
})();

// Schatten einblenden, wenn gescrollt wird
document.addEventListener("scroll", () => {
  const header = document.querySelector(".site-header");
  if (!header) return;

  if (window.scrollY > 10) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});
