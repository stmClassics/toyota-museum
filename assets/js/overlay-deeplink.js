window.OverlayDeepLink = (() => {
  function getOpenSlug() {
    return new URLSearchParams(location.search).get("open");
  }

  function clearOpenSlug() {
    const url = new URL(location.href);
    url.searchParams.delete("open");
    history.replaceState(null, "", url.toString());
  }

  function init({ items, open }) {
    const slug = getOpenSlug();
    if (!slug) return;

    const item = items.find(x => x.slug === slug);
    if (!item) return;

    // Overlay öffnen
    open(item);

    // optional: beim Schliessen URL säubern (wenn Overlay ein Hook bietet)
    if (window.Overlay && typeof window.Overlay.onCloseOnce === "function") {
      window.Overlay.onCloseOnce(() => clearOpenSlug());
    }
  }

  return { init, getOpenSlug, clearOpenSlug };
})();
